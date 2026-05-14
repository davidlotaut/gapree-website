#!/usr/bin/env python3
"""
Génère data/_bundle.js à partir des JSON.

Les pages HTML peuvent ainsi être ouvertes en file:// sans CORS errors.
À relancer après chaque édition d'un fichier JSON.

Usage : python3 data/build_bundle.py
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = ["artisans", "actualites", "histoire", "mairie"]


def main():
    bundle = ["// Auto-généré par data/build_bundle.py — ne pas éditer à la main\n"]
    for name in SOURCES:
        path = HERE / f"{name}.json"
        if not path.exists():
            print(f"[skip] {path.name} introuvable")
            continue
        data = json.loads(path.read_text())
        js_var = f"DATA_{name.upper()}"
        bundle.append(f"window.{js_var} = {json.dumps(data, ensure_ascii=False, indent=2)};\n")
    (HERE / "_bundle.js").write_text("\n".join(bundle))
    print(f"[ok] data/_bundle.js régénéré ({len(SOURCES)} datasets)")


if __name__ == "__main__":
    main()
