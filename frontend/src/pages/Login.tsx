import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface UserOption {
  id: number;
  name: string;
}

export default function Login() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UserOption[]>("/api/auth/user-list").then(setUsers).catch(() => setUsers([]));
  }, []);

  const handleLogin = async () => {
    setMessage(null);
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ user_id: selectedUser, password }),
    });
    setMessage("Logged in");
  };

  const handleForgot = async () => {
    setMessage(null);
    await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ user_id: selectedUser }),
    });
    setMessage("Admins notified");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-midnight px-4">
      <div className="card w-full max-w-md space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">ATC Transcriber</p>
          <h1 className="mt-2 text-2xl font-semibold">Secure Login</h1>
          <p className="mt-1 text-sm text-white/70">Select your user profile to continue.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">User</label>
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={selectedUser}
              onChange={(event) => setSelectedUser(Number(event.target.value) || "")}
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary flex-1"
              onClick={handleLogin}
              disabled={!selectedUser || !password}
            >
              Login
            </button>
            <button className="btn btn-secondary" onClick={handleForgot} disabled={!selectedUser}>
              Forgot password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
