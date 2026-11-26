// Creates the database (if allowed) and applies schema.sql. Re-runnable.
// On cPanel, create the database + user in "MySQL Databases" first.
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { config } = require("./db.js");

(async () => {
  const conn = await mysql.createConnection({ ...config, database: undefined, multipleStatements: true });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4`);
  } catch (err) {
    console.log(`(skipped CREATE DATABASE: ${err.code})`);
  }
  await conn.query(`USE \`${config.database}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  const [games] = await conn.query("SELECT slug, max_score FROM games ORDER BY id");
  console.log(`Schema applied to "${config.database}". Games:`, games.map((g) => g.slug).join(", "));
  await conn.end();
})().catch((err) => {
  console.error("db:init failed:", err.message);
  process.exit(1);
});
