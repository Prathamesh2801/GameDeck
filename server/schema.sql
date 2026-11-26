-- GameDeck schema. Safe to re-run: tables are created only if missing and
-- the game catalogue is upserted.

CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  max_score INT NULL, -- NULL = no ceiling known yet
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS decks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code CHAR(8) NOT NULL UNIQUE, -- share link: /d/<code>
  name VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deck_games (
  deck_id INT NOT NULL,
  game_id INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (deck_id, game_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- One row per play session. The token is handed to the game at start and
-- can submit exactly one score.
CREATE TABLE IF NOT EXISTS plays (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token CHAR(32) NOT NULL UNIQUE,
  deck_id INT NOT NULL,
  game_id INT NOT NULL,
  nickname VARCHAR(24) NOT NULL,
  score INT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  INDEX leaderboard (deck_id, game_id, score),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

INSERT INTO games (slug, name, max_score) VALUES
  ('slice-frenzy', 'Slice Frenzy', NULL),
  ('picture-perfect', 'Picture Perfect', 1000),
  ('lane-dash', 'Lane Dash', NULL),
  ('zip-to-victory', 'Zip to Victory', 2500),
  ('strike-alley', 'Strike Alley', 3000)
-- VALUES() form (not the row alias) so it also runs on cPanel's MariaDB.
ON DUPLICATE KEY UPDATE name = VALUES(name), max_score = VALUES(max_score);
