# Serveur d'administration de Gâprée

Petit service Cloudflare Workers qui donne au site statique les deux choses
qu'il ne peut pas avoir seul :

- des **comptes nominatifs** (adresse électronique + mot de passe) que la mairie
  crée et retire elle-même, depuis l'onglet « Accès » de `/admin/` ;
- une **clé d'écriture qui ne quitte jamais le serveur**, au lieu d'être posée,
  même chiffrée, dans un dépôt public.

Ce qui y est stocké : les comptes de la mairie (adresse, sel, empreinte du mot
de passe, droit de gérer les accès) et les sessions ouvertes. Rien d'autre, et
rien qui touche aux autres projets du compte Cloudflare qui l'héberge.

## Ce que fait le serveur

| Adresse | Qui | Effet |
|---|---|---|
| `POST /connexion` | tout le monde | Vérifie l'adresse et le mot de passe, ouvre une session de 12 h. Bloque un compte après 10 essais ratés en un quart d'heure. |
| `GET /moi` | connecté | Rend l'identité de la session en cours. |
| `POST /deconnexion` | connecté | Ferme la session. |
| `POST /motdepasse` | connecté | Remplace son propre mot de passe (8 caractères minimum). |
| `GET /utilisateurs` | gestionnaire | Liste les accès. |
| `POST /utilisateurs` | gestionnaire | Crée un accès (ou en réinitialise un) et rend le mot de passe une seule fois. |
| `DELETE /utilisateurs?email=` | gestionnaire | Retire un accès. Personne ne peut retirer le sien. |
| `POST /publier` | connecté | Écrit tous les changements dans le dépôt, en un seul enregistrement. |

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
