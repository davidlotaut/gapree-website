---
layout: page
title: Mentions légales
permalink: /mentions-legales/
description: "Mentions légales du site de la commune de Gâprée (Orne) : éditeur, direction de la publication, hébergement, données personnelles et droits des personnes."
---
{%- comment -%}
  La direction de la publication revient au maire : son nom est lu sur la
  fiche d'élu dont la fonction est « Maire », et suit un changement de maire.
{%- endcomment -%}
{%- assign maire = site.elus | where: "fonction", "Maire" | first -%}
## Éditeur du site

Ce site est édité par la commune de Gâprée.

Mairie de Gâprée
21 bis rue Saint-Sulpice
61390 Gâprée
Téléphone : {{ site.data.mairie.telephone }}
Courriel : {{ site.data.mairie.email }}

**Direction de la publication** : {% if maire %}{{ maire.title }}, maire de Gâprée{% else %}le maire de Gâprée{% endif %}.

## Hébergement

Le site est hébergé par GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Téléphone : +1 877 448 4820.

## Données personnelles

La commune de Gâprée est responsable des données personnelles que publie ce site.

**Ce que le site publie.** Les actualités et les portraits de la rubrique « Nos talents » peuvent montrer ou nommer des habitants, des élus et des personnes qui prennent part à la vie de la commune, en texte et en photo. Ils sont publiés pour informer les habitants de la vie communale, mission d'intérêt public de la commune (article 6.1.e du règlement général sur la protection des données ; article L2141-1 du code général des collectivités territoriales). Les portraits de « Nos talents » sont publiés avec l'accord des personnes présentées. Ces publications restent en ligne tant qu'elles gardent un intérêt pour l'information des habitants.

**Retirer une photo.** Si vous figurez sur une photo publiée sur ce site, la mairie la retire sur simple demande, par courriel à [{{ site.data.mairie.email }}](mailto:{{ site.data.mairie.email }}) ou à la permanence de la mairie.

**Ce que l'hébergeur enregistre.** Le site lui-même ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience. Comme pour tout site hébergé par GitHub Pages, GitHub enregistre l'adresse IP de chaque visiteur dans ses journaux techniques, pour la sécurité de son service, et les conserve selon ses propres règles. GitHub, Inc. est une société établie aux États-Unis, certifiée au cadre de protection des données entre l'Union européenne et les États-Unis (Data Privacy Framework).

**Vidéos.** Quand un article contient une vidéo, elle est diffusée par le lecteur YouTube de Google, en mode « confidentialité avancée » (youtube-nocookie.com) : l'affichage de l'article transmet votre adresse IP à Google, et la lecture de la vidéo relève des règles de confidentialité de Google.

**Vos droits.** Vous pouvez accéder aux données qui vous concernent, les faire rectifier ou effacer, vous opposer à leur publication ou en demander la limitation. Pour exercer ces droits, ou pour joindre le délégué à la protection des données, écrivez à la mairie, qui transmet votre demande au délégué de la commune. Si, après avoir écrit à la mairie, vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (Commission nationale de l'informatique et des libertés) : en ligne sur [https://www.cnil.fr/fr/plaintes](https://www.cnil.fr/fr/plaintes), ou par courrier au Service des plaintes de la CNIL, 3 place de Fontenoy, 75007 Paris.

## Crédits

Photographies d'illustration : images sous licences libres Pexels et Unsplash, en attendant les photographies de la commune.

Les textes et images publiés dans les rubriques Actualités et Nos talents sont la propriété de la commune de Gâprée ou de leurs auteurs respectifs.
