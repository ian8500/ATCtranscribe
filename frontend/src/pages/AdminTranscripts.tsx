import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface Transcript {
  id: number;
  name: string;
  description?: string;
  status: string;
  owner_user_id: number;
}

export default function AdminTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    apiFetch<Transcript[]>("/api/transcripts").then(setTranscripts).catch(() => setTranscripts([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">All Transcripts</h2>
        <p className="text-sm text-white/60">Admin view across all users.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {transcripts.map((transcript) => (
          <div key={transcript.id} className="card">
            <h3 className="text-lg font-semibold">{transcript.name}</h3>
            <p className="text-sm text-white/60">Owner ID: {transcript.owner_user_id}</p>
            <p className="text-sm text-white/60">{transcript.description || "No description"}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{transcript.status}</span>
              <button className="btn btn-secondary">Open</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
