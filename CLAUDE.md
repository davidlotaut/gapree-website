# gapree-website : site officiel de la commune de Gâprée

Site Jekyll de Gâprée (Orne, ~140 habitants), en ligne sur **https://gapree.com**. Suivi : fiche `memory_project_gapree-website`.

## Commandes
- Dev local : `bundle exec jekyll serve` (Gemfile à la racine ; Jekyll n'est pas installé sur le Mac, la vérité c'est le build GitHub Pages)
- Contenu : collections `_actualites/`, `_talents/`, `_elus/`, données dans `_data/`
- Serveur d'administration : `cd serveur && wrangler deploy` (le `CLOUDFLARE_API_TOKEN` de `~/.env` suffit ; wrangler n'est PAS connecté en OAuth)

## Le serveur d'administration
`serveur/` est un Worker Cloudflare (**gapree-admin**) avec un KV `COMPTES`. Il porte les comptes de la mairie et la clé d'écriture GitHub, qui ne descend jamais dans le navigateur. `admin/config.js` porte son adresse : vider ce fichier remet tout en démonstration locale.

Trois routes comptent : `/televerser` dépose les photos sans rien publier et rend leurs références, `/publier` assemble tout en un seul enregistrement, `/utilisateurs` gère les accès.

## Pièges
- **Ordre de mise en ligne** : le serveur d'abord, le site ensuite. L'inverse ferait appeler par le site une route qui n'existe pas encore.
- **Les photos sont réduites à l'envoi** (1800 points, qualité 0,85, soit ~460 Ko), et partent par paquets de 10 Mo. Ne pas retirer cette réduction : sans elle, un reportage dépasse la mémoire du serveur (128 Mo) et la place réservée aux brouillons.
- **`litPhoto` rend `{ src, vignette }`, jamais une chaîne** : chacun de ses appels doit prendre `.src`. Le 08/09, seul l'éditeur d'actualités avait été adapté ; portraits d'élus et photo d'accueil sont partis en `photo: "[object Object]"` jusqu'au 05/10. Tout changement de format d'une fonction partagée se vérifie à TOUS ses appels.
- **Tester un changement de l'espace d'administration sur un banc local** avant de pousser : `admin/` construit pris sur le site en ligne, `app.js` local, `config.js` vers un faux serveur qui enregistre ce qui serait publié, session forcée par `localStorage["gapree-session"]`. Détail dans la fiche mémoire (section du 05/10/2026).
- **GitHub n'accepte que 180 écritures par minute** (5 points par POST, 900 points). Le serveur se tient à 150 ; ne pas accélérer sans refaire le calcul.
- **Le brouillon vit dans IndexedDB**, plus dans localStorage qui plafonnait à 5 Mo, soit une seule photo.
- **Une publication interrompue reprend** : les photos déjà déposées sont notées dans le brouillon et ne repartent pas. Ne pas vider `surcouche.deposees` ailleurs qu'après une publication réussie.
- `mode_dev: true` = `noindex` global. À passer à `false` seulement quand du vrai contenu est en ligne.
- Site public d'une commune : ton institutionnel, zéro mention technique en front (règle UI).
- Ne jamais inventer de contenu de commune : le vrai vient de la mairie, via Camille Antoni.
- Le dépôt n'est plus le seul à écrire (Camille publie depuis l'espace d'administration) : toujours `git pull --rebase` avant de pousser.
