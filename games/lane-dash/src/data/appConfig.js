// App-level integration config for the games hub.
// Flip DEV_MODE to true while developing to replay freely (score POST skipped +
// Play Again button + token not required). Set false for production.
export const APP_CONFIG = {
  DEV_MODE: false,
  GAME_SR_NO: 4, // Lane Dash — SR_No from the hub's games-list API
  // Coins ARE the score for this game: the value submitted to the hub is
  // (coins collected × POINTS_PER_COIN). 1 coin = 1 point by default; bump this
  // if a coin should ever be worth more than one hub point.
  POINTS_PER_COIN: 10,
  API_BASE_URL: "https://royalbankingquest.com/API",
  HUB_URL: "https://royalbankingquest.com/#/games",
  REDIRECT_DELAY: 4000, // ms before auto-return to hub after a successful submit
};
