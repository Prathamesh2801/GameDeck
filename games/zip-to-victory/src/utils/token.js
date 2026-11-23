// Single source of truth for the hub token. Read from the live URL so a mid-game
// refresh still works. URLSearchParams handles percent-decoding.
export function getToken() {
  return new URLSearchParams(window.location.search).get("token")
}
