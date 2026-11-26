import { useState } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { FiBarChart2, FiCopy, FiEdit2, FiLayers, FiPause, FiPlay, FiPlus, FiTrash2 } from "react-icons/fi";
import { api, useApi } from "../api.js";
import { gameIcon } from "../games.js";
import DeckForm from "./DeckForm.jsx";

const shareLink = (code) => `${window.location.origin}/d/${code}`;
const isExpired = (deck) => deck.expires_at && new Date(deck.expires_at.replace(" ", "T")) < new Date();
const formatDate = (dt) =>
  new Date(dt.replace(" ", "T")).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function StatusPill({ deck }) {
  const [label, cls] = !deck.enabled
    ? ["Paused", "bg-surface-muted text-muted"]
    : isExpired(deck)
      ? ["Expired", "bg-danger-soft text-danger"]
      : ["Live", "bg-primary-soft text-primary"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function DeckCard({ deck, gameNames, onEdit, onChanged }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(promise, message) {
    try {
      await promise;
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const copy = () =>
    navigator.clipboard.writeText(shareLink(deck.code)).then(
      () => toast.success("Share link copied"),
      () => toast.error("Couldn't copy, select the link instead"),
    );

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold leading-snug text-heading">{deck.name}</h3>
        <StatusPill deck={deck} />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-muted py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate text-xs text-muted select-all">{shareLink(deck.code)}</code>
        <button onClick={copy} className="btn bg-surface px-2.5 py-1.5 text-xs text-primary shadow-sm hover:bg-primary-soft">
          <FiCopy /> Copy
        </button>
      </div>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {deck.games.map((slug) => {
          const Icon = gameIcon(slug);
          return (
            <li key={slug} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-text">
              <Icon className="text-primary" /> {gameNames[slug] ?? slug}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-subtle">
        {deck.plays} {deck.plays === 1 ? "score" : "scores"} · created {formatDate(deck.created_at)}
        {deck.expires_at && ` · closes ${formatDate(deck.expires_at)}`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        {confirmDelete ? (
          <>
            <span className="mr-auto text-sm font-medium text-danger">Delete deck and all its scores?</span>
            <button onClick={() => setConfirmDelete(false)} className="btn px-3 text-muted hover:bg-surface-muted">
              Cancel
            </button>
            <button
              onClick={() => run(api(`/admin/decks/${deck.id}`, { method: "DELETE" }), "Deck deleted")}
              className="btn bg-danger px-3 text-white"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <Link to={`/admin/decks/${deck.id}`} className="btn px-3 text-text hover:bg-surface-muted">
              <FiBarChart2 /> Scores
            </Link>
            <button onClick={onEdit} className="btn px-3 text-text hover:bg-surface-muted">
              <FiEdit2 /> Edit
            </button>
            <button
              onClick={() =>
                run(
                  api(`/admin/decks/${deck.id}`, { method: "PATCH", body: { enabled: !deck.enabled } }),
                  deck.enabled ? "Deck paused" : "Deck resumed",
                )
              }
              className="btn px-3 text-text hover:bg-surface-muted"
            >
              {deck.enabled ? <FiPause /> : <FiPlay />} {deck.enabled ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn ml-auto px-3 text-muted hover:bg-danger-soft hover:text-danger"
              aria-label="Delete deck"
            >
              <FiTrash2 />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function Decks() {
  const decks = useApi("/admin/decks");
  const games = useApi("/admin/games");
  const [editing, setEditing] = useState(null); // null | "new" | deck

  const gameNames = Object.fromEntries((games.data ?? []).map((g) => [g.slug, g.name]));
  const ready = decks.data && games.data;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-heading">Decks</h1>
          <p className="mt-1 text-sm text-muted">Pick games, share one link, watch the leaderboard fill up.</p>
        </div>
        <button onClick={() => setEditing("new")} disabled={!ready} className="btn bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-hover">
          <FiPlus /> New deck
        </button>
      </div>

      {(decks.error || games.error) && (
        <p className="mt-8 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          {(decks.error || games.error).message}. Is the API server running?
        </p>
      )}

      {!ready && !decks.error && <p className="mt-8 text-sm text-muted">Loading decks…</p>}

      {ready && decks.data.length === 0 && (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-2xl text-primary">
            <FiLayers />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-heading">No decks yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            A deck is a set of games you share with a client through one link.
          </p>
          <button onClick={() => setEditing("new")} className="btn mt-5 bg-primary text-on-primary hover:bg-primary-hover">
            <FiPlus /> Create your first deck
          </button>
        </div>
      )}

      {ready && decks.data.length > 0 && (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {decks.data.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              gameNames={gameNames}
              onEdit={() => setEditing(deck)}
              onChanged={decks.reload}
            />
          ))}
        </div>
      )}

      {editing && (
        <DeckForm
          deck={editing === "new" ? null : editing}
          games={games.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            decks.reload();
          }}
        />
      )}
    </>
  );
}
