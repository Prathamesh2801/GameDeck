// GameDeck API. Express 5: thrown errors / rejected promises in handlers reach
// the error handler at the bottom, so routes don't need try/catch.
const crypto = require("node:crypto");
const express = require("express");
const { pool } = require("./db.js");

const ADMIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PLAY_TTL = "INTERVAL 2 HOUR"; // a play token must submit within this window
const LEADERBOARD_SIZE = 20;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest();
const sign = (payload) =>
  crypto.createHmac("sha256", process.env.ADMIN_TOKEN_SECRET).update(payload).digest("base64url");

// Deck codes avoid look-alike characters (0/O, 1/I/L) so they're easy to read out.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newDeckCode = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");

function cleanNickname(value) {
  const nick = String(value ?? "").replace(/\s+/g, " ").trim();
  if (nick.length < 1 || nick.length > 24) throw new HttpError(400, "Nickname must be 1–24 characters.");
  return nick;
}

// A deck is playable when it exists, is enabled and hasn't expired.
async function findLiveDeck(code) {
  const [[deck]] = await pool.query(
    `SELECT id, code, name FROM decks
     WHERE code = ? AND enabled AND (expires_at IS NULL OR expires_at > NOW())`,
    [String(code).toUpperCase()],
  );
  if (!deck) throw new HttpError(404, "This deck link is invalid or has expired.");
  return deck;
}

async function findDeckGame(deckId, slug) {
  const [[game]] = await pool.query(
    `SELECT g.id, g.slug, g.name, g.max_score FROM games g
     JOIN deck_games dg ON dg.game_id = g.id
     WHERE dg.deck_id = ? AND g.slug = ? AND g.enabled`,
    [deckId, slug],
  );
  if (!game) throw new HttpError(404, "That game isn't part of this deck.");
  return game;
}

// Resolves slugs to game ids in the given order; rejects unknown slugs.
async function gameIdsFor(slugs) {
  if (!Array.isArray(slugs) || slugs.length === 0) throw new HttpError(400, "Pick at least one game.");
  const [rows] = await pool.query("SELECT id, slug FROM games WHERE slug IN (?)", [slugs]);
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const unknown = slugs.filter((s) => !bySlug.has(s));
  if (unknown.length) throw new HttpError(400, `Unknown game(s): ${unknown.join(", ")}`);
  return slugs.map((s) => bySlug.get(s));
}

async function setDeckGames(conn, deckId, slugs) {
  const ids = await gameIdsFor(slugs);
  await conn.query("DELETE FROM deck_games WHERE deck_id = ?", [deckId]);
  await conn.query("INSERT INTO deck_games (deck_id, game_id, position) VALUES ?", [
    ids.map((id, i) => [deckId, id, i]),
  ]);
}

function requireAdmin(req, _res, next) {
  const [exp, sig] = (req.get("authorization") || "").replace(/^Bearer /, "").split(".");
  const valid =
    exp && sig && Number(exp) > Date.now() && crypto.timingSafeEqual(hash(sig), hash(sign(`admin.${exp}`)));
  if (!valid) throw new HttpError(401, "Please log in again.");
  next();
}

// ── app ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "20kb" }));

// Placeholder home page until the web app is served from here.
app.get("/", (_req, res) => res.type("text").send("GameDeck API is running. Try /api/health"));

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

// Public: what a player sees after opening /d/<code>.
app.get("/api/decks/:code", async (req, res) => {
  const deck = await findLiveDeck(req.params.code);
  const [games] = await pool.query(
    `SELECT g.slug, g.name FROM deck_games dg JOIN games g ON g.id = dg.game_id
     WHERE dg.deck_id = ? AND g.enabled ORDER BY dg.position`,
    [deck.id],
  );
  res.json({ code: deck.code, name: deck.name, games });
});

// Public: start a play session; the game gets back a one-time token.
app.post("/api/decks/:code/plays", async (req, res) => {
  const deck = await findLiveDeck(req.params.code);
  const game = await findDeckGame(deck.id, req.body?.game);
  const nickname = cleanNickname(req.body?.nickname);
  const token = crypto.randomBytes(16).toString("hex");
  await pool.query("INSERT INTO plays (token, deck_id, game_id, nickname) VALUES (?, ?, ?, ?)", [
    token,
    deck.id,
    game.id,
    nickname,
  ]);
  res.status(201).json({ token });
});

// Public: submit the final score for a play session (once).
app.post("/api/plays/:token/score", async (req, res) => {
  const score = req.body?.score;
  if (!Number.isInteger(score) || score < 0 || score > 2147483647)
    throw new HttpError(400, "Score must be a whole number ≥ 0.");

  const [[play]] = await pool.query(
    `SELECT p.id, p.score, p.started_at < NOW() - ${PLAY_TTL} AS expired, g.max_score
     FROM plays p JOIN games g ON g.id = p.game_id WHERE p.token = ?`,
    [req.params.token],
  );
  if (!play) throw new HttpError(404, "Unknown play session.");
  if (play.score !== null) throw new HttpError(409, "This play already has a score.");
  if (play.expired) throw new HttpError(410, "This play session has expired.");
  if (play.max_score !== null && score > play.max_score) throw new HttpError(400, "Score is out of range.");

  // `score IS NULL` in the WHERE makes a concurrent double-submit a no-op.
  const [result] = await pool.query(
    "UPDATE plays SET score = ?, finished_at = NOW() WHERE id = ? AND score IS NULL",
    [score, play.id],
  );
  if (result.affectedRows === 0) throw new HttpError(409, "This play already has a score.");
  res.json({ ok: true, score });
});

// Public: best score per nickname for one game within one deck.
app.get("/api/decks/:code/games/:slug/leaderboard", async (req, res) => {
  const deck = await findLiveDeck(req.params.code);
  const game = await findDeckGame(deck.id, req.params.slug);
  const [rows] = await pool.query(
    `SELECT nickname, MAX(score) AS score FROM plays
     WHERE deck_id = ? AND game_id = ? AND score IS NOT NULL
     GROUP BY nickname ORDER BY score DESC, MIN(finished_at) ASC LIMIT ?`,
    [deck.id, game.id, LEADERBOARD_SIZE],
  );
  res.json({ game: { slug: game.slug, name: game.name }, entries: rows });
});

// ── admin ──────────────────────────────────────────────────────────────────

app.post("/api/admin/login", (req, res) => {
  const ok = crypto.timingSafeEqual(hash(req.body?.password ?? ""), hash(process.env.ADMIN_PASSWORD));
  if (!ok) throw new HttpError(401, "Wrong password.");
  const exp = Date.now() + ADMIN_TOKEN_TTL_MS;
  res.json({ token: `${exp}.${sign(`admin.${exp}`)}`, expiresAt: exp });
});

app.use("/api/admin", requireAdmin);

app.get("/api/admin/games", async (_req, res) => {
  const [games] = await pool.query("SELECT id, slug, name, max_score, enabled FROM games ORDER BY id");
  res.json(games);
});

app.get("/api/admin/decks", async (_req, res) => {
  const [decks] = await pool.query(
    `SELECT d.id, d.code, d.name, d.enabled, d.expires_at, d.created_at,
       (SELECT GROUP_CONCAT(g.slug ORDER BY dg.position) FROM deck_games dg
        JOIN games g ON g.id = dg.game_id WHERE dg.deck_id = d.id) AS games,
       (SELECT COUNT(*) FROM plays p WHERE p.deck_id = d.id AND p.score IS NOT NULL) AS plays
     FROM decks d ORDER BY d.created_at DESC, d.id DESC`,
  );
  res.json(decks.map((d) => ({ ...d, enabled: !!d.enabled, games: d.games ? d.games.split(",") : [] })));
});

app.post("/api/admin/decks", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name || name.length > 120) throw new HttpError(400, "Deck name must be 1–120 characters.");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query("INSERT INTO decks (code, name, expires_at) VALUES (?, ?, ?)", [
      newDeckCode(),
      name,
      req.body?.expiresAt || null,
    ]);
    await setDeckGames(conn, result.insertId, req.body?.games);
    await conn.commit();
    const [[deck]] = await pool.query("SELECT id, code, name FROM decks WHERE id = ?", [result.insertId]);
    res.status(201).json(deck);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

app.patch("/api/admin/decks/:id", async (req, res) => {
  const { name, enabled, expiresAt, games } = req.body ?? {};
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 120))
    throw new HttpError(400, "Deck name must be 1–120 characters.");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE decks SET name = COALESCE(?, name), enabled = COALESCE(?, enabled),
         expires_at = IF(?, ?, expires_at) WHERE id = ?`,
      [name?.trim() ?? null, enabled ?? null, expiresAt !== undefined, expiresAt || null, req.params.id],
    );
    if (result.affectedRows === 0) throw new HttpError(404, "Deck not found.");
    if (games !== undefined) await setDeckGames(conn, req.params.id, games);
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

app.delete("/api/admin/decks/:id", async (req, res) => {
  const [result] = await pool.query("DELETE FROM decks WHERE id = ?", [req.params.id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Deck not found.");
  res.json({ ok: true });
});

app.get("/api/admin/decks/:id/plays", async (req, res) => {
  const [plays] = await pool.query(
    `SELECT p.id, g.slug AS game, p.nickname, p.score, p.finished_at FROM plays p
     JOIN games g ON g.id = p.game_id
     WHERE p.deck_id = ? AND p.score IS NOT NULL ORDER BY p.finished_at DESC`,
    [req.params.id],
  );
  res.json(plays);
});

// Remove a junk / offensive score.
app.delete("/api/admin/plays/:id", async (req, res) => {
  const [result] = await pool.query("DELETE FROM plays WHERE id = ?", [req.params.id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Play not found.");
  res.json({ ok: true });
});

// ── errors ─────────────────────────────────────────────────────────────────

app.use("/api", (_req, _res) => {
  throw new HttpError(404, "Not found.");
});

app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") err = new HttpError(400, "Invalid JSON body.");
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong." });
});

module.exports = app;
