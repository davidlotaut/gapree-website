# Gâprée · site officiel de la commune

Site vitrine de **Gâprée** (Orne, Normandie, ~140 habitants), avec espace d'administration intégré.

- **Site** : https://davidlotaut.github.io/gapree-website/
- **Administration** : https://davidlotaut.github.io/gapree-website/admin/
- **Guide d'administration** (à transmettre à la mairie) : https://davidlotaut.github.io/gapree-website/guide-administration/

## Architecture

| Brique | Choix | Pourquoi |
|---|---|---|
| Générateur | Jekyll (build GitHub Pages natif) | zéro maintenance : chaque commit reconstruit le site |
| Hébergement | GitHub Pages (branche `main`, racine) | gratuit, déjà actif sur ce dépôt |
| Admin | Interface maison dans `admin/` (HTML/CSS/JS sans dépendance) | en français, au design du site, contrôle total |
| JS public | aucun (hors `/admin/`) | robustesse, accessibilité, confidentialité (zéro cookie) |

## Espace d'administration (`/admin/`)

Application autonome (`index.html` + `admin.css` + `app.js`), **ouverte sans authentification
pendant la phase de démonstration**, sur décision client du 13/07/2026.

- Le contenu réel du site est chargé depuis `/admin/contenu.json` (généré par Jekyll à chaque
  build) et le texte des articles depuis les fichiers source du dépôt (raw.githubusercontent.com).
- Onglets : Actualités, Nos talents (création, édition avec aperçu en direct, suppression,
  photo, vidéo YouTube), Équipe municipale (fiches + ordre), Réglages (photo d'accueil,
  coordonnées, horaires).
- **Mode démonstration** : les modifications sont enregistrées dans le navigateur du testeur
  (`localStorage`, clé `gapree-demo-admin`), avec bandeau explicatif et bouton de
  réinitialisation. Elles ne sont pas publiées sur le site en ligne : un site statique n'a
  pas de serveur, donc publier réellement exige une autorisation d'écriture sur le dépôt.
- **À la mise en service** : brancher le bouton « Enregistrer » sur l'API GitHub (écriture des
  fichiers du dépôt) derrière l'espace d'authentification qui sera alors défini. L'historique
  git contient deux mécanismes déjà éprouvés réutilisables : CMS Sveltia connecté par jeton
  (commit `9c915e9` et antérieurs) et jeton chiffré par mot de passe (`scripts/chiffre_jeton.py`,
  même commit).

## Structure du contenu

```
_actualites/   articles d'actualité (title, date, image?, video?, corps)
_talents/      portraits (title, sous_titre?, date, image?, video?, corps)
_elus/         trombinoscope (title, fonction, photo?, ordre)
_data/
  accueil.yml  photo d'accueil, sous-titre, texte de bienvenue
  mairie.yml   adresse, téléphone, email, horaires, lien carte
admin/         espace d'administration (contenu.json = export Jekyll du contenu)
```

## Phase de développement (état actuel)

- Site public ouvert, en `noindex` tant que `mode_dev: true` dans `_config.yml`
  (passer à `false` à la mise en ligne définitive).
- `/admin/` ouvert à tous, mode démonstration (voir ci-dessus).
- **Contenu de démonstration** : les actualités et portraits (sauf l'article de lancement)
  sont fictifs mais plausibles, photos d'illustration libres de droits (`assets/img/demo/`,
  licences Pexels et Unsplash). À remplacer par les vrais contenus de la mairie.

## Développement local (facultatif)

```bash
bundle install   # nécessite Ruby ; gem github-pages
bundle exec jekyll serve
```

Sans Ruby : pousser sur `main` et laisser GitHub Pages construire (1 à 2 min), statut dans l'onglet Actions.

## Notes

- **Fonte** : Barlow Condensed 600 auto-hébergée (`assets/fonts/`, licence OFL incluse).
- **Élus** : les 11 noms proviennent des résultats publics des municipales 2026 (liste unique
  élue au 1er tour). Le titre de maire et les adjoints sont à confirmer par la mairie.
- Si un nom de domaine propre est acheté un jour (ex. gapree.fr) : le configurer dans
  Settings → Pages du dépôt, puis vider `baseurl` dans `_config.yml`.
- L'historique git antérieur à juillet 2026 contient l'ancienne exploration (moodboard,
  6 maquettes) ; l'arborescence actuelle est le site définitif.
