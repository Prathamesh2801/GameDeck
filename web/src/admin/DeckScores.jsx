import { useState } from "react";
import { Link, useParams } from "react-router";
import toast from "react-hot-toast";
import { FiArrowLeft, FiTrash2 } from "react-icons/fi";
import { api, useApi } from "../api.js";
import { gameIcon } from "../games.js";

const formatDate = (dt) =>
  new Date(dt.replace(" ", "T")).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// Every submitted score in a deck, one tab per game, highest first.
// Admins can delete junk or offensive entries here.
export default function DeckScores() {
  const { id } = useParams();
  const decks = useApi("/admin/decks");
  const games = useApi("/admin/games");
  const plays = useApi(`/admin/decks/${id}/plays`);
  const [tab, setTab] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const deck = decks.data?.find((d) => String(d.id) === id);
  const gameNames = Object.fromEntries((games.data ?? []).map((g) => [g.slug, g.name]));

  if (decks.data && !deck) return <p className="text-sm text-muted">Deck not found. <Link to="/admin" className="text-primary underline">Back to decks</Link></p>;
  if (!deck || !plays.data || !games.data) return <p className="text-sm text-muted">Loading scores…</p>;

  const active = tab ?? deck.games[0];
  const rows = plays.data.filter((p) => p.game === active).sort((a, b) => b.score - a.score);

  async function remove(playId) {
    try {
      await api(`/admin/plays/${playId}`, { method: "DELETE" });
      toast.success("Score deleted");
      setPendingDelete(null);
      plays.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        <FiArrowLeft /> All decks
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-heading">{deck.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {plays.data.length} {plays.data.length === 1 ? "score" : "scores"} across {deck.games.length}{" "}
        {deck.games.length === 1 ? "game" : "games"}
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {deck.games.map((slug) => {
          const Icon = gameIcon(slug);
          const count = plays.data.filter((p) => p.game === slug).length;
          const on = slug === active;
          return (
            <button
              key={slug}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(slug)}
              className={`btn shrink-0 border ${
                on ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-text hover:border-border-strong"
              }`}
            >
              <Icon /> {gameNames[slug] ?? slug}
              <span className={`rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-surface-muted"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted">No scores for this game yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">Nickname</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="hidden px-4 py-3 sm:table-cell">Played</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-semibold text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-heading">{p.nickname}</td>
                  <td className="px-4 py-3 text-right font-display text-base font-bold text-accent tabular-nums">
                    {p.score.toLocaleString()}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{formatDate(p.finished_at)}</td>
                  <td className="px-4 py-2 text-right">
                    {pendingDelete === p.id ? (
                      <span className="inline-flex gap-1">
                        <button onClick={() => setPendingDelete(null)} className="btn px-2 py-1 text-xs text-muted hover:bg-surface-muted">
                          Keep
                        </button>
                        <button onClick={() => remove(p.id)} className="btn bg-danger px-2 py-1 text-xs text-white">
                          Delete
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setPendingDelete(p.id)}
                        className="btn p-2 text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Delete score by ${p.nickname}`}
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-subtle">
        The public leaderboard shows each nickname's best score; this list shows every play.
      </p>
    </>
  );
}
