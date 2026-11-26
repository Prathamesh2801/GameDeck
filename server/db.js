// Env + MySQL pool. Locally the settings come from server/.env; on cPanel they
// are set in the Node.js app's environment variables screen.
const path = require("node:path");
const mysql = require("mysql2/promise");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // no .env file (production) or Node < 20.12: rely on real env vars
}

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool({ ...config, connectionLimit: 5, dateStrings: true });

module.exports = { pool, config };
