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

Application autonome (`index.html` + `admin.css` + `app.js` + `publication.js`), sans
dépendance externe. Deux états, décidés par la seule présence d'une adresse dans
`admin/config.js` :

| `admin/config.js` | Accès | Enregistrer | Publier |
|---|---|---|---|
| vide | ouvert à tous | navigateur (`localStorage`) | indisponible, bandeau de démonstration |
| adresse du serveur | adresse électronique + mot de passe | navigateur (brouillon) | écrit dans le dépôt |

- Le contenu réel du site est chargé depuis `/admin/contenu.json` (généré par Jekyll à chaque
  build) et le texte des articles depuis les fichiers source du dépôt (raw.githubusercontent.com).
- Onglets : Actualités, Nos talents (création, édition avec aperçu en direct, suppression,
  photo, description de la photo, vidéo YouTube), Équipe municipale, Réglages, et Accès
  pour les personnes autorisées à gérer les comptes.
- **Publication** : le brouillon local est traduit en fichiers du site (markdown avec front
  matter, `_data/*.yml`, photos écrites dans `assets/img/`) et envoyé au serveur, qui écrit
  le tout en **un seul commit**, donc une seule reconstruction du site.
- **Le jeton d'écriture ne descend jamais dans le navigateur** : il vit dans le serveur
  (`serveur/`, voir son README). Le dépôt public ne contient aucun secret, même chiffré.

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
- `/admin/` ouvert à tous, en démonstration, tant que `admin/config.js` est vide.
- **Contenu de démonstration** : les 9 actualités et les 5 portraits sont fictifs,
  remis en ligne le 04/09/2026 pour la présentation à la mairie. À remplacer par la
  matière de la commune avant la mise en service. Seuls les 11 élus sont réels.
- La photo d'accueil reste une illustration libre de droits, à remplacer par une vraie
  photo de la commune.

## Basculer sur le nom de domaine de la commune

Le domaine `gapree.com` existe déjà : enregistré chez **OVH** le 01/06/2022, expire le
01/06/2027, il sert aujourd'hui la page « Site en construction » d'OVH (hébergement vide)
et porte des enregistrements MX OVH. Il est détenu par Nicolas Huguenin, qui doit
transmettre les accès.

Dans le dépôt, en un seul commit :

1. créer un fichier `CNAME` à la racine contenant la seule ligne `gapree.com` ;
2. dans `_config.yml` : `url: "https://gapree.com"` et `baseurl: ""` ;
3. passer `mode_dev: false` pour lever le `noindex` (à ne faire qu'une fois le vrai
   contenu en ligne, sinon les moteurs indexent une coquille vide).

Chez OVH, zone DNS du domaine :

| Type | Sous-domaine | Cible |
|---|---|---|
| A | (vide) | 185.199.108.153 |
| A | (vide) | 185.199.109.153 |
| A | (vide) | 185.199.110.153 |
| A | (vide) | 185.199.111.153 |
| CNAME | www | davidlotaut.github.io. |

**Ne pas toucher aux enregistrements MX** : ils portent la messagerie du domaine, qui n'a
rien à voir avec le site. Seuls les A de la racine (qui pointent vers l'hébergement OVH
vide) et le CNAME `www` changent.

Enfin, dans Settings → Pages du dépôt : renseigner le domaine, puis cocher « Enforce
HTTPS » une fois le certificat émis (quelques minutes à une heure).

## Notes

- **Fonte** : Barlow Condensed 600 auto-hébergée (`assets/fonts/`, licence OFL incluse).
- **Élus** : les 11 noms proviennent des résultats publics des municipales 2026 (liste unique
  élue au 1er tour). Le titre de maire et les adjoints sont à confirmer par la mairie.
- L'historique git antérieur à juillet 2026 contient l'ancienne exploration (moodboard,
  6 maquettes) ; l'arborescence actuelle est le site définitif.
