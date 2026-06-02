#!/usr/bin/env python3
import math
import struct
import sys
import zlib


OUT = sys.argv[1]
SIZE = 1024
BG = (7, 17, 31)
pixels = bytearray(BG * SIZE * SIZE)


def set_px(x: int, y: int, color: tuple[int, int, int]) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        i = (y * SIZE + x) * 3
        pixels[i : i + 3] = bytes(color)


def blend(x: int, y: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        i = (y * SIZE + x) * 3
        pixels[i] = int(color[0] * alpha + pixels[i] * (1 - alpha))
        pixels[i + 1] = int(color[1] * alpha + pixels[i + 1] * (1 - alpha))
        pixels[i + 2] = int(color[2] * alpha + pixels[i + 2] * (1 - alpha))


def rounded_rect(x0: int, y0: int, x1: int, y1: int, radius: int, color: tuple[int, int, int]) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx = max(x0 + radius - x, 0, x - (x1 - radius - 1))
            dy = max(y0 + radius - y, 0, y - (y1 - radius - 1))
            if dx * dx + dy * dy <= radius * radius:
                set_px(x, y, color)


def circle(cx: int, cy: int, radius: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(x, y, color, alpha)


def line(x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int], width: int = 10) -> None:
    steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for step in range(steps + 1):
        t = step / steps
        circle(int(x0 + (x1 - x0) * t), int(y0 + (y1 - y0) * t), width // 2, color)


def arc(cx: int, cy: int, radius: int, start: int, end: int, color: tuple[int, int, int], width: int = 10) -> None:
    for degree in range(start, end):
        rad = math.radians(degree)
        circle(int(cx + math.cos(rad) * radius), int(cy + math.sin(rad) * radius), width // 2, color)


rounded_rect(70, 70, 954, 954, 190, (7, 17, 31))
rounded_rect(96, 96, 928, 928, 160, (14, 55, 82))
for y in range(96, 928):
    glow = int(34 * (1 - (y - 96) / 832))
    for x in range(96, 928):
        i = (y * SIZE + x) * 3
        pixels[i] = min(255, pixels[i] + glow)
        pixels[i + 1] = min(255, pixels[i + 1] + glow)
        pixels[i + 2] = min(255, pixels[i + 2] + glow)

arc(512, 512, 335, 205, 345, (56, 189, 248), 16)
arc(512, 512, 250, 25, 160, (29, 78, 216), 14)
line(512, 290, 512, 730, (224, 242, 254), 36)
line(320, 700, 704, 700, (224, 242, 254), 36)
line(370, 610, 654, 610, (186, 230, 253), 18)
line(410, 520, 614, 520, (186, 230, 253), 18)
line(480, 420, 544, 420, (186, 230, 253), 18)
line(512, 512, 740, 325, (56, 189, 248), 18)
circle(512, 512, 58, (224, 242, 254))
circle(740, 325, 44, (251, 191, 36))
line(205, 420, 300, 365, (147, 197, 253), 22)
line(300, 365, 390, 435, (147, 197, 253), 22)
line(390, 435, 275, 492, (147, 197, 253), 22)
line(275, 492, 205, 420, (147, 197, 253), 22)


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


raw = b"".join(b"\x00" + pixels[y * SIZE * 3 : (y + 1) * SIZE * 3] for y in range(SIZE))
png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(raw, 6))
png += chunk(b"IEND", b"")

with open(OUT, "wb") as handle:
    handle.write(png)
