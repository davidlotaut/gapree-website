// Contrat 6, côté site : une actualité affiche ses pièces jointes PDF (champ
// documents de son en-tête : src, titre, taille) sous son texte, chacune en
// lien « Télécharger <intitulé> (PDF, <taille>) ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit } from "./outils.mjs";

const gabarit = lit("_layouts/article.html");

test("contrat 6 : l'article affiche ses pièces jointes sous son texte", () => {
  const bloc = /\{%- if page\.documents and page\.documents\.size > 0 %\}([\s\S]*?)\{%- endif %\}/.exec(gabarit);
  assert.ok(bloc, "bloc des pièces jointes introuvable dans article.html");
  assert.ok(gabarit.indexOf(bloc[0]) > gabarit.indexOf('<div class="prose">'), "les pièces jointes viennent après le texte");
  const contenu = bloc[1];
  assert.match(contenu, /\{%- for doc in page\.documents %\}/);
  assert.match(contenu, /<a href="\{\{ doc\.src \| relative_url \}\}">/);
  /* Le nom du lien dit ce qu'on télécharge, son format et son poids. */
  assert.match(contenu, /Télécharger \{\{ doc\.titre \| default: "le document" \}\} \(PDF\{% if doc\.taille and doc\.taille != "" %\}, \{\{ doc\.taille \}\}\{% endif %\}\)<\/a>/);
  /* Un titre de section, au singulier ou au pluriel. */
  assert.match(contenu, /\{% if page\.documents\.size > 1 %\}Pièces jointes\{% else %\}Pièce jointe\{% endif %\}/);
});

test("contrat 6 : les liens de pièces jointes ont leur style, assez grands pour le doigt", () => {
  const css = lit("assets/css/style.css");
  assert.match(css, /^\.article-documents \{/m);
  const lien = /^\.article-documents a \{([^}]*)\}/m.exec(css);
  assert.ok(lien, "style des liens de pièces jointes introuvable");
  assert.match(lien[1], /padding: 0\.75rem/);
});
