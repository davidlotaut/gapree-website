# Serveur d'administration de Gâprée

Petit service Cloudflare Workers qui donne au site statique les deux choses
qu'il ne peut pas avoir seul :

- des **comptes nominatifs** (adresse électronique + mot de passe) que la mairie
  crée et retire elle-même, depuis l'onglet « Accès » de `/admin/` ;
- une **clé d'écriture qui ne quitte jamais le serveur**, au lieu d'être posée,
  même chiffrée, dans un dépôt public.

Ce qui y est stocké : les comptes de la mairie (adresse, sel, empreinte du mot
de passe, droit de gérer les accès, numéro de version des sessions) et les
sessions ouvertes. Une session porte le numéro de version de son compte : un
nouveau mot de passe, une réinitialisation ou un compte retiré puis recréé le
changent, et les sessions qui portent l'ancien sont refusées. Rien d'autre, et
rien qui touche aux autres projets du compte Cloudflare qui l'héberge.

## Ce que fait le serveur

| Adresse | Qui | Effet |
|---|---|---|
| `POST /connexion` | tout le monde | Vérifie l'adresse et le mot de passe, ouvre une session de 12 h. Après 10 essais ratés en un quart d'heure sur une même adresse depuis une même connexion d'origine (`CF-Connecting-IP`), bloque cette connexion seulement : un inconnu ne peut plus bloquer le compte des autres. |
| `GET /moi` | connecté | Rend l'identité de la session en cours. |
| `POST /deconnexion` | connecté | Ferme la session. |
| `POST /motdepasse` | connecté | Remplace son propre mot de passe (8 caractères minimum) et ferme toutes ses autres sessions ; celle en cours reste ouverte jusqu'à son échéance. |
| `GET /utilisateurs` | gestionnaire | Liste les accès. |
| `POST /utilisateurs` | gestionnaire | Crée un accès (ou en réinitialise un, ce qui ferme ses sessions ouvertes) et rend le mot de passe une seule fois. |
| `PATCH /utilisateurs` | gestionnaire | Promeut ou rétrograde un compte, sans toucher à son mot de passe. Personne ne peut se rétrograder soi-même. |
| `DELETE /utilisateurs?email=` | gestionnaire | Retire un accès. Personne ne peut retirer le sien. |
| `POST /televerser` | connecté | Dépose des photos ou des documents sans rien publier, dans les emplacements permis ci-dessous. |
| `POST /publier` | connecté | Écrit tous les changements dans le dépôt, en un seul enregistrement. |

Emplacements permis, en écriture : `_actualites/`, `_talents/`, `_elus/` (fichiers `.md`),
`_data/accueil.yml`, `_data/mairie.yml`, `assets/img/` (photos) et `assets/docs/` (PDF),
noms en minuscules, chiffres et tirets. En suppression : les mêmes, sauf `_data/`. Tout
autre chemin (code de l'administration, `_config.yml`, `CNAME`…) fait refuser l'envoi
entier avant le moindre appel à GitHub.

Contrôle de version : chaque fichier envoyé à `/publier` peut porter `base`, la
révision du site (commit de `main`) sur laquelle l'élément a été ouvert, ou
`nouveau: true` pour un ajout ; chaque retrait, la forme `{ chemin, base }`. Un
fichier changé sur `main` depuis `base` (modifié, retiré ou créé), ou déjà présent
pour un ajout, fait refuser l'envoi entier : `409 { erreur, conflits: [chemins] }`,
sauf si `main` porte déjà exactement le contenu envoyé (réessai d'une publication
réussie dont la réponse s'est perdue). Sans `base` ni `nouveau` (page ouverte avant
cette règle), aucun contrôle. Quand rien ne change réellement (retraits déjà faits,
fichiers identiques), la réponse est `{ ok: true, inchange: true }`, sans
enregistrement ni reconstruction du site.

Mots de passe : PBKDF2-SHA256, 100 000 itérations (le maximum accepté par le runtime Cloudflare), sel de 16 octets propre à
chaque compte. Comparaison à durée constante. Les mots de passe fabriqués
évitent les caractères qu'on confond au téléphone (ni `0`/`O`, ni `1`/`l`/`I`).

## Installation

Les étapes marquées **(vous)** demandent une action humaine et ne peuvent pas
être automatisées.

```bash
# 1. (vous) autoriser cet ordinateur sur le compte Cloudflare
wrangler login

# 2. créer le stockage des comptes, puis reporter l'identifiant rendu
#    dans wrangler.toml, à la place de À_REMPLIR_A_LA_CREATION_DU_STOCKAGE
wrangler kv namespace create COMPTES

# 3. mettre le serveur en ligne
wrangler deploy

# 4. (vous) créer un jeton GitHub « fine-grained » limité au seul dépôt
#    gapree-website, avec la permission Contents : Read and write,
#    puis le donner au serveur sans qu'il passe par un fichier :
wrangler secret put JETON_GITHUB

# 5. créer le premier compte, celui de la mairie
node amorcer.mjs mairie.gapree@wanadoo.fr
```

Enfin, reporter l'adresse rendue par `wrangler deploy` dans
`admin/config.js` (`window.GAPREE_SERVEUR`), puis pousser.

## Retour en arrière

Vider `admin/config.js` remet l'espace d'administration en démonstration :
il s'ouvre sans mot de passe et ne publie rien. Le serveur peut rester en
place, il ne sert plus.

## Version de l'API GitHub

Le serveur demande la version `2026-03-10` (constante `VERSION_API` de
`src/index.js`). GitHub garde une version 24 mois après la sortie de la
suivante, puis répond `410 Gone` à tout appel qui la demande ; l'espace
affiche alors « Le site doit être mis à jour par la personne qui l'a
installé ». À la sortie d'une nouvelle version : lire la page « Breaking
changes » de la documentation de GitHub pour les seuls appels `/git/` (refs,
commits, trees, blobs), changer la constante, puis essayer une publication
sur une branche d'essai (variable `BRANCHE`) avant de remettre `main`.

## Essais en local

```bash
wrangler dev --local --var JETON_GITHUB:faux --var 'ORIGINES:http://localhost:8899'
node amorcer.mjs essai@exemple.fr --local
```

La publication échoue alors volontairement (le jeton est faux), ce qui permet
de vérifier que le message d'erreur reste lisible pour la mairie.

## Coût

Offre gratuite de Cloudflare : 100 000 requêtes par jour, 1 000 écritures par
jour dans le stockage. Une mairie qui publie quelques articles par mois en est
très loin.
