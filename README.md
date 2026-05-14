# Gâprée — site de la commune

Site vitrine pour **Gâprée**, commune de l'Orne (Normandie, 145 habitants, 10,07 km², code postal 61390).

🌐 **Démo en ligne** : https://davidlotaut.github.io/gapree-website/
🎨 **Moodboard 6 directions** : https://davidlotaut.github.io/gapree-website/mockups/

---

## Aperçu

Le projet contient :

- Le **site principal** multi-pages (accueil, histoire, artisanat, actualités, journal, mairie)
- **6 mockups d'accueil** explorant 6 directions visuelles différentes — 3 originels (typo/illustration/couleur), 3 photographiques (boutique, documentaire, magazine d'expériences)
- Un **générateur de journal communal** (backend Flask + API Claude) qui rédige un bulletin à partir des actualités filtrées par date — *fonctionnalité locale uniquement, voir ci-dessous*

## Lancer en local

Site statique seul (suffisant pour parcourir le site et les mockups) :

```bash
cd gapree-website
python3 -m http.server 8765
# puis ouvrir http://localhost:8765/
```

## Mockups

Six directions visuelles d'accueil sont explorées dans `mockups/`. Chacune est un fichier HTML autonome avec CSS embarqué, sans dépendance au CSS du site principal.

| # | Direction | Référence |
|---|---|---|
| 1 | Éditorial Patrimoine | Le Monde Magazine |
| 2 | Carte postale normande | Plus Beaux Villages de France |
| 3 | Modern tourism board | France.fr, Visit Iceland |
| 4 | Photo Editorial Boutique | Mr & Mrs Smith, Cereal Magazine |
| 5 | Documentaire / Reportage | Géo, Polka, National Geographic |
| 6 | Magazine Expériences | AirBnB Experiences, Lonely Planet |

Le moodboard comparatif est à `mockups/index.html`.

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
