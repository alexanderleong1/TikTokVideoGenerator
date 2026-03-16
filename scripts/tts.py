"""
tts.py — Edge TTS with per-word timing.

Usage:
  python3 scripts/tts.py <voice> <audio_path> <text>

Writes MP3 to <audio_path> and prints JSON word timings to stdout:
  [{"word": "Hello", "startMs": 100, "endMs": 350}, ...]
"""

import asyncio
import json
import sys

import edge_tts


async def main() -> None:
    voice = sys.argv[1]
    audio_path = sys.argv[2]
    text = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"

    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, boundary="WordBoundary")
    word_timings: list[dict] = []

    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                word_timings.append(
                    {
                        "word": chunk["text"],
                        "startMs": chunk["offset"] // 10000,
                        "endMs": (chunk["offset"] + chunk["duration"]) // 10000,
                    }
                )

    print(json.dumps(word_timings))


asyncio.run(main())
