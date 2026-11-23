// App-level integration config for the games hub.
// Flip DEV_MODE to true while developing to replay freely (score POST skipped +
// Play Again button + token not required). Set false for production.
export const APP_CONFIG = {
  DEV_MODE: false,
  GAME_SR_NO: 7, // Zip to Victory's SR_No from the hub API
  API_BASE_URL: "https://royalbankingquest.com/API",
  HUB_URL: "https://royalbankingquest.com/#/games",
  REDIRECT_DELAY: 4000, // ms before auto-return to hub after a successful submit
}
