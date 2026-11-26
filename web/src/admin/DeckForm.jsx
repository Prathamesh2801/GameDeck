import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiX } from "react-icons/fi";
import { api } from "../api.js";
import { GAME_META, gameIcon } from "../games.js";

// "2026-12-01 18:30:00" (MySQL) <-> "2026-12-01T18:30" (datetime-local input)
const toInput = (dt) => (dt ? dt.slice(0, 16).replace(" ", "T") : "");
const toMysql = (v) => (v ? `${v.replace("T", " ")}:00` : null);

// Create / edit a deck in a native <dialog>. `deck` null = create.
export default function DeckForm({ deck, games, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [name, setName] = useState(deck?.name ?? "");
  const [picked, setPicked] = useState(deck?.games ?? []); // slugs, in play order
  const [expiresAt, setExpiresAt] = useState(toInput(deck?.expires_at));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  const toggle = (slug) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  async function save(e) {
    e.preventDefault();
    if (picked.length === 0) return toast.error("Pick at least one game.");
    setBusy(true);
    const body = { name: name.trim(), games: picked, expiresAt: toMysql(expiresAt) };
    try {
      if (deck) await api(`/admin/decks/${deck.id}`, { method: "PATCH", body });
      else await api("/admin/decks", { method: "POST", body });
      toast.success(deck ? "Deck updated" : "Deck created");
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(100%-2rem,34rem)] rounded-2xl bg-surface p-0 text-text shadow-card"
    >
      <form onSubmit={save}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl font-bold text-heading">{deck ? "Edit deck" : "New deck"}</h2>
          <button type="button" onClick={onClose} className="btn p-2 text-muted hover:bg-surface-muted" aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-6 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="text-sm font-medium text-heading">Deck name</span>
            <input
              className="input mt-1.5"
              required
              maxLength={120}
              placeholder="e.g. Acme Corp – Annual Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <span className="mt-1 block text-xs text-subtle">Shown to players at the top of the deck.</span>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-heading">Games</legend>
            <p className="text-xs text-subtle">Players see them in the order you pick them.</p>
            <div className="mt-2.5 grid gap-2">
              {games.map((g) => {
                const Icon = gameIcon(g.slug);
                const order = picked.indexOf(g.slug);
                const on = order !== -1;
                return (
                  <button
                    type="button"
                    key={g.slug}
                    onClick={() => toggle(g.slug)}
                    aria-pressed={on}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      on ? "border-primary bg-primary-soft/60" : "border-border hover:border-border-strong"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl ${
                        on ? "bg-primary text-on-primary" : "bg-surface-muted text-muted"
                      }`}
                    >
                      <Icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-heading">{g.name}</span>
                      <span className="block truncate text-xs text-muted">{GAME_META[g.slug]?.blurb}</span>
                    </span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        on ? "bg-primary text-on-primary" : "border border-border-strong"
                      }`}
                    >
                      {on ? order + 1 : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-medium text-heading">Closes at (optional)</span>
            <div className="mt-1.5 flex gap-2">
              <input
                type="datetime-local"
                className="input"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              {expiresAt && (
                <button type="button" onClick={() => setExpiresAt("")} className="btn border border-border text-muted hover:bg-surface-muted">
                  Clear
                </button>
              )}
            </div>
            <span className="mt-1 block text-xs text-subtle">After this the link stops working. Leave empty to keep it open.</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="btn border border-border text-text hover:bg-surface-muted">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn bg-primary text-on-primary hover:bg-primary-hover">
            <FiCheck /> {busy ? "Saving…" : deck ? "Save changes" : "Create deck"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
