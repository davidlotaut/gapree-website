# Gâprée — site de la commune

Site vitrine pour **Gâprée**, commune de l'Orne (Normandie, 145 habitants, 10,07 km², code postal 61390).

🌐 **Moodboard en ligne — 6 directions visuelles** : https://davidlotaut.github.io/gapree-website/

---

## Aperçu

Le projet présente **six directions visuelles** pour le site de la commune. Le moodboard à la racine en liste six cartes :

1. **Mockup #1 — Vitrine multi-pages éditoriale** (`/site/`) : site multi-pages déjà développé (accueil, histoire, artisanat, actualités, journal, mairie) avec générateur IA de bulletin communal. C'est la version la plus aboutie.
2. **Mockup #2 — Carte postale normande** (`/mockups/style-2-carte-postale/`) : illustration, palette chaude, esprit Plus Beaux Villages.
3. **Mockup #3 — Modern tourism board** (`/mockups/style-3-modern-tourism/`) : vert profond, Manrope, app-like, esprit France.fr.
4. **Mockup #4 — Photo Editorial Boutique** (`/mockups/style-4-photo-editorial/`) : photographique cinématique, esprit Cereal Magazine / Mr & Mrs Smith.
5. **Mockup #5 — Documentaire / Reportage** (`/mockups/style-5-documentaire/`) : photographique, mix N&B/couleur, accent rouge, esprit Géo / Polka.
6. **Mockup #6 — Magazine Expériences** (`/mockups/style-6-magazine-experiences/`) : photographique, cards arrondies, esprit AirBnB Experiences / Lonely Planet.

Le **générateur de journal IA** est intégré au Mockup #1 — il s'agit d'un backend Flask qui appelle l'API Claude pour rédiger le bulletin à partir des actualités filtrées par date (*fonctionnalité locale uniquement*, voir plus bas).

## Lancer en local

Site statique seul (suffisant pour parcourir le moodboard, le site multi-pages, et les 5 mockups d'exploration) :

```bash
cd gapree-website
python3 -m http.server 8765
# puis ouvrir http://localhost:8765/
```

## Structure

```
gapree-website/
├── index.html                  # ← moodboard racine (6 cartes)
├── site/                       # Mockup #1 — site multi-pages éditorial
│   ├── index.html  histoire.html  artisanat.html  actualites.html
│   ├── journal.html  mairie.html
│   ├── assets/css/  assets/js/  data/
│   ├── blueprint.py            # backend Flask du générateur IA (local)
│   └── __init__.py
├── mockups/
│   ├── index.html              # redirection vers /
│   ├── style-2-carte-postale/
│   ├── style-3-modern-tourism/
│   ├── style-4-photo-editorial/
│   ├── style-5-documentaire/
│   └── style-6-magazine-experiences/
├── assets/photos/CREDITS.md    # crédits photos Unsplash (mockups 4/5/6)
├── previews/                   # screenshots PNG des 6 directions
└── ARCHITECTURE.md             # historique de décisions
```

Chaque mockup est un fichier HTML autonome avec CSS embarqué — pas de dépendance au site principal.

## Générateur de journal

Le bulletin communal est rédigé par l'**API Claude** d'Anthropic à partir des actualités consignées dans `data/actualites.json`, filtrées sur la période demandée.

Cette fonctionnalité **n'est pas opérationnelle sur la démo GitHub Pages** (pas de backend possible en hébergement statique). Pour l'utiliser :

1. Cloner le dépôt
2. Installer les dépendances : `pip install flask anthropic python-dotenv`
3. Renseigner `ANTHROPIC_API_KEY` dans `~/.env`
4. Lancer un hub Flask qui monte le blueprint `gapree_bp` sur `/gapree/` (voir `blueprint.py`)

## Architecture

Voir `ARCHITECTURE.md` pour la structure détaillée, les choix de stack, les sources des données, et l'historique des décisions.

## Crédits photos

Toutes les photographies des mockups 4, 5, 6 proviennent d'**Unsplash** (licence Unsplash, libre commercial). Liste détaillée : `assets/photos/CREDITS.md`.

## Licence

Code : libre d'usage (MIT).
Données et identité visuelle : propriété de la commune de Gâprée.
