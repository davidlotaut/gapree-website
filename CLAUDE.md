# gapree-website : site officiel de la commune de Gâprée

Site Jekyll de Gâprée (Orne, ~140 habitants), en ligne. Suivi : fiche `memory_project_gapree-website`.

## Commandes
- Dev local : `bundle exec jekyll serve` (Gemfile à la racine ; Jekyll n'est pas installé sur le Mac, la vérité c'est le build GitHub Pages)
- Contenu : collections `_actualites/`, `_talents/`, `_elus/`, données dans `_data/`
- Activer la publication réelle : `/usr/bin/python3 scripts/chiffre_jeton.py "<mot de passe>" "<PAT>"` puis coller dans `admin/jeton.js`

## Pièges
- **`admin/jeton.js` est l'interrupteur unique** : vide, l'espace d'administration est ouvert et en démonstration (localStorage) ; rempli, il demande un mot de passe et publie réellement dans le dépôt. Ne jamais y écrire un jeton sans l'accord de David : le dépôt est public, donc le blob chiffré l'est aussi
- Le contenu est VIDE depuis le 04/09/2026 (les actualités et portraits étaient fictifs, retirés à la demande de la mairie). Ne jamais réinventer du contenu de commune : tout vient de la mairie
- Site public d'une commune : ton institutionnel, zéro mention technique en front (règle UI)
- `mode_dev: true` = `noindex` global. À passer à `false` seulement quand du vrai contenu est en ligne
