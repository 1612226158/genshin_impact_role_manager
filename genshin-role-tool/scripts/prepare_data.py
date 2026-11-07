#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
数据预处理：chars.json -> src/data/characters.json

做四件事：
1. 图片路径由 .png/.jpg/.jpeg 改写为 .webp（与 prepare_assets.py 产出对应）
2. 丢弃 story.full（内容 == sections 拼接 + 分节标题，可无损重建）
3. 生日解析为 birthdayMonth / birthdayDay（"——" 解析失败则为 null）
4. 标记 playable：无元素或无星级者视为非可玩条目（当前命中「奇偶·男性/女性」2 条）

同时做完整性校验：图片引用是否齐全、国度计数是否一致。

用法：
  <隔离环境 python> scripts/prepare_data.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parent
SRC = ROOT / "characters.json"
OUT = HERE / "src" / "data" / "characters.json"
PUBLIC = HERE / "public"

BIRTHDAY_RE = re.compile(r"^\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*$")


def to_webp(path: str | None) -> str | None:
    if not path:
        return path
    return re.sub(r"\.(png|jpe?g)$", ".webp", path, flags=re.I)


def main() -> int:
    if not SRC.exists():
        print(f"[错误] 找不到源数据：{SRC}")
        return 1

    raw = json.loads(SRC.read_text(encoding="utf-8"))
    chars = raw["characters"]
    problems: list[str] = []

    for c in chars:
        # ---- 图片路径 ----
        im = c.setdefault("images", {})
        im["avatar"] = to_webp(im.get("avatar"))
        im["avatar_hd"] = to_webp(im.get("avatar_hd"))
        im["paintings"] = [
            {**p, "file": to_webp(p.get("file"))} for p in (im.get("paintings") or [])
        ]

        # ---- 故事：去冗余 full ----
        st = c.get("story") or {}
        st.pop("full", None)
        if not st.get("sections"):
            st["sections"] = []
        c["story"] = st

        # ---- 生日解析 ----
        raw_bd = (c.get("birthday") or "").strip()
        m = BIRTHDAY_RE.match(raw_bd)
        c["birthdayMonth"] = int(m.group(1)) if m else None
        c["birthdayDay"] = int(m.group(2)) if m else None

        # ---- 可玩性 ----
        c["playable"] = bool(c.get("element") and c.get("star"))

        # ---- CV 规范化 ----
        cv = c.get("cv")
        c["cv"] = cv if isinstance(cv, dict) else {}

        # ---- 图片文件存在性 ----
        for key in ("avatar", "avatar_hd"):
            p = im.get(key)
            if p and not (HERE / "public" / p).exists() and not (ROOT / p).exists():
                problems.append(f"{c['name']} 缺 {key}: {p}")
        for p in im["paintings"]:
            f = p.get("file")
            if f and not (HERE / "public" / f).exists() and not (ROOT / f).exists():
                problems.append(f"{c['name']} 缺立绘: {f}")

    # ---- 国度计数校验 ----
    actual = Counter(c["nation"] for c in chars)
    for name, meta in (raw.get("nations") or {}).items():
        if meta.get("count") != actual.get(name, 0):
            problems.append(
                f"国度计数不一致 {name}: 声明 {meta.get('count')} / 实际 {actual.get(name, 0)}"
            )

    # ---- 输出 ----
    payload = {
        "meta": {
            **raw.get("meta", {}),
            "generated": "构建期由 scripts/prepare_data.py 生成，请勿手工编辑",
            "total": len(chars),
        },
        "nations": raw.get("nations", {}),
        "characters": chars,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    size = OUT.stat().st_size
    playable = sum(1 for c in chars if c["playable"])
    with_bd = sum(1 for c in chars if c["birthdayMonth"])
    print(f"[输出] {OUT}")
    print(f"       条目 {len(chars)}（可玩 {playable}） / 体积 {size / 1048576:.2f} MB")
    print(f"       生日可解析 {with_bd} / {len(chars)}")
    print(f"       元素分布 {dict(Counter(c.get('element') or '无' for c in chars))}")
    print(f"       星级分布 {dict(Counter(str(c.get('star') or '无') for c in chars))}")
    if problems:
        print(f"[警告] {len(problems)} 项问题：")
        for p in problems[:20]:
            print("   -", p)
        return 2
    print("[校验] 图片引用与国度计数全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
