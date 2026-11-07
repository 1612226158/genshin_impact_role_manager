#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
素材预处理：把根目录 assets/ 下的 PNG/JPG 转为 WebP，输出到 public/assets/。

- 头像 icon（196x196）与 hd（686x800）保持原尺寸，质量 88
- 立绘 paintings 最长边限制 1400px，质量 85
- 原图不做任何修改，只读
- 增量：输出文件比源文件新则跳过

用法：
  <隔离环境 python> scripts/prepare_assets.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]          # 仓库根目录
SRC = ROOT / "assets"
DST = Path(__file__).resolve().parents[1] / "public" / "assets"

# 目录名 -> (最长边限制 or None, 质量)
RULES = {
    "avatars": (None, 88),
    "paintings": (1400, 85),
}

SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def convert_one(src: Path, dst: Path, max_edge: int | None, quality: int) -> bool:
    """返回 True 表示已转换，False 表示跳过。"""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return False

    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        # 统一到 RGB / RGBA，丢弃 CMYK、P 等模式副产物
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")

        if max_edge:
            w, h = im.size
            longest = max(w, h)
            if longest > max_edge:
                scale = max_edge / float(longest)
                im = im.resize(
                    (max(1, round(w * scale)), max(1, round(h * scale))),
                    Image.LANCZOS,
                )

        im.save(dst, "WEBP", quality=quality, method=6)
    return True


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024.0
    return f"{n:.1f} GB"


def main() -> int:
    if not SRC.exists():
        print(f"[错误] 源目录不存在：{SRC}")
        return 1

    t0 = time.time()
    total_in = total_out = 0
    converted = skipped = failed = 0
    per_dir: dict[str, list[int]] = {}

    for sub, (max_edge, quality) in RULES.items():
        src_dir = SRC / sub
        if not src_dir.exists():
            print(f"[跳过] {sub}：目录不存在")
            continue
        dst_dir = DST / sub
        din = dout = 0
        files = sorted(p for p in src_dir.iterdir() if p.suffix.lower() in SUFFIXES)

        for i, src in enumerate(files, 1):
            dst = dst_dir / (src.stem + ".webp")
            try:
                did = convert_one(src, dst, max_edge, quality)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"  [失败] {src.name}: {exc}")
                continue

            if did:
                converted += 1
            else:
                skipped += 1

            if dst.exists():
                din += src.stat().st_size
                dout += dst.stat().st_size

            if i % 50 == 0:
                print(f"  {sub}: {i}/{len(files)}")

        per_dir[sub] = [din, dout, len(files)]
        total_in += din
        total_out += dout
        print(f"[完成] {sub}: {len(files)} 个文件，{human(din)} -> {human(dout)}")

    print("-" * 52)
    print(f"转换 {converted} 个，跳过 {skipped} 个（已是最新），失败 {failed} 个")
    if total_in:
        ratio = (1 - total_out / total_in) * 100
        print(f"合计：{human(total_in)} -> {human(total_out)}（减少 {ratio:.1f}%）")
    print(f"耗时：{time.time() - t0:.1f}s")
    print(f"输出目录：{DST}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
