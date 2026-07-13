# Gâprée · site officiel de la commune

Site vitrine de **Gâprée** (Orne, Normandie, ~140 habitants), administrable par la mairie.

- **Site** : https://davidlotaut.github.io/gapree-website/
- **Administration** : https://davidlotaut.github.io/gapree-website/admin/
- **Guide d'administration** (à transmettre à la mairie) : https://davidlotaut.github.io/gapree-website/guide-administration/

## Architecture

| Brique | Choix | Pourquoi |
|---|---|---|
| Générateur | Jekyll (build GitHub Pages natif) | zéro maintenance : chaque commit reconstruit le site |
| Hébergement | GitHub Pages (branche `main`, racine) | gratuit, déjà actif sur ce dépôt |
| Admin | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) sur `/admin/` | interface en français, fonctionne sur un site 100 % statique, connexion par jeton GitHub (aucun serveur OAuth à héberger) |
| JS public | aucun | robustesse, accessibilité, confidentialité (zéro cookie) |

## Structure du contenu

```
_actualites/   articles d'actualité (title, date, image?, video?, corps)
_talents/      portraits (title, sous_titre?, date, image?, video?, corps)
_elus/         trombinoscope (title, fonction, photo?, ordre)
_data/
  accueil.yml  photo d'accueil, sous-titre, texte de bienvenue
  mairie.yml   adresse, téléphone, email, horaires, lien carte
images/uploads/  médias téléversés depuis l'admin
admin/           Sveltia CMS (config.yml = modèle de contenu, labels français)
```

Tout le contenu ci-dessus est modifiable depuis `/admin/` sans toucher au code.

## Phase de développement (mode actuel)

- **Le site public est ouvert** (pas de mot de passe) mais en `noindex`
  tant que `mode_dev: true` dans `_config.yml`. Passer à `false` à la mise en ligne définitive.
- **`/admin/` est protégé par un mot de passe d'accès : `Gapre`** (insensible à la casse,
  mémorisé dans le navigateur). Vérification côté navigateur par empreinte SHA-256 dans
  `admin/index.html` ; pour changer le mot de passe, remplacer le hash
  (`printf '%s' "nouveaumotdepasse-en-minuscules" | shasum -a 256`).
  Derrière cette porte, Sveltia demande ensuite son propre jeton GitHub pour publier
  (voir ci-dessous) ; le mot de passe seul ne donne aucun droit d'écriture.
- **Contenu de démonstration** : les actualités et portraits actuels (sauf l'article
  de lancement du site) sont fictifs mais plausibles, avec photos d'illustration libres
  de droits (`assets/img/demo/`). Ils montrent le site « rempli » et seront remplacés
  par les vrais contenus de la mairie via l'admin.

## Accès admin de la mairie (login définitif, déjà prêt)

Sveltia CMS se connecte à l'API GitHub avec un **jeton d'accès personnel** (pas de backend OAuth).
Procédure de mise en service : voir l'« Annexe technique » du guide d'administration
(compte GitHub dédié à la mairie + collaborateur en écriture sur ce dépôt + token classic scope `repo`).

Pour tester en tant que propriétaire du dépôt : `gh auth token` fournit un jeton utilisable sur l'écran de connexion de `/admin/`.

## Développement local (facultatif)

```bash
bundle install   # nécessite Ruby ; gem github-pages
bundle exec jekyll serve
```

Sans Ruby : pousser sur `main` et laisser GitHub Pages construire (1 à 2 min), statut dans l'onglet Actions.

## Notes

- **Version Sveltia figée** dans `admin/index.html` (avec hash d'intégrité SRI). Pour mettre à jour : changer la version ET recalculer le hash (commande en commentaire dans le fichier).
- **Fonte** : Barlow Condensed 600 auto-hébergée (`assets/fonts/`, licence OFL incluse).
- **Photo d'accueil** : image d'illustration (Pexels, licence libre), à remplacer par une photo réelle de la commune via l'admin.
- **Élus** : les 11 noms proviennent des résultats publics des municipales 2026 (liste unique élue au 1er tour). Le titre de maire et les adjoints sont à confirmer par la mairie dans l'admin.
- Si un nom de domaine propre est acheté un jour (ex. gapree.fr) : le configurer dans Settings → Pages du dépôt, puis vider `baseurl` dans `_config.yml`.
- L'historique git antérieur à juillet 2026 contient l'ancienne exploration (moodboard, 6 maquettes) ; l'arborescence actuelle est le site définitif.
