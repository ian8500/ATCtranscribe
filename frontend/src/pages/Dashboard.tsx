import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface Transcript {
  id: number;
  name: string;
  description?: string;
  status: string;
}

export default function Dashboard() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    apiFetch<Transcript[]>("/api/transcripts").then(setTranscripts).catch(() => setTranscripts([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Transcripts</h2>
          <p className="text-sm text-white/60">Your secure ATC transcription workspace.</p>
        </div>
        <button className="btn btn-primary">New Transcript</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {transcripts.map((transcript) => (
          <div key={transcript.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{transcript.name}</h3>
                <p className="text-sm text-white/60">{transcript.description || "No description"}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{transcript.status}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-secondary">Open</button>
              <button className="btn btn-secondary">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
