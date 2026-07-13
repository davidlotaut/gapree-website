---
layout: page
title: Guide d'administration du site
permalink: /guide-administration/
noindex: true
chapo: "Ce guide explique comment publier et modifier le contenu du site. Aucune connaissance technique n'est nécessaire."
---
## Se connecter

1. Ouvrez la page [Administration du site]({{ '/admin/' | relative_url }}) (le lien figure aussi tout en bas de chaque page du site).
2. Pendant la phase de mise au point, la page demande d'abord un mot de passe d'accès : saisissez celui qui vous a été communiqué.
3. Deux boutons s'affichent ensuite : cliquez sur le second, « Se connecter avec un jeton d'accès » (ou « Sign In Using Access Token » si l'écran est en anglais), puis collez le jeton qui vous a été remis lors de la mise en service.
4. Le mot de passe et le jeton restent enregistrés dans le navigateur : sur votre ordinateur habituel, vous n'aurez pas à les ressaisir à chaque fois.

En cas de jeton perdu ou expiré, contactez la personne qui a mis le site en service pour en recevoir un nouveau.

## Publier une actualité

1. Dans le menu de gauche, cliquez sur « Actualités ».
2. Cliquez sur le bouton de création d'une nouvelle actualité.
3. Renseignez le titre, la date, une photo si vous en avez une (bouton « Photo »), et le texte.
4. Pour une vidéo : mettez-la d'abord en ligne sur YouTube, puis collez son lien dans le champ « Vidéo YouTube ».
5. Cliquez sur « Publier » (ou « Save »). Le site se met à jour tout seul en une à deux minutes.

Les mêmes étapes valent pour la rubrique « Nos talents » : un portrait a en plus un champ « Sous-titre » pour indiquer le métier ou l'activité.

## Modifier ou supprimer un contenu

1. Ouvrez la rubrique concernée dans le menu de gauche.
2. Cliquez sur l'article à modifier, faites vos changements, puis publiez.
3. Pour supprimer : ouvrez l'article et utilisez le bouton de suppression.

## Mettre à jour l'équipe municipale

Dans « Équipe municipale », chaque membre a une fiche : prénom et nom, fonction, photo (facultative) et ordre d'affichage (1 pour le maire, 2 pour le premier adjoint, et ainsi de suite). Après une élection ou un changement de fonction, il suffit de modifier ces fiches.

À la mise en service, les fonctions ont été préremplies à partir des résultats publics des élections de mars 2026 : **pensez à vérifier le titre de maire et à renseigner les adjoints.**

## Changer la photo d'accueil ou les coordonnées

Dans « Réglages du site » :

- « Page d'accueil » : la grande photo, le sous-titre et le texte de bienvenue. La photo actuelle est une image d'illustration : remplacez-la dès que possible par une belle photo de la commune (photo en largeur, dite « paysage », de préférence).
- « Coordonnées de la mairie » : adresse, téléphone, courriel, horaires. Ces informations s'affichent sur la page « Nous contacter » et au bas de toutes les pages.

## Bon à savoir

- Le site se reconstruit après chaque publication : comptez une à deux minutes avant de voir le changement en ligne.
- Préférez des photos de moins de 5 Mo. Les photos au format paysage rendent mieux dans les cartes.
- Les vidéos ne sont pas stockées sur le site : elles doivent être sur YouTube, seul le lien est collé ici.
- Ce guide n'apparaît pas dans les menus du site ; conservez son adresse.

## Annexe technique (pour la mise en service)

Cette partie s'adresse à la personne qui installe l'accès pour la mairie.

1. Créer un compte GitHub dédié à la mairie (par exemple avec l'adresse mairie.gapree@wanadoo.fr).
2. Donner à ce compte un accès en écriture au dépôt du site (Settings, puis Collaborators du dépôt).
3. Depuis ce compte, créer un jeton d'accès : Settings, Developer settings, Personal access tokens, « Tokens (classic) », cocher la portée « repo », sans date d'expiration (ou une expiration longue avec rappel).
4. Remettre ce jeton à la personne de la mairie chargée du site : c'est lui qui sert à la connexion décrite en haut de ce guide.
