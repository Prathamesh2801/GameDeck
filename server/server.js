// Startup file (point cPanel's "Application startup file" here). Passenger
// provides PORT; locally it defaults to 4000.
const app = require("./app.js");

for (const name of ["DB_USER", "DB_NAME", "ADMIN_PASSWORD", "ADMIN_TOKEN_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`GameDeck API listening on http://localhost:${port}`));
