import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import AtcLogo from "../components/AtcLogo";

interface UserOption {
  id: number;
  name: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<UserOption[]>("/api/auth/user-list")
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load users"));
  }, []);

  const handleLogin = async () => {
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ user_id: selectedUser, password }),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleForgot = async () => {
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ user_id: selectedUser }),
      });
      setMessage("Admins notified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send password reset request");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_38%),#0b0f1a] px-4">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-5">
          <AtcLogo />
          <div>
            <p className="label">Secure local workspace</p>
            <h1 className="mt-1 text-2xl font-semibold">Sign in to continue</h1>
            <p className="mt-1 text-sm text-white/65">Select your operator profile and open the investigation queue.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">User</label>
            <select
              className="select mt-2"
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
            {users.length === 0 && (
              <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                No users are available. Create the first admin from Terminal:
                <code className="mt-2 block rounded bg-black/30 px-2 py-1 text-white">
                  ATC_ADMIN_EMAIL=you@example.com ATC_ADMIN_PASSWORD='use-a-long-password' ./scripts/setup_mac.sh
                </code>
              </div>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input mt-2"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
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
