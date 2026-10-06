# gapree-website : site officiel de la commune de Gâprée

Site Jekyll de Gâprée (Orne, ~140 habitants), en ligne sur **https://gapree.com**. Suivi : fiche `memory_project_gapree-website`. Revue adversariale du 05-06/10/2026 : registre `~/Desktop/ClaudeCode/general/revues-adversariales/2026-10-05-gapree-website-site-et-administration/` (80 défauts, 54 corrigés et contre-vérifiés).

## Commandes
- Tests : `node tests/index.js` depuis la racine (Node 24, aucune dépendance) ; `node --test tests/` échoue sous Node 24. Les tests vivent sous `tests/<lot>/`, exclus de Jekyll.
- Dev local : Jekyll n'est pas installé sur le Mac, la vérité c'est le build GitHub Pages
- Contenu : collections `_actualites/`, `_talents/`, `_elus/`, données dans `_data/`, pièces jointes dans `assets/docs/`
- Serveur d'administration : `cd ~ && wrangler deploy --config <dépôt>/serveur/wrangler.toml` (lancé depuis `~`, wrangler lit le `CLOUDFLARE_API_TOKEN` de `~/.env` ; il n'est PAS connecté en OAuth). `--dry-run` valide la configuration sans rien envoyer.

## Le serveur d'administration
`serveur/` est un Worker Cloudflare (**gapree-admin**) avec un KV `COMPTES` et une liaison de limitation de débit `LIMITE_CONNEXIONS`. Il porte les comptes de la mairie et la clé d'écriture GitHub, qui ne descend jamais dans le navigateur. `admin/config.js` porte son adresse : vider ce fichier remet tout en démonstration locale.

Routes : `/televerser` dépose photos et PDF sans rien publier, `/publier` assemble tout en un seul enregistrement, `/utilisateurs` gère les accès, `/journal` reçoit les comptes rendus d'échec (gardés 30 jours dans le KV, clés `journal:…`).

## Pièges
- **Ordre de mise en ligne** : le serveur d'abord, le site ensuite, et jamais de retour arrière du seul serveur. L'espace d'administration réuni face à l'ancien serveur voit ses retraits ignorés.
- **Liste blanche du serveur** : `/publier` et `/televerser` n'écrivent que `_actualites|_talents|_elus/<nom>.md`, `_data/accueil.yml`, `_data/mairie.yml`, `assets/img/<nom>.(jpg|jpeg|png|webp|gif)` et `assets/docs/<nom>.pdf`. Tout nouvel emplacement de contenu doit y être ajouté.
- **Contrôle de version** : chaque publication envoie la révision sur laquelle l'élément a été ouvert ; le serveur refuse (409) d'écraser un fichier changé entre-temps. Il repose sur `"revision"` de `admin/contenu.json` (`site.github.build_revision`) : après chaque déploiement, vérifier qu'elle porte 40 caractères hexadécimaux ; vide, le contrôle est inactif. Les textes se lisent sur raw.githubusercontent.com à cette révision exacte.
- **Après « Publié »**, l'espace relit `contenu.json` toutes les 15 s jusqu'à la mise en ligne réelle (« Mise en ligne en cours… », puis « En ligne. ») ; il n'y a plus de rechargement aveugle. Au-delà de dix minutes, il demande de prévenir.
- **Dates d'actualité avec l'heure** (`date: AAAA-MM-JJ HH:MM:SS +HHMM`) : sans elle, les articles d'un même jour sortent dans l'ordre alphabétique et l'accueil cache les derniers.
- **Les photos sont réduites à l'envoi** (1800 points, 600 pour les portraits d'élus, qualité 0,85), et partent par paquets de 10 Mo. Ne pas retirer cette réduction : sans elle, un reportage dépasse la mémoire du serveur (128 Mo) et la place réservée aux brouillons. Une photo retirée ou remplacée est supprimée du dépôt à la publication.
- **`litPhoto` rend `{ src, vignette }`, jamais une chaîne** : chacun de ses appels doit prendre `.src`. Tout changement de format d'une fonction partagée se vérifie à TOUS ses appels.
- **Plafond de connexion** : la liaison Cloudflare compte par connexion d'origine seulement. Un plafond par compte a été essayé le 06/10 : il permettait à n'importe qui de bloquer la mairie avec son adresse publique (défaut 51). Ne pas le remettre.
- **Banc d'essai avant de pousser un changement de l'espace d'administration** : l'espace construit (front matter retiré, `{{ site.time }}` remplacé), `DEPOT_RAW` pointé sur un faux serveur qui garde un arbre par révision, applique la liste blanche et le contrôle de version, et simule la reconstruction (`contenu.json` régénéré après un délai). Rejouer les gestes réels : publier puis rouvrir pendant la mise en ligne, article au même titre, photos et PDF, coordonnées de la mairie, portrait, conflit forcé. Détail dans la fiche mémoire (section du 06/10/2026).
- **GitHub n'accepte que 180 écritures par minute** (5 points par POST, 900 points). Le serveur se tient à 150 ; ne pas accélérer sans refaire le calcul.
- **Le brouillon vit dans IndexedDB** (Safari peut l'effacer après sept jours sans visite). Une publication interrompue reprend : ne pas vider `surcouche.deposees` ailleurs qu'après une publication réussie.
- **Historique réécrit le 06/10/2026** (adresses des gestionnaires retirées des messages, remplacées par « compte » et 8 caractères de l'empreinte SHA-256 de l'adresse). Les identifiants de commits d'avant cette date ne sont plus valables : correspondance dans le registre de la revue (`brut/correspondance-sha.txt`).
- Site public d'une commune : ton institutionnel, zéro mention technique en front (règle UI). Mentions légales et page d'accessibilité en ligne depuis le 06/10, à faire valider par la maire (nom du délégué à la protection des données à obtenir).
- Ne jamais inventer de contenu de commune : le vrai vient de la mairie, via Camille Antoni.
- Le dépôt n'est plus le seul à écrire (la mairie publie depuis l'espace d'administration) : toujours `git pull --rebase` avant de pousser.
