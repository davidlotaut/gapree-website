// Défauts 53 et 59 : une saisie placée dans un attribut HTML (titre de partage,
// description, texte alternatif, libellé lu par les lecteurs d'écran) passe
// par le filtre escape. Sans lui, un guillemet droit dans un titre coupe
// l'attribut : og:title de l'article « Bébés Lecteurs » lu en ligne le 05/10
// comme « Recherche bénévole - animation », suivi d'attributs parasites.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit, attributs, filtres } from "./outils.mjs";

const GABARITS = [
  "_includes/head.html",
  "_includes/header.html",
  "_includes/footer.html",
  "_includes/card.html",
  "_includes/galerie.html",
  "_includes/photo-vue.html",
  "_includes/youtube.html",
  "_layouts/default.html",
  "_layouts/page.html",
  "_layouts/article.html",
  "index.html",
  "actualites/index.html",
  "talents/index.html",
  "contact/index.html",
  "404.html",
];

/* Attributs qui portent du texte lu ou affiché ; content seulement sur <meta>. */
const ATTRIBUTS_TEXTE = new Set(["alt", "aria-label", "title"]);
/* Rangs et totaux de photos : des nombres calculés par le gabarit. */
const NOMBRES = new Set(["include.rang", "include.total", "rang", "total"]);

function porteDuTexte(a) {
  return ATTRIBUTS_TEXTE.has(a.nom) || (a.balise === "meta" && a.nom === "content");
}

test("le repérage lit les attributs malgré le Liquid qu'ils contiennent", () => {
  const head = attributs(lit("_includes/head.html"));
  const ogTitle = head.find((a) => a.balise === "meta" && a.valeur.includes("page.title"));
  assert.ok(ogTitle, "og:title introuvable dans head.html");
  assert.ok(ogTitle.sorties.some((s) => filtres(s).expression === "page.title"));
  /* Un paramètre d'include n'est pas un attribut HTML. */
  const index = attributs(lit("index.html"));
  assert.ok(!index.some((a) => a.nom === "type" && a.valeur === "actualite"));
  /* Un « > » dans une balise Liquid ne ferme pas la balise HTML. */
  const exemple = attributs('<p class="a">{% if x > 0 %}<img alt="{{ y }}">{% endif %}</p>');
  assert.deepEqual(exemple.map((a) => a.nom), ["class", "alt"]);
});

test("53 et 59 : toute saisie placée dans un attribut de texte passe par escape", () => {
  const fautes = [];
  let vues = 0;
  for (const gabarit of GABARITS) {
    for (const a of attributs(lit(gabarit))) {
      if (!porteDuTexte(a)) continue;
      for (const sortie of a.sorties) {
        const { expression, filtres: chaine } = filtres(sortie);
        if (NOMBRES.has(expression)) continue;
        vues++;
        const dernier = chaine[chaine.length - 1];
        if (dernier !== "escape" && dernier !== "escape_once") {
          fautes.push(gabarit + ":" + a.ligne + " " + a.nom + '="{{ ' + sortie + ' }}"');
        }
      }
    }
  }
  assert.ok(vues >= 12, "trop peu de saisies repérées (" + vues + ") : le repérage est cassé");
  assert.deepEqual(fautes, []);
});
