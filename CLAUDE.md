# gapree-website : site officiel de la commune de Gâprée

Site Jekyll de Gâprée (Orne, ~140 habitants), refonte livrée et en ligne. Suivi : fiche `memory_project_gapree-website`.

## Commandes
- Dev local : `bundle exec jekyll serve` (Gemfile à la racine)
- Contenu : collections `_actualites/`, `_elus/`, données dans `_data/`

## Pièges
- L'espace admin intégré est en MODE DÉMONSTRATION (localStorage uniquement) : aucune écriture réelle. La mise en service réelle = brancher l'API GitHub derrière une vraie authentification : décision à prendre AVEC David, ne pas l'improviser
- Site public d'une commune : ton institutionnel, zéro mention technique en front (règle UI)
