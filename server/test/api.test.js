// End-to-end check of the API against the local database (needs .env and
// `npm run db:init`). Creates its own deck and deletes it afterwards.
// Run: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app.js");
const { pool } = require("../db.js");

let server, base, adminToken, deck;

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  if (deck) await api("DELETE", `/admin/decks/${deck.id}`, null, adminToken);
  server.close();
  await pool.end();
});

test("admin login rejects a wrong password and protects admin routes", async () => {
  assert.equal((await api("POST", "/admin/login", { password: "nope" })).status, 401);
  assert.equal((await api("GET", "/admin/decks")).status, 401);
  assert.equal((await api("GET", "/admin/decks", null, "123.forged")).status, 401);

  const login = await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  adminToken = login.body.token;
});

test("full deck → play → score → leaderboard flow", async () => {
  const created = await api(
    "POST",
    "/admin/decks",
    { name: "Test deck", games: ["picture-perfect", "strike-alley"] },
    adminToken,
  );
  assert.equal(created.status, 201);
  deck = created.body;
  assert.match(deck.code, /^[A-Z2-9]{8}$/);

  const pub = await api("GET", `/decks/${deck.code.toLowerCase()}`); // codes are case-insensitive
  assert.deepEqual(pub.body.games.map((g) => g.slug), ["picture-perfect", "strike-alley"]);

  const start = (game, nickname) => api("POST", `/decks/${deck.code}/plays`, { game, nickname });
  const submit = (token, score) => api("POST", `/plays/${token}/score`, { score });

  // A game outside the deck can't be played, and nicknames are validated.
  assert.equal((await start("lane-dash", "Asha")).status, 404);
  assert.equal((await start("picture-perfect", "   ")).status, 400);

  // Normal play: one score per token.
  const p1 = (await start("picture-perfect", "Asha")).body.token;
  assert.equal((await submit(p1, 800)).status, 200);
  assert.equal((await submit(p1, 900)).status, 409);

  // Anti-cheat: above the game's max score, negative, or non-integer.
  const p2 = (await start("picture-perfect", "Ravi")).body.token;
  assert.equal((await submit(p2, 5000)).status, 400);
  assert.equal((await submit(p2, -1)).status, 400);
  assert.equal((await submit(p2, 1.5)).status, 400);
  assert.equal((await submit(p2, 300)).status, 200);

  // Best score per nickname wins.
  const p3 = (await start("picture-perfect", "Asha")).body.token;
  await submit(p3, 500);

  const board = await api("GET", `/decks/${deck.code}/games/picture-perfect/leaderboard`);
  assert.deepEqual(board.body.entries, [
    { nickname: "Asha", score: 800 },
    { nickname: "Ravi", score: 300 },
  ]);

  // Disabling the deck closes it to players.
  await api("PATCH", `/admin/decks/${deck.id}`, { enabled: false }, adminToken);
  assert.equal((await api("GET", `/decks/${deck.code}`)).status, 404);
});
