import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { FiLock } from "react-icons/fi";
import zealLogo from "@brand/zeal-logo.png";
import { api, auth } from "../api.js";

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (auth.get()) return <Navigate to="/admin" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api("/admin/login", { method: "POST", body: { password } });
      auth.set(token);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main
      className="grid min-h-dvh place-items-center p-5"
      style={{ background: "radial-gradient(120% 80% at 50% 0%, var(--brand-700), var(--ink-900))" }}
    >
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-card">
        <img src={zealLogo} alt="Zeal Interactive" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-center font-display text-2xl font-bold text-heading">GameDeck</h1>
        <p className="mt-1 text-center text-sm text-muted">Sign in to manage your game decks.</p>

        <label className="mt-7 block text-sm font-medium text-heading" htmlFor="password">
          Admin password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="input mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy} className="btn mt-6 w-full bg-primary py-3 text-on-primary hover:bg-primary-hover">
          <FiLock /> {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-6 text-center text-xs text-subtle">Zeal Interactive Services</p>
      </form>
    </main>
  );
}
