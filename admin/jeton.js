/* Jeton d'écriture du site, chiffré par le mot de passe de la mairie.

   Vide = l'espace d'administration reste en mode démonstration : on peut tout
   essayer, rien n'est publié.

   Pour activer la publication réelle :
     /usr/bin/python3 scripts/chiffre_jeton.py "<mot de passe>" "<jeton GitHub>"
   puis coller la ligne obtenue entre les guillemets ci-dessous, et publier.  */

window.GAPREE_JETON_CHIFFRE = "";
