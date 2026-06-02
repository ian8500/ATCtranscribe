import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

interface Transcript {
  id: number;
  name: string;
  description?: string;
  owner_user_id: number;
  status: string;
  wav_filename?: string | null;
  created_at: string;
}

interface UserOption {
  id: number;
  name: string;
}

interface Line {
  id: number;
}

const statusClass: Record<string, string> = {
  Draft: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  InProgress: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  Completed: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [lineCounts, setLineCounts] = useState<Record<number, number>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const ownerName = (ownerId: number) => users.find((user) => user.id === ownerId)?.name || `User ${ownerId}`;

  const loadTranscripts = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTranscripts, nextUsers] = await Promise.all([
        apiFetch<Transcript[]>("/api/transcripts"),
        apiFetch<UserOption[]>("/api/auth/user-list"),
      ]);
      setTranscripts(nextTranscripts);
      setUsers(nextUsers);
      const counts = await Promise.all(
        nextTranscripts.map(async (transcript) => {
          try {
            const lines = await apiFetch<Line[]>(`/api/transcripts/${transcript.id}/lines`);
            return [transcript.id, lines.length] as const;
          } catch {
            return [transcript.id, 0] as const;
          }
        }),
      );
      setLineCounts(Object.fromEntries(counts));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load transcripts");
      setTranscripts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTranscripts();
  }, []);

  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((transcript) => {
      const text = `${transcript.name} ${transcript.description || ""} ${ownerName(transcript.owner_user_id)}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "all" || transcript.status === statusFilter;
      const matchesOwner = ownerFilter === "all" || String(transcript.owner_user_id) === ownerFilter;
      return matchesQuery && matchesStatus && matchesOwner;
    });
  }, [transcripts, users, query, statusFilter, ownerFilter]);

  const createTranscript = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const transcript = await apiFetch<Transcript>("/api/transcripts", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      });
      setShowCreate(false);
      setName("");
      setDescription("");
      navigate(`/transcripts/${transcript.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create transcript");
    }
  };

  const deleteTranscript = async (transcriptId: number) => {
    setBusyId(transcriptId);
    setError(null);
    try {
      await apiFetch(`/api/transcripts/${transcriptId}`, { method: "DELETE" });
      await loadTranscripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete transcript");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Workspace</p>
          <h2 className="mt-1 text-2xl font-semibold">Transcripts</h2>
          <p className="muted">Create, monitor, and open active ATC recordings.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          New Transcript
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="card grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, notes, owner" />
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
        <button className="btn btn-secondary" onClick={loadTranscripts}>
          Refresh
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Created</th>
              <th>WAV</th>
              <th>Lines</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              [0, 1, 2].map((item) => (
                <tr key={item}>
                  <td colSpan={7}>
                    <div className="h-6 animate-pulse rounded bg-white/10" />
                  </td>
                </tr>
              ))}
            {!loading &&
              filteredTranscripts.map((transcript) => (
                <tr key={transcript.id} className="hover:bg-white/[0.03]">
                  <td>
                    <div className="font-semibold">{transcript.name}</div>
                    <div className="mt-1 max-w-lg truncate text-xs text-white/45">{transcript.description || "No notes"}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${statusClass[transcript.status] || "border-white/20 bg-white/10 text-white/70"}`}>
                      {transcript.status}
                    </span>
                  </td>
                  <td>{ownerName(transcript.owner_user_id)}</td>
                  <td className="text-white/65">{new Date(transcript.created_at).toLocaleString()}</td>
                  <td>{transcript.wav_filename ? <span className="text-emerald-200">Yes</span> : <span className="text-white/40">No</span>}</td>
                  <td>{lineCounts[transcript.id] ?? 0}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => navigate(`/transcripts/${transcript.id}`)}>
                        Open
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteTranscript(transcript.id)} disabled={busyId === transcript.id}>
                        {busyId === transcript.id ? "Deleting" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && filteredTranscripts.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-white/50">
                  No transcripts match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel space-y-4" onSubmit={createTranscript}>
            <div>
              <p className="label">New recording</p>
              <h3 className="mt-1 text-lg font-semibold">Create Transcript</h3>
              <p className="muted">Name it clearly so it can be found during later review.</p>
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="EGLL tower evening bank" required />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input mt-2 min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Frequency, sector, airport, date, or recording context" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!name.trim()}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
