# Gâprée — Site web de la commune

Site vitrine pour Gâprée (Orne, 61390, Normandie — 144 habitants).

## Objectifs

1. **Mettre en avant les savoir-faire artisanaux** du village et alentours
2. **Annoncer les actualités** de la commune
3. **Faire découvrir l'histoire** de Gâprée
4. **Générer un journal communal résumé** sur une période donnée (semaine, mois, trimestre…)

## Stack

- **Frontend** : HTML statique multi-pages, CSS vanilla, JS vanilla — pas de build, pas de framework
- **Typo** : Fraunces (serif) + Instrument Sans (sans), via Google Fonts
- **Palette** : Normandie — lin, ardoise, mousse, pomme cidre, terre cuite
- **Backend (générateur journal)** : Flask blueprint `gapree_bp` montable dans le hub, appelle l'API Claude pour générer le journal à partir des actualités filtrées par date
- **Données** : JSON dans `data/` (artisans, actualités, histoire) — pas de DB, c'est un mini-site éditorial

## Structure

```
gapree-website/
├── ARCHITECTURE.md
├── __init__.py
├── blueprint.py            # Flask blueprint pour /gapree/api/journal
├── index.html              # Accueil — hero + extraits des 3 sections
├── histoire.html           # Timeline historique
├── artisanat.html          # Grille des artisans + filtres catégorie
├── actualites.html         # Liste des actualités
├── journal.html            # Générateur de journal communal (UI + appel API)
├── mairie.html             # Mairie + équipe municipale
├── mockups/                # 3 directions visuelles alternatives pour la home (preview)
│   ├── index.html                          # moodboard comparatif
│   ├── style-1-editorial-patrimoine/       # éditorial magazine (Fraunces, lin/ocre/ardoise)
│   ├── style-2-carte-postale/              # carte postale normande (Playfair+Bebas, palette chaude)
│   └── style-3-modern-tourism/             # office du tourisme moderne (Manrope, vert/orange)
├── assets/
│   ├── css/style.css       # Design system partagé
│   ├── js/main.js          # Nav, filtres, fetch journal
│   └── images/             # Photos / illustrations
└── data/
    ├── artisans.json
    ├── actualites.json
    └── histoire.json
```

### Mockups exploratoires — `mockups/`

Trois mockups self-contained (1 HTML autonome chacun, CSS embarqué, pas de dépendance au CSS principal du site) pour explorer 3 caps stylistiques radicalement différents avant de figer une refonte. Chacun reprend la même structure (hero, pourquoi venir, artisans, actualités, mairie, footer) mais avec des choix typo/palette/atmosphère opposés. À ouvrir via `mockups/index.html` (moodboard comparatif).

## Données

- **Réelles** (sourcées Pappers + annuaire-mairie) : 145 hab. (2020), 10,07 km², maire Mme Laëtitia Raimbourg (élue 2020), 1er adjoint M. François Rattier, conseil municipal de 11 élus, mairie 21 bis rue Saint-Sulpice, tél 02 33 15 04 77, email mairie.gapree@wanadoo.fr, Communauté de communes de la Vallée de la Haute Sarthe, canton de Courtomer, Natura 2000 (Haute vallée de l'Orne), 21 entreprises dont 11 agricoles, proximité cathédrale de Sées (~9 km)
- **Générées/illustratives** (pour le design — à remplacer par du vrai contenu plus tard) : noms d'artisans, événements, dates précises du Moyen-Âge, contenu des actualités

Le marquage du contenu généré est fait via le champ `generated: true` dans les JSON, et un disclaimer en bas de site.

## Générateur de journal

`POST /gapree/api/journal`
- Input : `{ from: "2026-04-01", to: "2026-05-01", style: "court|long" }`
- Filtre `actualites.json` sur la fenêtre, construit un prompt, appelle Claude (clé `ANTHROPIC_API_KEY` depuis `~/.env`)
- Output : `{ markdown: "...", html: "...", count: N }`

L'UI propose des presets (semaine, mois, trimestre) + sélecteur de dates. Affichage stylisé comme un journal communal (colonnes, manchette, dropcap).

## Lancer en local

Option A — fichiers statiques seuls :
```bash
cd projects/gapree-website && python3 -m http.server 8765
```

Option B — avec backend journal (recommandé) :
- Enregistrer `gapree_bp` dans `hub/app.py` sous `/gapree`
- Lancer `cd hub && python3 app.py`
- Accéder à `http://localhost:9001/gapree/` (route à ajouter dans le blueprint qui sert les statiques)

## Décisions

- **Multi-pages plutôt que SPA** : plus simple, meilleur SEO communal, le maire peut éditer les HTML un par un sans toucher au JS
- **Pas de Tailwind** : on garde un CSS custom car le site doit avoir une vraie identité visuelle (pas un look générique)
- **Pas de CMS** : 144 habitants, mise à jour mensuelle max → JSON édité à la main suffit
