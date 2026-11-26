import { Link, Navigate, Outlet, useNavigate } from "react-router";
import { FiLogOut } from "react-icons/fi";
import zealLogo from "@brand/zeal-logo-white.png";
import { auth } from "../api.js";

// Auth guard + app chrome for every /admin page.
export default function AdminLayout() {
  const navigate = useNavigate();
  if (!auth.get()) return <Navigate to="/admin/login" replace />;

  function logout() {
    auth.clear();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/admin" className="flex items-center gap-3">
            <img src={zealLogo} alt="" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-wide">GameDeck</span>
            <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/70 sm:inline">
              Admin
            </span>
          </Link>
          <button onClick={logout} className="btn px-3 text-white/80 hover:bg-white/10 hover:text-white">
            <FiLogOut /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
