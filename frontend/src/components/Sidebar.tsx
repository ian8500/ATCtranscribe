import { NavLink } from "react-router-dom";
import AtcLogo from "./AtcLogo";
import { apiFetch } from "../api/client";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-accent/15 text-sky-100 ring-1 ring-accent/30" : "text-white/65 hover:bg-white/10 hover:text-white"
  }`;

export default function Sidebar() {
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-6 border-r border-white/10 bg-panel/95 p-5">
      <div>
        <AtcLogo />
        <p className="mt-3 text-xs text-white/45">Audio review and transcript operations</p>
      </div>
      <nav className="flex flex-col gap-1">
        <NavLink to="/" className={linkClass}>
          Transcript Queue
        </NavLink>
        <NavLink to="/admin/users" className={linkClass}>
          Users
        </NavLink>
        <NavLink to="/admin/transcripts" className={linkClass}>
          Admin Transcripts
        </NavLink>
      </nav>
      <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-white/40">Session</p>
        <p className="mt-1 text-sm text-white/80">Secure workspace</p>
        <button className="btn btn-secondary mt-4 w-full" onClick={logout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
