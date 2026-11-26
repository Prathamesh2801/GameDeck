import { GiThreeLeaves } from "react-icons/gi";
import DeviceFrame from "./DeviceFrame.jsx";

// Shown in production when the game is opened without a play token.
// Matches Slice Frenzy's card / brand styling.
export default function BlockedScreen() {
  return (
    <DeviceFrame>
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xs rounded-3xl border border-border-strong/70 bg-surface px-6 py-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex items-center justify-center gap-3 text-accent/70">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-border-strong" />
            <GiThreeLeaves className="text-lg" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-border-strong" />
          </div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-muted">
            Slice Frenzy
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-heading">
            Access Blocked
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Open this game from your GameDeck link to play and save your score.
          </p>
        </div>
      </div>
    </DeviceFrame>
  );
}
