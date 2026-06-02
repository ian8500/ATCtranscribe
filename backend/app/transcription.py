from __future__ import annotations

from datetime import timedelta
import logging
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Iterable

from fastapi import HTTPException, status

from .audio import ensure_upload_dir, secure_delete_file
from .settings import get_settings


logger = logging.getLogger("atc.transcription")
settings = get_settings()

NO_SPEECH_THRESHOLD = 0.6
AVG_LOGPROB_THRESHOLD = -1.0
EXTREME_AVG_LOGPROB_THRESHOLD = -2.2
COMPRESSION_RATIO_THRESHOLD = 2.6
MAX_LINE_CHARS = 220

COMMON_ATC_TERMS = [
    "affirm",
    "negative",
    "roger",
    "wilco",
    "standby",
    "readback",
    "cleared for takeoff",
    "cleared to land",
    "line up and wait",
    "hold short",
    "taxi via",
    "pushback approved",
    "squawk",
    "QNH",
    "flight level",
    "heading",
    "climb and maintain",
    "descend and maintain",
    "contact tower",
    "contact ground",
    "approach",
    "departure",
    "runway",
    "left",
    "right",
    "center",
    "decimal",
    "traffic in sight",
    "go around",
    "missed approach",
]

LOCAL_ATC_VOCABULARY = [
    "runway zero four",
    "runway zero nine",
    "runway two seven",
    "runway two eight",
    "runway three six",
    "one two one decimal five",
    "one one eight decimal seven",
    "one two four decimal six",
    "flight level seven zero",
    "flight level one eight zero",
    "vehicle one",
    "ops one",
    "tower",
    "ground",
    "radar",
    "delivery",
]

DEFAULT_ATC_PROMPT = (
    "This is an aviation ATC radio transcript with short controller and pilot exchanges. "
    "Prefer ICAO-style wording, runway numbers, headings, flight levels, frequencies, "
    "squawk codes, readbacks, callsigns, aircraft registrations, and airport vehicles. "
    "Examples: Speedbird 123, EZY45AB, runway two seven left, heading zero niner zero, "
    "flight level one eight zero, contact tower one one eight decimal seven, hold short, "
    "line up and wait, cleared for takeoff, cleared to land."
)

_model_lock = threading.Lock()
_model: Any | None = None
_model_config: tuple[str, str, str, bool] | None = None


def hms_to_seconds(hms: str) -> int:
    parts = hms.split(":")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time format")
    hours, minutes, seconds = map(int, parts)
    if minutes > 59 or seconds > 59 or hours < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time value")
    return hours * 3600 + minutes * 60 + seconds


def seconds_to_hms(seconds: int) -> str:
    base = timedelta(seconds=seconds)
    total_seconds = int(base.total_seconds())
    h = (total_seconds // 3600) % 24
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def redact_excludes(text: str, exclude_list: list[str]) -> tuple[str, bool]:
    redacted = False
    for phrase in exclude_list:
        if not phrase:
            continue
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        if pattern.search(text):
            text = pattern.sub("[redacted]", text)
            redacted = True
    return text, redacted


def build_initial_prompt(vocabulary: list[str]) -> str:
    terms = []
    seen = set()
    for term in [*COMMON_ATC_TERMS, *LOCAL_ATC_VOCABULARY, *vocabulary]:
        normalized = term.strip()
        key = normalized.lower()
        if normalized and key not in seen:
            seen.add(key)
            terms.append(normalized)
    term_text = "; ".join(terms[:240])
    return f"{DEFAULT_ATC_PROMPT} Key vocabulary: {term_text}."


def get_whisper_model():
    global _model, _model_config
    config = (
        settings.whisper_model,
        settings.whisper_device,
        settings.whisper_compute_type,
        settings.whisper_local_only,
    )
    with _model_lock:
        if _model is not None and _model_config == config:
            return _model
        started = time.perf_counter()
        try:
            from faster_whisper import WhisperModel
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Whisper not installed") from exc

        logger.info(
            "Loading Whisper model=%s device=%s compute_type=%s local_only=%s",
            settings.whisper_model,
            settings.whisper_device,
            settings.whisper_compute_type,
            settings.whisper_local_only,
        )
        _model = WhisperModel(
            settings.whisper_model,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
            local_files_only=settings.whisper_local_only,
        )
        _model_config = config
        logger.info("Whisper model load completed in %.2fs", time.perf_counter() - started)
        return _model


def preprocess_audio(wav_path: str, transcript_id: int) -> str:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        logger.info("ffmpeg not found; using original WAV without preprocessing")
        return wav_path

    started = time.perf_counter()
    output_path = os.path.join(ensure_upload_dir(transcript_id), "preprocessed_16khz_mono.wav")
    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        wav_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-af",
        "highpass=f=280,lowpass=f=3800,afftdn=nf=-25",
        output_path,
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=300)
    except Exception as exc:
        logger.warning("Audio preprocessing failed; using original WAV: %s", exc)
        if os.path.exists(output_path):
            secure_delete_file(output_path)
        return wav_path
    logger.info("Audio preprocessing completed in %.2fs", time.perf_counter() - started)
    return output_path


def cleanup_preprocessed_audio(path: str, original_path: str) -> None:
    if path != original_path and Path(path).name.startswith("preprocessed_"):
        secure_delete_file(path)


def _metadata_flags(seg: Any) -> dict[str, Any]:
    flags: dict[str, Any] = {}
    no_speech_prob = getattr(seg, "no_speech_prob", None)
    avg_logprob = getattr(seg, "avg_logprob", None)
    compression_ratio = getattr(seg, "compression_ratio", None)
    if no_speech_prob is not None:
        flags["no_speech_prob"] = float(no_speech_prob)
    if avg_logprob is not None:
        flags["avg_logprob"] = float(avg_logprob)
    if compression_ratio is not None:
        flags["compression_ratio"] = float(compression_ratio)
    if (
        (avg_logprob is not None and avg_logprob < AVG_LOGPROB_THRESHOLD)
        or (compression_ratio is not None and compression_ratio > COMPRESSION_RATIO_THRESHOLD)
    ):
        flags["low_confidence"] = True
    return flags


def _word_flags(seg: Any, offset_seconds: int) -> dict[str, list[dict[str, Any]]]:
    words = getattr(seg, "words", None)
    if not words:
        return {}
    return {
        "words": [
            {
                "word": word.word,
                "start_hms": seconds_to_hms(offset_seconds + int(word.start)),
                "end_hms": seconds_to_hms(offset_seconds + int(word.end)),
                "probability": getattr(word, "probability", None),
            }
            for word in words[:120]
        ]
    }


def _split_text(text: str, max_chars: int = MAX_LINE_CHARS) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    parts = re.split(r"(?<=[.!?])\s+", text)
    lines: list[str] = []
    current = ""
    for part in parts:
        candidate = f"{current} {part}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        if len(part) <= max_chars:
            current = part
        else:
            words = part.split()
            current = ""
            for word in words:
                candidate = f"{current} {word}".strip()
                if len(candidate) > max_chars and current:
                    lines.append(current)
                    current = word
                else:
                    current = candidate
    if current:
        lines.append(current)
    return lines


def segment_to_lines(seg: Any, start_seconds: int, exclude_list: list[str]) -> list[dict]:
    no_speech_prob = getattr(seg, "no_speech_prob", None)
    avg_logprob = getattr(seg, "avg_logprob", None)
    if (
        no_speech_prob is not None
        and no_speech_prob > NO_SPEECH_THRESHOLD
        and (avg_logprob is None or avg_logprob < AVG_LOGPROB_THRESHOLD)
    ):
        return []

    raw_text = (getattr(seg, "text", "") or "").strip()
    flags = _metadata_flags(seg)
    if avg_logprob is not None and avg_logprob < EXTREME_AVG_LOGPROB_THRESHOLD and not raw_text:
        raw_text = "[unclear]"
        flags["low_confidence"] = True
    elif not raw_text:
        raw_text = "[unclear]"
        flags["low_confidence"] = True

    redacted_text, redacted = redact_excludes(raw_text, exclude_list)
    if redacted:
        flags["redacted"] = True
    flags.update(_word_flags(seg, start_seconds))

    line_time = seconds_to_hms(start_seconds + int(getattr(seg, "start", 0)))
    return [
        {"timestamp_hms": line_time, "text": line_text, "flags_json": dict(flags)}
        for line_text in _split_text(redacted_text)
    ]


def transcribe_audio(wav_path: str, start_time: str, exclude_list: list[str], vocabulary: list[str], transcript_id: int | None = None) -> list[dict]:
    model = get_whisper_model()
    start_seconds = hms_to_seconds(start_time)
    preprocessing_path = wav_path
    if transcript_id is not None:
        preprocessing_path = preprocess_audio(wav_path, transcript_id)

    try:
        initial_prompt = build_initial_prompt(vocabulary)
        hotwords = " ".join([*COMMON_ATC_TERMS, *LOCAL_ATC_VOCABULARY, *vocabulary[:80]])
        started = time.perf_counter()
        segments, _ = model.transcribe(
            preprocessing_path,
            language="en",
            temperature=(0.0, 0.2),
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 350, "speech_pad_ms": 250},
            condition_on_previous_text=False,
            initial_prompt=initial_prompt,
            hotwords=hotwords,
            word_timestamps=True,
            no_speech_threshold=NO_SPEECH_THRESHOLD,
            log_prob_threshold=AVG_LOGPROB_THRESHOLD,
            compression_ratio_threshold=COMPRESSION_RATIO_THRESHOLD,
        )
        results: list[dict] = []
        for seg in segments:
            results.extend(segment_to_lines(seg, start_seconds, exclude_list))
        logger.info("Whisper transcription completed in %.2fs", time.perf_counter() - started)
    finally:
        cleanup_preprocessed_audio(preprocessing_path, wav_path)

    if not results:
        results.append({"timestamp_hms": start_time, "text": "[unclear]", "flags_json": {"low_confidence": True}})
    return results
