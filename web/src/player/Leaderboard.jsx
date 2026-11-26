import { Link, useParams } from "react-router";
import { FiArrowLeft } from "react-icons/fi";
import { useApi } from "../api.js";
import { gameIcon } from "../games.js";
import PlayerShell, { DeckUnavailable } from "./PlayerShell.jsx";
import { useNickname } from "./nickname.js";

// gold, silver, bronze
const MEDALS = ["bg-[var(--accent-400)] text-white", "bg-[var(--neutral-300)] text-heading", "bg-[var(--accent-700)] text-white"];

// Public top-20 for one game in a deck. The player's own row is highlighted.
export default function Leaderboard() {
  const { code, slug } = useParams();
  const board = useApi(`/decks/${code}/games/${slug}/leaderboard`);
  const [nickname] = useNickname(code);

  if (board.error) return <DeckUnavailable message={board.error.message} />;
  if (!board.data) return <PlayerShell loading />;

  const Icon = gameIcon(slug);
  const me = nickname?.toLowerCase();

  return (
    <PlayerShell title={board.data.game.name} subtitle="Leaderboard · best score per player">
      <div className="rounded-2xl bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <Link to={`/d/${code}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
            <FiArrowLeft /> All games
          </Link>
          <Icon className="text-2xl text-primary" />
        </div>

        {board.data.entries.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">No scores yet. Be the first!</p>
        ) : (
          <ol className="divide-y divide-border">
            {board.data.entries.map((e, i) => {
              const mine = e.nickname.toLowerCase() === me;
              return (
                <li key={e.nickname} className={`flex items-center gap-3 px-5 py-3 ${mine ? "bg-primary-soft/60" : ""}`}>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      MEDALS[i] ?? "bg-surface-muted text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-heading">
                    {e.nickname}
                    {mine && <span className="ml-2 text-xs font-semibold text-primary">You</span>}
                  </span>
                  <span className="font-display text-lg font-bold text-accent tabular-nums">{e.score.toLocaleString()}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </PlayerShell>
  );
}
