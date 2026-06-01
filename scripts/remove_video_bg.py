#!/usr/bin/env python3
"""Remove video background frame-by-frame; output WebM with alpha (lion only)."""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image
from rembg import remove, new_session
from tqdm import tqdm


def process_video(input_path: str, output_path: str, model: str = "u2net", max_width: int = 960) -> None:
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    scale = min(1.0, max_width / src_w) if max_width else 1.0
    proc_w = max(2, int(src_w * scale))
    proc_h = max(2, int(src_h * scale))

    session = new_session(model)
    tmp_dir = tempfile.mkdtemp(prefix="lion-bg-")
    frame_idx = 0

    try:
        for _ in tqdm(range(frame_count), desc="Removing background", unit="frame"):
            ok, frame = cap.read()
            if not ok:
                break

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            if scale != 1.0:
                frame_rgb = cv2.resize(frame_rgb, (proc_w, proc_h), interpolation=cv2.INTER_AREA)

            pil = Image.fromarray(frame_rgb)
            rgba = remove(pil, session=session)
            rgba_np = np.array(rgba)

            if scale != 1.0:
                rgba_np = cv2.resize(rgba_np, (src_w, src_h), interpolation=cv2.INTER_LINEAR)

            out_path = os.path.join(tmp_dir, f"frame_{frame_idx:05d}.png")
            Image.fromarray(rgba_np).save(out_path, optimize=True)
            frame_idx += 1

        cap.release()

        if frame_idx == 0:
            raise RuntimeError("No frames processed")

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        cmd = [
            ffmpeg,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            os.path.join(tmp_dir, "frame_%05d.png"),
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuva420p",
            "-auto-alt-ref",
            "0",
            "-b:v",
            "2M",
            output_path,
        ]
        subprocess.run(cmd, check=True)
        print(f"Saved: {output_path} ({frame_idx} frames @ {fps:.2f} fps)")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Remove video background (transparent lion)")
    parser.add_argument("input", help="Input video path")
    parser.add_argument(
        "-o",
        "--output",
        help="Output WebM path (default: same name with -nobg.webm)",
    )
    parser.add_argument("--model", default="u2net", help="rembg model (default: u2net)")
    parser.add_argument("--max-width", type=int, default=960, help="Process width for speed")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    if args.output:
        output_path = os.path.abspath(args.output)
    else:
        base, _ = os.path.splitext(input_path)
        output_path = f"{base}-nobg.webm"

    process_video(input_path, output_path, model=args.model, max_width=args.max_width)
    return 0


if __name__ == "__main__":
    sys.exit(main())
