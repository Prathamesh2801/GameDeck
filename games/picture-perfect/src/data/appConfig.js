// App-level integration config for the games hub.
//
// Flip DEV_MODE to true while developing to replay freely: the score POST is
// skipped (payload is logged instead), the URL token is no longer required, and
// the Summary screen shows a "Play Again" button. Set it back to false for
// production, which requires the token, submits the score once, and auto-returns
// to the hub.
export const APP_CONFIG = {
  DEV_MODE: false,
  // Game_SR_No for Picture Perfect (matches the hub API's SR_No and the token's g:3).
  GAME_SR_NO: 3,
  // {{BASE_URL_P}} — score is POSTed to `${API_BASE_URL}/gamescore.php`.
  API_BASE_URL: "https://royalbankingquest.com/API",
  // Games hub to return to once the game is finished (hash route).
  HUB_URL: "https://royalbankingquest.com/#/games",
  // Delay before auto-redirecting back to the hub after a successful submit (ms).
  REDIRECT_DELAY: 4000,
};
