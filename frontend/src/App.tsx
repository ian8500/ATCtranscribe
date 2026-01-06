import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TranscriptEditor from "./pages/TranscriptEditor";
import AdminUsers from "./pages/AdminUsers";
import AdminTranscripts from "./pages/AdminTranscripts";

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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 bg-midnight p-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transcripts/:id" element={<TranscriptEditor />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/transcripts" element={<AdminTranscripts />} />
            </Routes>
          </main>
        </div>
      )}
    </>
  );
}
