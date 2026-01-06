import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-xl px-4 py-2 text-sm font-medium ${isActive ? "bg-white/15" : "text-white/70 hover:bg-white/10"}`;

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col gap-6 border-r border-white/10 bg-slate/80 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">ATC Transcriber</p>
        <h1 className="mt-2 text-xl font-semibold">Operations</h1>
      </div>
      <nav className="flex flex-col gap-2">
        <NavLink to="/" className={linkClass}>
          Dashboard
        </NavLink>
        <NavLink to="/transcripts/1" className={linkClass}>
          Transcript Editor
        </NavLink>
        <NavLink to="/admin/users" className={linkClass}>
          Admin Users
        </NavLink>
        <NavLink to="/admin/transcripts" className={linkClass}>
          Admin Transcripts
        </NavLink>
      </nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-white/60">Secure session</p>
        <p className="text-sm">Signed in</p>
      </div>
    </aside>
  );
}
