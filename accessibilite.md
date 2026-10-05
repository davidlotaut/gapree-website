---
layout: page
title: Accessibilité
permalink: /accessibilite/
description: "Déclaration d'accessibilité du site de la commune de Gâprée (Orne) : état de conformité, contenus non accessibles, signalement d'un défaut, voies de recours, schéma pluriannuel et plan d'actions."
chapo: "Accessibilité : non conforme. Cette page dit ce qui n'est pas encore accessible sur le site, comment le signaler à la mairie et ce que la commune prévoit."
sommaire:
  - titre: Déclaration d'accessibilité
    ancre: "déclaration-daccessibilité"
  - titre: État de conformité
    ancre: "état-de-conformité"
  - titre: Contenus non accessibles
    ancre: "contenus-non-accessibles"
  - titre: Signaler un défaut
    ancre: "retour-dinformation-et-contact"
  - titre: Voies de recours
    ancre: "voies-de-recours"
  - titre: Schéma pluriannuel 2026-2028
    ancre: "schéma-pluriannuel-de-mise-en-accessibilité-2026-2028"
  - titre: Plan d'actions 2026
    ancre: "plan-dactions-2026"
---
## Déclaration d'accessibilité

La commune de Gâprée s'engage à rendre son site internet accessible conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.

À cette fin, elle met en œuvre la stratégie et les actions suivantes : le [schéma pluriannuel de mise en accessibilité 2026-2028](#schéma-pluriannuel-de-mise-en-accessibilité-2026-2028) et le [plan d'actions 2026](#plan-dactions-2026), présentés plus bas sur cette page.

Cette déclaration d'accessibilité s'applique au site de la commune, gapree.com.

## État de conformité

Le site gapree.com est **non conforme** avec le référentiel général d'amélioration de l'accessibilité (RGAA).

### Résultats des tests

Aucun audit de conformité n'a encore été réalisé : la part des critères du RGAA respectés n'est donc pas mesurée.

## Contenus non accessibles

Les contenus listés ci-dessous ne sont pas accessibles pour les raisons suivantes.

### Non-conformités

- La plupart des photos publiées dans les actualités n'ont pas de description : un lecteur d'écran ne peut pas dire ce qu'elles montrent.
- Certains documents sont publiés sous forme d'image, comme le bon de commande des pièges à frelons asiatiques : leur texte n'est pas lisible par un lecteur d'écran. La mairie vous en donne le contenu sur simple demande, par courriel ou par téléphone.
- Les documents PDF joints aux actualités ne sont pas vérifiés : ils peuvent ne pas être accessibles, en particulier quand ce sont des documents numérisés.

### Dérogations pour charge disproportionnée

Aucune.

### Contenus non soumis à l'obligation d'accessibilité

Aucun.

## Établissement de cette déclaration

Cette déclaration a été établie le 5 octobre 2026.

### Technologies utilisées pour la réalisation du site

- HTML5
- CSS
- JavaScript

### Environnement de test, outils et pages vérifiées

Aucun audit n'ayant encore été réalisé, aucune page du site n'a fait l'objet d'une vérification de conformité.

## Retour d'information et contact

Si vous n'arrivez pas à accéder à un contenu ou à un service du site, vous pouvez contacter la mairie pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme. Vous pouvez aussi lui signaler tout défaut d'accessibilité.

- Par courriel : [{{ site.data.mairie.email }}](mailto:{{ site.data.mairie.email }})
- Par téléphone : [{{ site.data.mairie.telephone }}](tel:{{ site.data.mairie.telephone | remove: ' ' | remove: '.' | replace_first: '0', '+33' }})
- Par courrier, ou à la permanence ({% for h in site.data.mairie.horaires %}le {{ h.jours | downcase }}, {{ h.heures }}{% unless forloop.last %} ; {% endunless %}{% endfor %}) : {{ site.data.mairie.adresse | newline_to_br | strip_newlines | replace: "<br />", ", " }}

La mairie accuse réception de votre demande et vous répond dans un délai d'une semaine. Si votre demande soulève une question complexe, sa réponse vous indique le délai nécessaire pour la traiter.

## Voies de recours

Cette procédure est à utiliser dans le cas suivant : vous avez signalé à la mairie un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un service du site, et vous n'avez pas obtenu de réponse satisfaisante.

- Écrire un message au Défenseur des droits : [https://www.defenseurdesdroits.fr/nous-contacter-355](https://www.defenseurdesdroits.fr/nous-contacter-355)
- Contacter le délégué du Défenseur des droits près de chez vous : [https://www.defenseurdesdroits.fr/carte-des-delegues](https://www.defenseurdesdroits.fr/carte-des-delegues)
- Appeler le Défenseur des droits : [09 69 39 00 00](tel:+33969390000)
- Envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) :
  Défenseur des droits
  Libre réponse 71120
  75342 Paris CEDEX 07

## Schéma pluriannuel de mise en accessibilité 2026-2028

La commune de Gâprée publie un seul service en ligne : ce site, mis en ligne dans sa forme actuelle en juillet 2026. Ce schéma présente, pour trois ans, sa politique d'accessibilité numérique.

- **Politique.** L'accessibilité est prise en compte à chaque évolution du site et de son outil de publication, pour que l'information municipale soit lisible par tous les habitants, y compris les personnes en situation de handicap.
- **Référent.** La maire est la référente accessibilité numérique de la commune : elle reçoit les signalements adressés à la mairie et veille à leur suivi.
- **Moyens.** La commune n'engage pas de budget propre : les moyens sont ceux de la mairie et des personnes qu'elle habilite à publier sur le site.
- **Formation.** Les personnes qui publient sur le site sont sensibilisées à la description des photos et à la publication du texte des documents.
- **Organisation.** Les demandes des usagers sont reçues par courriel, par téléphone ou à la permanence, et la mairie y répond dans un délai d'une semaine.
- **Prestataires.** Toute évolution du site confiée à un prestataire comprend le respect du RGAA.
- **Évaluation.** Une première évaluation de la conformité au RGAA est prévue en 2027 ; cette déclaration sera alors mise à jour.

## Plan d'actions 2026

- Octobre 2026 : l'outil de publication invite à décrire chaque photo, et la navigation au clavier dans les photos vues en grand est corrigée.
- D'ici la fin de l'année 2026 : ajouter une description aux photos déjà publiées, en commençant par celles qui montrent un document.
- D'ici la fin de l'année 2026 : pour chaque document publié sous forme d'image, recopier son texte dans l'actualité ou joindre le document lui-même.

Bilan de l'année précédente : le site actuel a été mis en ligne en juillet 2026, il n'y a pas encore d'année écoulée à présenter.
