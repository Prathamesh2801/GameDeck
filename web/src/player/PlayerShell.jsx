import { FiLink2 } from "react-icons/fi";
import zealLogo from "@brand/zeal-logo-white.png";

// Mobile-first frame for every player page: brand hero, content column, footer.
export default function PlayerShell({ title, subtitle, loading, children }) {
  return (
    <div className="min-h-dvh">
      <header
        className="px-5 pt-6 pb-20 text-white"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, var(--brand-700), var(--ink-900))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          <img src={zealLogo} alt="" className="h-7 w-7" />
          <span className="font-display text-sm font-semibold tracking-wide text-white/80">Zeal Interactive</span>
        </div>
        <div className="mx-auto mt-8 max-w-md">
          {loading ? (
            <div className="h-9 w-2/3 animate-pulse rounded-lg bg-white/15" />
          ) : (
            <>
              <h1 className="font-display text-3xl leading-tight font-bold">{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-white/70">{subtitle}</p>}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto -mt-12 max-w-md px-4 pb-10">
        {loading ? <div className="h-40 animate-pulse rounded-2xl bg-surface shadow-card" /> : children}
        <p className="mt-10 text-center text-xs text-subtle">
          Games by{" "}
          <a href="https://www.zealinteractive.in" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
            Zeal Interactive Services
          </a>
        </p>
      </main>
    </div>
  );
}

export function DeckUnavailable({ message }) {
  return (
    <PlayerShell title="Link not active">
      <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-xl text-muted">
          <FiLink2 />
        </span>
        <p className="mt-4 text-sm text-muted">{message}</p>
        <p className="mt-1 text-sm text-muted">Please check the link with whoever shared it.</p>
      </div>
    </PlayerShell>
  );
}
