"""
Gâprée — backend Flask pour le générateur de journal communal.

Endpoints :
  - GET  /gapree/                → sert index.html
  - GET  /gapree/<path>          → sert les fichiers statiques (HTML/CSS/JS/data)
  - POST /gapree/api/journal     → génère un bulletin via Claude à partir des
                                   actualités filtrées par date

À monter dans hub/app.py :
  import importlib
  _gapree_mod = importlib.import_module("projects.gapree-website.blueprint")
  app.register_blueprint(_gapree_mod.gapree_bp, url_prefix="/gapree")
"""

import json
import os
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

gapree_bp = Blueprint(
    "gapree",
    __name__,
    static_folder=str(ROOT),  # on sert tout le dossier en statique
    static_url_path="",
)


# --------------------------------------------------------------------------- statics
@gapree_bp.route("/")
def index():
    return send_from_directory(str(ROOT), "index.html")


@gapree_bp.route("/<path:filename>")
def serve(filename):
    target = ROOT / filename
    if target.is_file():
        return send_from_directory(str(ROOT), filename)
    # Fallback : si l'URL ressemble à une page sans extension, tenter .html
    alt = ROOT / f"{filename}.html"
    if alt.is_file():
        return send_from_directory(str(ROOT), f"{filename}.html")
    return jsonify({"error": "not found"}), 404


# --------------------------------------------------------------------------- journal API
@gapree_bp.route("/api/journal", methods=["POST", "OPTIONS"])
def generate_journal():
    # CORS pour usage depuis file://
    if request.method == "OPTIONS":
        return _cors(jsonify({}))

    payload = request.get_json(force=True) or {}
    d_from = payload.get("from")
    d_to = payload.get("to")
    style = payload.get("style", "standard")

    if not (d_from and d_to):
        return _cors(jsonify({"error": "from/to required"})), 400

    actualites = json.loads((DATA / "actualites.json").read_text())
    items = [
        n for n in actualites["items"]
        if d_from <= n["date"] <= d_to
    ]

    if not items:
        return _cors(jsonify({
            "markdown": (
                "_Aucun événement consigné sur cette période. "
                "Le village a goûté à un peu de tranquillité — "
                "c'est aussi cela, Gâprée._"
            ),
            "count": 0,
        }))

    markdown = _call_claude(items, d_from, d_to, style)
    return _cors(jsonify({"markdown": markdown, "count": len(items)}))


# --------------------------------------------------------------------------- Claude call
def _call_claude(items, d_from, d_to, style):
    """Appelle l'API Claude pour rédiger le journal communal."""
    try:
        from anthropic import Anthropic
    except ImportError:
        return _format_fallback(items, "anthropic SDK non installé (pip install anthropic)")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        try:
            from dotenv import load_dotenv
            load_dotenv(os.path.expanduser("~/.env"))
            api_key = os.environ.get("ANTHROPIC_API_KEY")
        except ImportError:
            pass

    if not api_key:
        return _format_fallback(items, "ANTHROPIC_API_KEY absente (~/.env)")

    style_brief = {
        "court":    "concis, une seule colonne, l'essentiel en 250 mots maximum",
        "standard": "ton classique du bulletin communal, 400–600 mots, avec sous-titres par thème",
        "long":     "longue forme, 800–1000 mots, avec interludes descriptifs et touches littéraires sobres",
    }.get(style, "ton classique du bulletin communal")

    bullets = "\n".join(
        f"- {n['date']} — [{n['categorie']}] {n['titre']} : {n['resume']}"
        for n in items
    )

    prompt = f"""Tu es le rédacteur du bulletin communal de Gâprée (Orne, Normandie, 144 habitants).
Rédige un numéro du bulletin couvrant la période du {d_from} au {d_to}, à partir de ces faits :

{bullets}

Consignes :
- Style {style_brief}
- Français soigné, ton chaleureux mais factuel, sans grandiloquence
- Structure en sections thématiques (## Conseil municipal, ## Vie associative, etc. — adapte aux thèmes présents)
- Pas de salutations ni de signature, juste le contenu rédigé
- N'invente pas de faits qui ne sont pas dans la liste ci-dessus
- Markdown léger : titres ##, ###, gras et italique si pertinent
- Tu peux ouvrir par un paragraphe d'introduction qui campe l'esprit du mois/de la période"""

    client = Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def _format_fallback(items, reason):
    """Format markdown simple si Claude indisponible."""
    by_cat = {}
    for it in items:
        by_cat.setdefault(it["categorie"], []).append(it)
    lines = [f"_(Rédaction IA indisponible : {reason}. Aperçu brut ci-dessous.)_\n"]
    for cat, entries in by_cat.items():
        lines.append(f"## {cat}\n")
        for e in entries:
            lines.append(f"### {e['titre']}")
            lines.append(f"**{e['date']}.** {e['resume']}\n")
    return "\n".join(lines)


def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp
