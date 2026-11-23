// Single source of truth for the hub token. Read it straight from the live URL
// (?token=...) so a mid-game refresh still works — we never stash it in state.
//
// URLSearchParams handles the percent-decoding (%3D->=, %2F->/, %2B->+), which
// yields exactly the decoded token the backend expects. The token is always
// fully percent-encoded (no literal "+"), so the query-string "+"->space quirk
// does not apply here.
export function getToken() {
  return new URLSearchParams(window.location.search).get("token");
}
