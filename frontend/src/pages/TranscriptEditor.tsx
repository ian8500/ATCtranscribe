import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface Line {
  id: number;
  timestamp_hms: string;
  text: string;
  speaker_label_id?: number;
  flags_json?: Record<string, boolean>;
}

interface Label {
  id: number;
  name: string;
  color_hex: string;
}

export default function TranscriptEditor() {
  const [lines, setLines] = useState<Line[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    apiFetch<Line[]>("/api/transcripts/1/lines").then(setLines).catch(() => setLines([]));
    apiFetch<Label[]>("/api/transcripts/1/labels").then(setLabels).catch(() => setLabels([]));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="card flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Transcript Editor</h2>
            <p className="text-sm text-white/60">Upload, transcribe, edit, and finalize securely.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary">Upload WAV</button>
            <button className="btn btn-secondary">Transcribe</button>
            <button className="btn btn-primary">Export</button>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Dialogue Lines</h3>
            <button className="btn btn-secondary">Add Line</button>
          </div>
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">{line.timestamp_hms}</div>
                  <div className="flex gap-2">
                    {line.flags_json?.low_confidence && (
                      <span className="rounded-full bg-yellow-400/20 px-2 py-1 text-xs text-yellow-200">Low confidence</span>
                    )}
                    {line.flags_json?.redacted && (
                      <span className="rounded-full bg-red-400/20 px-2 py-1 text-xs text-red-200">Redacted</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-sm">{line.text}</div>
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-secondary">Split</button>
                  <button className="btn btn-secondary">Merge</button>
                </div>
              </div>
            ))}
            {!lines.length && <p className="text-sm text-white/50">No lines yet. Upload and transcribe a WAV.</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-lg font-semibold">Speaker Labels</h3>
          <div className="mt-3 space-y-2">
            {labels.map((label) => (
              <div key={label.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="text-sm">{label.name}</span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color_hex }} />
              </div>
            ))}
            {!labels.length && <p className="text-sm text-white/50">No labels created.</p>}
          </div>
          <button className="btn btn-secondary mt-4 w-full">Add label</button>
        </div>
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">Security Actions</h3>
          <button className="btn btn-secondary w-full">Mark as Completed</button>
          <p className="text-xs text-white/60">
            Completion permanently deletes the WAV file from storage.
          </p>
        </div>
        <div className="card space-y-3">
          <h3 className="text-lg font-semibold">Vocabulary & Exclude List</h3>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Dictionary</label>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Add ATC terms, callsigns, fixes"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Exclude List</label>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Words to redact"
            />
          </div>
          <button className="btn btn-secondary w-full">Save Lists</button>
        </div>
      </div>
    </div>
  );
}
