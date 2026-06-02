import { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TranscriptEditor from "./pages/TranscriptEditor";
import AdminUsers from "./pages/AdminUsers";
import AdminTranscripts from "./pages/AdminTranscripts";
import { apiFetch } from "./api/client";

function AuthenticatedShell() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch("/api/auth/me")
      .then(() => {
        if (mounted) {
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          navigate("/login", { replace: true });
        }
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-midnight px-4">
        <div className="card w-full max-w-sm text-center">
          <p className="label">Session</p>
          <p className="mt-2 text-sm text-white/70">Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-midnight">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.10),transparent_35%),#0b0f1a] p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transcripts/:id" element={<TranscriptEditor />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/transcripts" element={<AdminTranscripts />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <>
      {isLogin ? (
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      ) : (
        <AuthenticatedShell />
      )}
    </>
  );
}
