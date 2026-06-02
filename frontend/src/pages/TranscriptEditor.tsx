import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiDownload, apiFetch, uploadFile } from "../api/client";

interface Transcript {
  id: number;
  name: string;
  description?: string;
  status: string;
  wav_filename?: string | null;
}

interface Line {
  id: number;
  order_index: number;
  timestamp_hms: string;
  text: string;
  speaker_label_id?: number | null;
  flags_json?: {
    low_confidence?: boolean;
    redacted?: boolean;
    [key: string]: unknown;
  };
}

interface Label {
  id: number;
  name: string;
  color_hex: string;
}

interface Entry {
  id: number;
  word_or_phrase: string;
}

interface TranscriptionJob {
  id: number;
  transcript_id: number;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  error?: string | null;
}

const emptyLine = {
  timestamp_hms: "00:00:00",
  speaker_label_id: "",
  text: "",
};

const defaultLabels = [
  { name: "ATCO", color_hex: "#38bdf8" },
  { name: "Aircraft 1", color_hex: "#f59e0b" },
  { name: "Aircraft 2", color_hex: "#a78bfa" },
  { name: "Vehicle", color_hex: "#22c55e" },
  { name: "Ops", color_hex: "#fb7185" },
  { name: "Unknown", color_hex: "#94a3b8" },
];

const vocabExamples = ["Speedbird 123", "runway two seven left", "taxiway Alpha", "one one eight decimal seven"];
const excludeExamples = ["phone number", "personal name", "company account", "private address"];

export default function TranscriptEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const transcriptId = Number(id);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [vocabulary, setVocabulary] = useState<Entry[]>([]);
  const [exclude, setExclude] = useState<Entry[]>([]);
  const [newLine, setNewLine] = useState(emptyLine);
  const [newLabel, setNewLabel] = useState({ name: "", color_hex: "#38bdf8" });
  const [newVocab, setNewVocab] = useState("");
  const [newExclude, setNewExclude] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [wavFile, setWavFile] = useState<File | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);
  const isCompleted = transcript?.status === "Completed";

  const showError = (err: unknown, fallback: string) => {
    setError(err instanceof Error ? err.message : fallback);
  };

  const loadTranscript = async () => {
    const nextTranscript = await apiFetch<Transcript>(`/api/transcripts/${transcriptId}`);
    setTranscript(nextTranscript);
    return nextTranscript;
  };

  const loadLines = async () => {
    setLines(await apiFetch<Line[]>(`/api/transcripts/${transcriptId}/lines`));
  };

  const loadLists = async (allowDefaultLabels = !isCompleted) => {
    const [nextLabels, nextVocabulary, nextExclude] = await Promise.all([
      apiFetch<Label[]>(`/api/transcripts/${transcriptId}/labels`),
      apiFetch<Entry[]>(`/api/transcripts/${transcriptId}/vocabulary`),
      apiFetch<Entry[]>(`/api/transcripts/${transcriptId}/exclude`),
    ]);
    if (nextLabels.length === 0 && allowDefaultLabels) {
      const createdLabels = await Promise.all(
        defaultLabels.map((label) =>
          apiFetch<Label>(`/api/transcripts/${transcriptId}/labels`, {
            method: "POST",
            body: JSON.stringify(label),
          }),
        ),
      );
      setLabels(createdLabels);
    } else {
      setLabels(nextLabels);
    }
    setVocabulary(nextVocabulary);
    setExclude(nextExclude);
  };

  const loadJob = async () => {
    try {
      const latestJob = await apiFetch<TranscriptionJob>(`/api/transcripts/${transcriptId}/transcription-job`);
      setJob(latestJob);
      return latestJob;
    } catch {
      setJob(null);
      return null;
    }
  };

  const loadAll = async () => {
    setError(null);
    try {
      const nextTranscript = await loadTranscript();
      await Promise.all([loadLines(), loadLists(nextTranscript.status !== "Completed"), loadJob()]);
    } catch (err) {
      showError(err, "Could not load transcript");
    }
  };

  useEffect(() => {
    if (!Number.isInteger(transcriptId) || transcriptId <= 0) {
      setError("Invalid transcript route");
      return;
    }
    loadAll();
  }, [transcriptId]);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) {
      return;
    }
    const interval = window.setInterval(async () => {
      const latestJob = await loadJob();
      if (latestJob?.status === "completed") {
        setMessage("Transcription complete");
        await Promise.all([loadTranscript(), loadLines()]);
      }
      if (latestJob?.status === "failed") {
        setError(latestJob.error || "Transcription failed");
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [job?.id, job?.status, transcriptId]);

  useEffect(() => {
    if (!transcript?.wav_filename || isCompleted) {
      setAudioUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let mounted = true;
    apiDownload(`/api/transcripts/${transcriptId}/audio`)
      .then((blob) => {
        if (!mounted) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch(() => {
        if (mounted) {
          setAudioUrl(null);
        }
      });

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [transcriptId, transcript?.wav_filename, transcript?.status, isCompleted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioUrl]);

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      showError(err, "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const uploadWav = async (event: FormEvent) => {
    event.preventDefault();
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before uploading audio.");
      return;
    }
    if (!wavFile) {
      setError("Choose a WAV file before uploading");
      return;
    }
    await runAction("upload", async () => {
      setUploadProgress(0);
      await uploadFile(`/api/transcripts/${transcriptId}/upload-wav`, wavFile, setUploadProgress);
      setMessage("WAV uploaded");
      setWavFile(null);
      setUploadProgress(100);
      await loadTranscript();
    });
  };

  const transcribe = async (event: FormEvent) => {
    event.preventDefault();
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before transcribing.");
      return;
    }
    await runAction("transcribe", async () => {
      const startedJob = await apiFetch<TranscriptionJob>(`/api/transcripts/${transcriptId}/transcribe`, {
        method: "POST",
        body: JSON.stringify({ start_time: startTime }),
      });
      setJob(startedJob);
      setMessage("Transcription started");
    });
  };

  const jogAudio = (seconds: number) => {
    if (!audioRef.current) {
      return;
    }
    const nextTime = Math.max(0, Math.min(audioRef.current.duration || Number.MAX_SAFE_INTEGER, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = nextTime;
  };

  const updateLineState = (lineId: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const saveLine = async (line: Line) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before editing lines.");
      return;
    }
    setSavingLineId(line.id);
    await runAction(`line-${line.id}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/lines/${line.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          timestamp_hms: line.timestamp_hms,
          speaker_label_id: line.speaker_label_id || null,
          text: line.text,
        }),
      });
      setMessage("Line saved");
      await loadLines();
    });
    setSavingLineId(null);
  };

  const addLine = async (event: FormEvent) => {
    event.preventDefault();
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before adding lines.");
      return;
    }
    await runAction("add-line", async () => {
      await apiFetch<Line>(`/api/transcripts/${transcriptId}/lines`, {
        method: "POST",
        body: JSON.stringify({
          order_index: lines.length,
          timestamp_hms: newLine.timestamp_hms,
          speaker_label_id: newLine.speaker_label_id ? Number(newLine.speaker_label_id) : null,
          text: newLine.text,
        }),
      });
      setNewLine({ ...emptyLine, timestamp_hms: newLine.timestamp_hms });
      await loadLines();
    });
  };

  const deleteLine = async (lineId: number) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before deleting lines.");
      return;
    }
    await runAction(`delete-line-${lineId}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/lines/${lineId}`, { method: "DELETE" });
      await loadLines();
    });
  };

  const splitLine = async (line: Line) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before splitting lines.");
      return;
    }
    const splitAt = Number(window.prompt("Split after character number", String(Math.floor(line.text.length / 2))));
    if (!Number.isInteger(splitAt)) {
      return;
    }
    await runAction(`split-line-${line.id}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/lines/${line.id}/split`, {
        method: "POST",
        body: JSON.stringify({ line_id: line.id, split_index: splitAt }),
      });
      await loadLines();
    });
  };

  const mergeWithNext = async (line: Line) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before merging lines.");
      return;
    }
    const nextLine = lines.find((candidate) => candidate.order_index === line.order_index + 1);
    if (!nextLine) {
      setError("There is no following line to merge");
      return;
    }
    await runAction(`merge-line-${line.id}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/lines/merge`, {
        method: "POST",
        body: JSON.stringify({
          first_line_id: line.id,
          second_line_id: nextLine.id,
          keep_label_id: line.speaker_label_id || nextLine.speaker_label_id || null,
        }),
      });
      await loadLines();
    });
  };

  const addLabel = async (event: FormEvent) => {
    event.preventDefault();
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before changing labels.");
      return;
    }
    await runAction("add-label", async () => {
      await apiFetch<Label>(`/api/transcripts/${transcriptId}/labels`, {
        method: "POST",
        body: JSON.stringify(newLabel),
      });
      setNewLabel({ name: "", color_hex: "#38bdf8" });
      await loadLists();
    });
  };

  const saveLabel = async (label: Label) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before changing labels.");
      return;
    }
    await runAction(`label-${label.id}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/labels/${label.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: label.name, color_hex: label.color_hex }),
      });
      await loadLists();
    });
  };

  const updateLabelState = (labelId: number, patch: Partial<Label>) => {
    setLabels((current) => current.map((label) => (label.id === labelId ? { ...label, ...patch } : label)));
  };

  const addEntry = async (kind: "vocabulary" | "exclude", phrase: string, reset: () => void) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before changing vocabulary.");
      return;
    }
    if (!phrase.trim()) {
      return;
    }
    await runAction(`add-${kind}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/${kind}`, {
        method: "POST",
        body: JSON.stringify({ word_or_phrase: phrase.trim() }),
      });
      reset();
      await loadLists();
    });
  };

  const deleteEntry = async (kind: "vocabulary" | "exclude", entryId: number) => {
    if (isCompleted) {
      setError("Completed transcripts are locked. Reopen from Admin Transcripts before changing vocabulary.");
      return;
    }
    await runAction(`delete-${kind}-${entryId}`, async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/${kind}/${entryId}`, { method: "DELETE" });
      await loadLists();
    });
  };

  const exportDocx = async () => {
    await runAction("export", async () => {
      const blob = await apiDownload(`/api/transcripts/${transcriptId}/export`, { method: "POST" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${transcript?.name || "transcript"}-${transcriptId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("DOCX exported");
    });
  };

  const markComplete = async () => {
    await runAction("complete", async () => {
      await apiFetch(`/api/transcripts/${transcriptId}/mark-complete`, { method: "POST" });
      setMessage("Transcript completed and WAV deleted");
      setShowCompleteConfirm(false);
      await loadTranscript();
    });
  };

  if (!Number.isInteger(transcriptId) || transcriptId <= 0) {
    return <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">Invalid transcript route.</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="space-y-4">
        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button className="mb-3 text-sm text-white/60 hover:text-white" onClick={() => navigate("/")}>
                Back to dashboard
              </button>
              <h2 className="text-2xl font-semibold">{transcript?.name || "Transcript Editor"}</h2>
              <p className="text-sm text-white/60">
                {transcript?.description || "Upload, transcribe, edit, and finalize securely."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="status-pill border-sky-400/30 bg-sky-500/10 text-sky-100">{transcript?.status || "Loading"}</span>
                <span className="status-pill border-white/10 bg-white/[0.06] text-white/65">
                  {transcript?.wav_filename ? `WAV ${transcript.wav_filename}` : "No WAV uploaded"}
                </span>
                {isCompleted && <span className="status-pill border-emerald-400/30 bg-emerald-500/10 text-emerald-100">Editing locked</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-secondary" onClick={exportDocx} disabled={busy === "export"}>
                {busy === "export" ? "Exporting" : "Export DOCX"}
              </button>
              <button className="btn btn-primary" onClick={() => setShowCompleteConfirm(true)} disabled={busy === "complete" || isCompleted}>
                Mark Completed
              </button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
          {message && <div className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <form className="card space-y-3" onSubmit={uploadWav}>
              <h3 className="text-lg font-semibold">Upload WAV</h3>
              <p className="text-xs text-white/45">Original WAV is retained until the transcript is marked completed.</p>
              <input
                type="file"
                accept=".wav,audio/wav,audio/x-wav"
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
                onChange={(event) => setWavFile(event.target.files?.[0] || null)}
                disabled={isCompleted}
              />
              <div className="flex items-center justify-between text-xs text-white/50">
                <span className="truncate">{wavFile?.name || transcript?.wav_filename || "No file selected"}</span>
                {busy === "upload" && <span>{uploadProgress}%</span>}
              </div>
              {(busy === "upload" || uploadProgress > 0) && (
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-accent transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <button className="btn btn-secondary w-full" disabled={!wavFile || busy === "upload" || isCompleted}>
                {busy === "upload" ? "Uploading" : "Upload WAV"}
              </button>
            </form>
            <div className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">WAV Playback</h3>
                  <p className="text-xs text-white/45">Review audio while correcting transcript lines.</p>
                </div>
                <select className="select w-28" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} disabled={!audioUrl}>
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                </select>
              </div>
              {audioUrl ? (
                <>
                  <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                  <div className="grid grid-cols-4 gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => jogAudio(-10)}>
                      -10s
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => jogAudio(-5)}>
                      -5s
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => jogAudio(5)}>
                      +5s
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => jogAudio(10)}>
                      +10s
                    </button>
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/50">
                  Upload a WAV to enable playback. Completed transcripts have no retained audio.
                </p>
              )}
            </div>
          </div>
          <form className="card space-y-3" onSubmit={transcribe}>
            <h3 className="text-lg font-semibold">Transcribe</h3>
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55">
              Accuracy mode: conservative decoding, no prompt/hotwords by default, mono 16kHz ATC-band preprocessing when ffmpeg is available
            </div>
            <label className="text-xs uppercase text-white/50">Recording start time</label>
            <input
              className="input"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              placeholder="HH:MM:SS"
              pattern="\d{2}:\d{2}:\d{2}"
              disabled={isCompleted}
            />
            <button className="btn btn-secondary w-full" disabled={busy === "transcribe" || isCompleted}>
              {busy === "transcribe" ? "Starting" : lines.length ? "Re-transcribe" : "Transcribe"}
            </button>
            {job && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Job {job.status}</span>
                  <span>{job.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-accent transition-all" style={{ width: `${job.progress}%` }} />
                </div>
                {job.error && <p className="text-xs text-red-200">{job.error}</p>}
              </div>
            )}
          </form>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Dialogue Lines</h3>
            <span className="text-xs text-white/50">{lines.length} lines</span>
          </div>
          <form className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3 lg:grid-cols-[120px_160px_1fr_auto]" onSubmit={addLine}>
            <input
              className="input"
              value={newLine.timestamp_hms}
              onChange={(event) => setNewLine({ ...newLine, timestamp_hms: event.target.value })}
              pattern="\d{2}:\d{2}:\d{2}"
              disabled={isCompleted}
              required
            />
            <select
              className="select"
              value={newLine.speaker_label_id}
              onChange={(event) => setNewLine({ ...newLine, speaker_label_id: event.target.value })}
              disabled={isCompleted}
            >
              <option value="">Unassigned</option>
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={newLine.text}
              onChange={(event) => setNewLine({ ...newLine, text: event.target.value })}
              placeholder="Add transcript line"
              disabled={isCompleted}
              required
            />
            <button className="btn btn-secondary" disabled={busy === "add-line" || isCompleted}>
              Add Line
            </button>
          </form>
          <div className="space-y-3">
            {lines.map((line) => {
              const label = line.speaker_label_id ? labelById.get(line.speaker_label_id) : null;
              return (
                <div key={line.id} className="rounded-lg border border-white/10 bg-white/5 p-4" style={{ borderLeftColor: label?.color_hex || "rgba(255,255,255,0.12)", borderLeftWidth: 4 }}>
                  <div className="grid gap-3 lg:grid-cols-[120px_160px_1fr]">
                    <input
                      className="input font-mono"
                      value={line.timestamp_hms}
                      onChange={(event) => updateLineState(line.id, { timestamp_hms: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveLine(line);
                        }
                      }}
                      pattern="\d{2}:\d{2}:\d{2}"
                      disabled={isCompleted}
                    />
                    <select
                      className="select"
                      value={line.speaker_label_id || ""}
                      onChange={(event) => updateLineState(line.id, { speaker_label_id: event.target.value ? Number(event.target.value) : null })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveLine(line);
                        }
                      }}
                      disabled={isCompleted}
                    >
                      <option value="">Unassigned</option>
                      {labels.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="input min-h-20 resize-y leading-6"
                      value={line.text}
                      onChange={(event) => updateLineState(line.id, { text: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          saveLine(line);
                        }
                        if (event.key === "Enter" && event.metaKey) {
                          event.preventDefault();
                          saveLine(line);
                        }
                      }}
                      disabled={isCompleted}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                      {label && (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color_hex }} />
                          <span style={{ color: label.color_hex }}>{label.name}</span>
                        </span>
                      )}
                      {line.flags_json?.low_confidence && <span className="rounded-full bg-yellow-400/20 px-2 py-1 text-yellow-100">Low confidence</span>}
                      {line.flags_json?.redacted && <span className="rounded-full bg-red-400/20 px-2 py-1 text-red-100">Redacted</span>}
                      {savingLineId === line.id && <span className="text-sky-200">Saving...</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-secondary" onClick={() => saveLine(line)} disabled={busy === `line-${line.id}` || isCompleted}>
                        {savingLineId === line.id ? "Saving" : "Save"}
                      </button>
                      <button className="btn btn-secondary" onClick={() => splitLine(line)} disabled={isCompleted}>
                        Split
                      </button>
                      <button className="btn btn-secondary" onClick={() => mergeWithNext(line)} disabled={isCompleted}>
                        Merge Next
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteLine(line.id)} disabled={isCompleted}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!lines.length && <p className="text-sm text-white/50">No lines yet. Upload and transcribe a WAV or add a line manually.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Speaker Labels</h3>
            <p className="text-xs text-white/45">Apply colours to keep controller, aircraft, and vehicle exchanges scannable.</p>
          </div>
          <form className="grid grid-cols-[1fr_64px_auto] gap-2" onSubmit={addLabel}>
            <input
              className="input"
              value={newLabel.name}
              onChange={(event) => setNewLabel({ ...newLabel, name: event.target.value })}
              placeholder="Pilot, Tower, Ground"
              disabled={isCompleted}
              required
            />
            <input
              type="color"
              className="h-10 w-full rounded-md border border-white/10 bg-white/5"
              value={newLabel.color_hex}
              onChange={(event) => setNewLabel({ ...newLabel, color_hex: event.target.value })}
              disabled={isCompleted}
            />
            <button className="btn btn-secondary" disabled={isCompleted}>Add</button>
          </form>
          <div className="space-y-2">
            {labels.map((label) => (
              <div key={label.id} className="grid grid-cols-[1fr_64px_auto] gap-2">
                <input
                  className="input"
                  value={label.name}
                  onChange={(event) => updateLabelState(label.id, { name: event.target.value })}
                  disabled={isCompleted}
                />
                <input
                  type="color"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/5"
                  value={label.color_hex}
                  onChange={(event) => updateLabelState(label.id, { color_hex: event.target.value })}
                  disabled={isCompleted}
                />
                <button className="btn btn-secondary" onClick={() => saveLabel(label)} disabled={isCompleted}>
                  Save
                </button>
              </div>
            ))}
            {!labels.length && <p className="text-sm text-white/50">No labels created.</p>}
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Vocabulary</h3>
            <p className="text-xs text-white/45">Hints sent into Whisper before transcription.</p>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); addEntry("vocabulary", newVocab, () => setNewVocab("")); }}>
            <input
              className="input min-w-0 flex-1"
              value={newVocab}
              onChange={(event) => setNewVocab(event.target.value)}
              placeholder="Callsigns, fixes, runway terms"
              disabled={isCompleted}
            />
            <button className="btn btn-secondary" disabled={isCompleted}>Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {vocabExamples.map((example) => (
              <button key={example} className="chip border-sky-400/20 text-sky-100" onClick={() => setNewVocab(example)} disabled={isCompleted}>
                {example}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {vocabulary.map((entry) => (
              <button key={entry.id} className="chip" onClick={() => deleteEntry("vocabulary", entry.id)} disabled={isCompleted}>
                {entry.word_or_phrase} x
              </button>
            ))}
            {!vocabulary.length && <p className="text-sm text-white/50">No dictionary entries.</p>}
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Exclude List</h3>
            <p className="text-xs text-white/45">Matched terms are redacted in generated lines.</p>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); addEntry("exclude", newExclude, () => setNewExclude("")); }}>
            <input
              className="input min-w-0 flex-1"
              value={newExclude}
              onChange={(event) => setNewExclude(event.target.value)}
              placeholder="Words or phrases to redact"
              disabled={isCompleted}
            />
            <button className="btn btn-secondary" disabled={isCompleted}>Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {excludeExamples.map((example) => (
              <button key={example} className="chip border-red-400/20 text-red-100" onClick={() => setNewExclude(example)} disabled={isCompleted}>
                {example}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {exclude.map((entry) => (
              <button key={entry.id} className="chip" onClick={() => deleteEntry("exclude", entry.id)} disabled={isCompleted}>
                {entry.word_or_phrase} x
              </button>
            ))}
            {!exclude.length && <p className="text-sm text-white/50">No redaction entries.</p>}
          </div>
        </div>
      </div>
      {showCompleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel space-y-4">
            <div>
              <p className="label">Finalise transcript</p>
              <h3 className="mt-1 text-lg font-semibold">Mark Completed</h3>
              <p className="mt-2 text-sm text-white/65">
                Completing this transcript will permanently delete the uploaded WAV audio from local storage. Editing, upload, and transcription controls will be locked unless an admin reopens the transcript.
              </p>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Review speaker labels, redactions, and exported DOCX output before finalising.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowCompleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={markComplete} disabled={busy === "complete"}>
                {busy === "complete" ? "Completing" : "Confirm Completion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
