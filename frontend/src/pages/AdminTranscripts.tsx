import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

interface Transcript {
  id: number;
  name: string;
  description?: string;
  status: string;
  owner_user_id: number;
  wav_filename?: string | null;
  created_at: string;
}

interface User {
  id: number;
  name: string;
}

const statusClass: Record<string, string> = {
  Draft: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  InProgress: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  Completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
};

export default function AdminTranscripts() {
  const navigate = useNavigate();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const ownerName = (ownerId: number) => users.find((user) => user.id === ownerId)?.name || `User ${ownerId}`;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTranscripts, nextUsers] = await Promise.all([
        apiFetch<Transcript[]>("/api/transcripts"),
        apiFetch<User[]>("/api/users"),
      ]);
      setTranscripts(nextTranscripts);
      setUsers(nextUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin transcript data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((transcript) => {
      const matchesQuery = `${transcript.name} ${transcript.description || ""} ${ownerName(transcript.owner_user_id)}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || transcript.status === statusFilter;
      const matchesOwner = ownerFilter === "all" || String(transcript.owner_user_id) === ownerFilter;
      return matchesQuery && matchesStatus && matchesOwner;
    });
  }, [transcripts, users, query, statusFilter, ownerFilter]);

  const reopenTranscript = async (transcriptId: number) => {
    setBusyId(transcriptId);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/transcripts/${transcriptId}/reopen`, { method: "POST" });
      setMessage("Transcript reopened");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen transcript");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Admin</p>
          <h2 className="mt-1 text-2xl font-semibold">All Transcripts</h2>
          <p className="muted">Review ownership, state, and completed audio retention across the workspace.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          Refresh
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>}

      <div className="card grid gap-3 lg:grid-cols-[1fr_180px_180px]">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transcripts, notes, owners" />
        <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="InProgress">In progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select className="select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          <option value="all">All owners</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transcript</th>
              <th>Owner</th>
              <th>Status</th>
              <th>WAV</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>
                  <div className="h-6 animate-pulse rounded bg-white/10" />
                </td>
              </tr>
            )}
            {!loading &&
              filteredTranscripts.map((transcript) => (
                <tr key={transcript.id} className="hover:bg-white/[0.03]">
                  <td>
                    <div className="font-semibold">{transcript.name}</div>
                    <div className="mt-1 max-w-md truncate text-xs text-white/45">{transcript.description || "No notes"}</div>
                  </td>
                  <td>{ownerName(transcript.owner_user_id)}</td>
                  <td>
                    <span className={`status-pill ${statusClass[transcript.status] || "border-white/20 bg-white/10 text-white/70"}`}>{transcript.status}</span>
                  </td>
                  <td>{transcript.wav_filename ? <span className="text-emerald-200">Stored</span> : <span className="text-white/40">None</span>}</td>
                  <td className="text-white/65">{new Date(transcript.created_at).toLocaleString()}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => navigate(`/transcripts/${transcript.id}`)}>
                        Open
                      </button>
                      <button className="btn btn-secondary" onClick={() => reopenTranscript(transcript.id)} disabled={busyId === transcript.id || transcript.status !== "Completed"}>
                        {busyId === transcript.id ? "Reopening" : "Reopen"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filteredTranscripts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-white/50">
                  No transcripts match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
