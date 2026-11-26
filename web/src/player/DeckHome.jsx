import { useState } from "react";
import { Link, useParams } from "react-router";
import toast from "react-hot-toast";
import { FiAward, FiEdit2, FiPlay } from "react-icons/fi";
import { api, useApi } from "../api.js";
import { GAME_META, gameIcon } from "../games.js";
import PlayerShell, { DeckUnavailable } from "./PlayerShell.jsx";
import { useNickname } from "./nickname.js";

function NicknameForm({ initial, onSave }) {
  const [value, setValue] = useState(initial ?? "");
  const clean = value.replace(/\s+/g, " ").trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onSave(clean);
      }}
      className="rounded-2xl bg-surface p-6 shadow-card"
    >
      <h2 className="font-display text-xl font-bold text-heading">What should we call you?</h2>
      <p className="mt-1 text-sm text-muted">Your nickname appears on the leaderboards.</p>
      <input
        className="input mt-4"
        autoFocus
        maxLength={24}
        placeholder="Your nickname"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" disabled={!clean} className="btn mt-4 w-full bg-primary py-3 text-on-primary hover:bg-primary-hover">
        Continue
      </button>
    </form>
  );
}

// Landing page for a share link: nickname once, then the deck's games.
export default function DeckHome() {
  const { code } = useParams();
  const deck = useApi(`/decks/${code}`);
  const [nickname, setNickname] = useNickname(code);
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(null); // slug being launched

  if (deck.error) return <DeckUnavailable message={deck.error.message} />;
  if (!deck.data) return <PlayerShell loading />;

  async function play(slug) {
    setStarting(slug);
    try {
      const { token } = await api(`/decks/${code}/plays`, { method: "POST", body: { game: slug, nickname } });
      window.location.assign(`/games/${slug}/?token=${token}&deck=${deck.data.code}`);
    } catch (err) {
      toast.error(err.message);
      setStarting(null);
    }
  }

  const askName = !nickname || editing;

  return (
    <PlayerShell title={deck.data.name} subtitle="Pick a game and climb the leaderboard.">
      {askName ? (
        <NicknameForm
          initial={nickname}
          onSave={(name) => {
            setNickname(name);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-5 py-3 shadow-card">
            <p className="text-sm text-muted">
              Playing as <span className="font-semibold text-heading">{nickname}</span>
            </p>
            <button onClick={() => setEditing(true)} className="btn px-2.5 py-1.5 text-xs text-primary hover:bg-primary-soft">
              <FiEdit2 /> Change
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {deck.data.games.map((g) => {
              const Icon = gameIcon(g.slug);
              return (
                <li key={g.slug} className="rounded-2xl bg-surface p-4 shadow-card">
                  <div className="flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-3xl text-primary">
                      <Icon />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-heading">{g.name}</h3>
                      <p className="text-sm text-muted">{GAME_META[g.slug]?.blurb}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      to={`/d/${code}/leaderboard/${g.slug}`}
                      className="btn border border-border text-text hover:bg-surface-muted"
                    >
                      <FiAward /> Leaderboard
                    </Link>
                    <button
                      onClick={() => play(g.slug)}
                      disabled={starting !== null}
                      className="btn bg-primary text-on-primary hover:bg-primary-hover"
                    >
                      <FiPlay /> {starting === g.slug ? "Starting…" : "Play"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </PlayerShell>
  );
}
