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

Application autonome (`index.html` + `admin.css` + `app.js` + `publication.js`), sans dépendance
externe. Deux états, décidés par la seule présence d'un jeton dans `admin/jeton.js` :

| `admin/jeton.js` | Accès | Enregistrer | Publier |
|---|---|---|---|
| vide (état actuel) | ouvert à tous | navigateur (`localStorage`) | indisponible, bandeau de démonstration |
| jeton chiffré collé | mot de passe | navigateur (brouillon) | écrit dans le dépôt |

- Le contenu réel du site est chargé depuis `/admin/contenu.json` (généré par Jekyll à chaque
  build) et le texte des articles depuis les fichiers source du dépôt (raw.githubusercontent.com).
- Onglets : Actualités, Nos talents (création, édition avec aperçu en direct, suppression,
  photo, vidéo YouTube), Équipe municipale (fiches + ordre), Réglages (photo d'accueil,
  coordonnées, horaires).
- **Publication** : le brouillon local est traduit en fichiers du site (markdown avec front
  matter, `_data/*.yml`, photos écrites dans `assets/img/`) puis poussé en **un seul commit**
  via l'API Git de GitHub, donc une seule reconstruction du site. Les conflits (publication
  concurrente) sont détectés et signalés en clair.
- **Sécurité** : le jeton est embarqué chiffré (AES-256-GCM, clé PBKDF2-SHA256 310 000
  itérations dérivée du mot de passe), déchiffré dans le navigateur par WebCrypto. Le dépôt
  étant public, le blob chiffré l'est aussi : le mot de passe doit être long, et le jeton doit
  être un PAT *fine-grained* limité à ce seul dépôt en écriture de contenu.

### Activer la publication réelle

```bash
/usr/bin/python3 scripts/chiffre_jeton.py "<mot de passe mairie>" "<PAT GitHub>"
# coller la ligne obtenue dans admin/jeton.js, puis commit + push
```

Pour revenir en démonstration : remettre la chaîne vide.

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
- `/admin/` ouvert à tous, en démonstration, tant que `admin/jeton.js` est vide.
- **Contenu vide** : actualités et portraits ont été retirés le 04/09/2026 (ils étaient
  fictifs). Le site attend la matière de la mairie ; les pages gèrent l'état vide.
  Seuls les 11 élus sont du contenu réel.
- La photo d'accueil reste une illustration libre de droits, à remplacer par une vraie
  photo de la commune.

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
