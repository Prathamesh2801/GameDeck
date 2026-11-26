// GameDeck game SDK: the whole contract between a game and the platform.
// Plain JS (no React) so every game can import it via the `@sdk` alias.
//
// The player site launches a game as /games/<slug>/?token=<play token>&deck=<CODE>.
// The game submits its final score once, then sends the player to the deck's
// leaderboard for that game.

const params = new URLSearchParams(window.location.search);

export const playToken = params.get("token");
export const deckCode = params.get("deck");

// "/games/strike-alley/" -> "strike-alley" (Vite bakes BASE_URL in per game).
export const gameSlug = import.meta.env.BASE_URL.split("/").filter(Boolean).pop();

// Running a game's own dev server without a token = free practice: nothing is
// submitted and the result screen offers "Play again". A built game always
// needs a token, so no untracked plays in production.
export const isDevPlay = import.meta.env.DEV && !playToken;
export const canPlay = Boolean(playToken) || isDevPlay;

export const leaderboardUrl = deckCode ? `/d/${deckCode}/leaderboard/${gameSlug}` : "/";
export const REDIRECT_DELAY = 4000; // ms on the result screen before leaving

// Resolves once the score is stored; throws Error(message) so the game can
// show it with a Retry button.
export async function submitScore({ score }) {
  const value = Math.max(0, Math.round(score));
  if (isDevPlay) {
    console.log(`[GameDeck] practice play, score ${value} not submitted`);
    return;
  }
  const res = await fetch(`/api/plays/${encodeURIComponent(playToken)}/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ score: value }),
  });
  // 409 = this play already has a score (e.g. the page was reloaded after a
  // successful submit), so treat it as saved.
  if (res.ok || res.status === 409) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || `Couldn't save your score (HTTP ${res.status}).`);
}
