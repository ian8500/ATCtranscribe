from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.transcription import (
    build_initial_prompt,
    hms_to_seconds,
    redact_excludes,
    seconds_to_hms,
    segment_to_lines,
    should_drop_segment,
    mean_word_probability_for_segment,
)


def test_time_conversion():
    assert hms_to_seconds("01:02:03") == 3723
    assert seconds_to_hms(3723) == "01:02:03"


def test_invalid_time_rejected():
    with pytest.raises(HTTPException):
        hms_to_seconds("00:61:00")


def test_redaction_is_case_insensitive():
    text, redacted = redact_excludes("Speedbird 123 contact tower", ["speedbird"])
    assert redacted is True
    assert text == "[redacted] 123 contact tower"


def test_atc_prompt_includes_defaults_and_vocabulary():
    prompt = build_initial_prompt(["Speedbird 123", "DAGGA"])
    assert "Do not invent" in prompt
    assert "runway" in prompt
    assert "Speedbird 123" in prompt
    assert "DAGGA" in prompt


def test_low_confidence_keeps_text_and_flags_metadata():
    segment = SimpleNamespace(
        start=12.4,
        text="Speedbird 123 descend flight level one eight zero",
        no_speech_prob=0.2,
        avg_logprob=-1.4,
        compression_ratio=1.1,
        words=[],
    )

    lines = segment_to_lines(segment, hms_to_seconds("09:00:00"), [])

    assert lines[0]["timestamp_hms"] == "09:00:12"
    assert lines[0]["text"] == "Speedbird 123 descend flight level one eight zero"
    assert lines[0]["flags_json"]["low_confidence"] is True
    assert lines[0]["flags_json"]["avg_logprob"] == -1.4
    assert lines[0]["flags_json"]["no_speech_prob"] == 0.2


def test_common_silence_hallucination_is_dropped():
    segment = SimpleNamespace(
        start=0,
        text="Thank you for watching",
        no_speech_prob=0.1,
        avg_logprob=-0.2,
        compression_ratio=1.0,
        words=[],
    )

    assert should_drop_segment(segment) is True
    assert segment_to_lines(segment, hms_to_seconds("09:00:00"), []) == []


def test_probable_silence_segment_is_dropped():
    segment = SimpleNamespace(
        start=0,
        text="cleared to land",
        no_speech_prob=0.8,
        avg_logprob=-0.9,
        compression_ratio=1.0,
        words=[],
    )

    assert should_drop_segment(segment) is True


def test_low_word_probability_segment_is_kept_and_flagged():
    segment = SimpleNamespace(
        start=0,
        text="Speedbird 123 cleared to land",
        no_speech_prob=0.1,
        avg_logprob=-0.2,
        compression_ratio=1.0,
        words=[
            SimpleNamespace(word="Speedbird", probability=0.02),
            SimpleNamespace(word="123", probability=0.04),
            SimpleNamespace(word="cleared", probability=0.03),
            SimpleNamespace(word="to", probability=0.02),
            SimpleNamespace(word="land", probability=0.04),
        ],
    )

    assert mean_word_probability_for_segment(segment) < 0.05
    assert should_drop_segment(segment) is False
    lines = segment_to_lines(segment, hms_to_seconds("09:00:00"), [])
    assert lines[0]["text"] == "Speedbird 123 cleared to land"
    assert lines[0]["flags_json"]["low_confidence"] is True
