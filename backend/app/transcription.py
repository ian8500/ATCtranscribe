from datetime import timedelta
import re
from fastapi import HTTPException, status


NO_SPEECH_THRESHOLD = 0.6
AVG_LOGPROB_THRESHOLD = -1.0


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


def transcribe_audio(wav_path: str, start_time: str, exclude_list: list[str], vocabulary: list[str]) -> list[dict]:
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Whisper not installed") from exc

    model = WhisperModel("base", device="cpu", compute_type="int8")
    initial_prompt = None
    if vocabulary:
        initial_prompt = " ".join(vocabulary[:200])
    segments, _ = model.transcribe(
        wav_path,
        temperature=0.0,
        beam_size=5,
        vad_filter=True,
        initial_prompt=initial_prompt,
    )
    start_seconds = hms_to_seconds(start_time)
    results = []
    for seg in segments:
        if seg.no_speech_prob is not None and seg.no_speech_prob > NO_SPEECH_THRESHOLD:
            continue
        if seg.avg_logprob is not None and seg.avg_logprob < AVG_LOGPROB_THRESHOLD:
            text = "[unclear]"
            flags = {"low_confidence": True}
        else:
            text = seg.text.strip() or "[unclear]"
            flags = {}
        text, redacted = redact_excludes(text, exclude_list)
        if redacted:
            flags["redacted"] = True
        line_time = seconds_to_hms(start_seconds + int(seg.start))
        results.append({"timestamp_hms": line_time, "text": text, "flags_json": flags})
    if not results:
        results.append({"timestamp_hms": start_time, "text": "[unclear]", "flags_json": {"low_confidence": True}})
    return results
