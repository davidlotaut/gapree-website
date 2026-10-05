// Défaut 9 : la mention « Accessibilité : non conforme » figure sur toutes les
// pages, accueil compris, et mène à une page /accessibilite/ qui porte la
// déclaration au format officiel, le moyen de signaler un défaut, les voies de
// recours, un schéma pluriannuel court et le plan de l'année (loi 2005-102,
// art. 47 ; modèles d'accessibilite.numerique.gouv.fr lus le 05/10/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit, existe, corps, frontMatter, ancre, PROVISOIRE } from "./outils.mjs";

test("guide : l'identifiant des titres calculé ici est celui du site", () => {
  const guide = lit("guide-administration.md");
  const titres = [...guide.matchAll(/^## (.+)$/gm)].map((m) => ancre(m[1]));
  const ancres = [...guide.matchAll(/ancre: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ancres.length, 9);
  for (const a of ancres) assert.ok(titres.includes(a), a);
});

test("9 : le pied de page de chaque page porte la mention, en lien vers la déclaration", () => {
  const pied = lit("_includes/footer.html");
  assert.match(pied, /<a href="\{\{ '\/accessibilite\/' \| relative_url \}\}">Accessibilité : non conforme<\/a>/);
  assert.match(lit("_layouts/default.html"), /\{% include footer\.html %\}/);
  assert.match(frontMatter(lit("index.html")), /^layout: default$/m, "l'accueil a le pied de page commun");
});

test("9 : la page /accessibilite/ porte la déclaration au format officiel", () => {
  assert.ok(existe("accessibilite.md"), "accessibilite.md doit exister");
  const page = lit("accessibilite.md");
  const entete = frontMatter(page);
  assert.match(entete, /^layout: page$/m);
  assert.match(entete, /^title: Accessibilité$/m);
  assert.match(entete, /^permalink: \/accessibilite\/$/m);
  const texte = corps(page);
  assert.match(texte, /La commune de Gâprée s'engage à rendre son site internet accessible conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005\./);
  assert.match(texte, /\*\*non conforme\*\* avec le référentiel général d'amélioration de l'accessibilité \(RGAA\)/);
  assert.match(texte, /Aucun audit de conformité n'a encore été réalisé/);
  for (const titre of ["État de conformité", "Contenus non accessibles", "Établissement de cette déclaration", "Retour d'information et contact", "Voies de recours"]) {
    assert.match(texte, new RegExp("^## " + titre + "$", "m"), titre);
  }
  for (const titre of ["Non-conformités", "Dérogations pour charge disproportionnée", "Contenus non soumis à l'obligation d'accessibilité"]) {
    assert.match(texte, new RegExp("^### " + titre + "$", "m"), titre);
  }
  /* Les contenus non accessibles connus : photos sans description, documents en image. */
  assert.match(texte, /photos .*n'ont pas de description/);
  assert.match(texte, /bon de commande/);
  assert.match(texte, /^Cette déclaration a été établie le \d{1,2} [a-zéû]+ 20\d\d\.$/m);
});

test("9 : signaler un défaut à la mairie, puis saisir le Défenseur des droits", () => {
  const texte = corps(lit("accessibilite.md"));
  const contact = /^## Retour d'information et contact\n([\s\S]*?)^## /m.exec(texte)[1];
  assert.match(contact, /\{\{ site\.data\.mairie\.email \}\}/);
  assert.match(contact, /\{\{ site\.data\.mairie\.telephone \}\}/);
  assert.match(contact, /une semaine/);
  const recours = /^## Voies de recours\n([\s\S]*?)^## /m.exec(texte)[1];
  assert.match(recours, /Défenseur des droits/);
  assert.match(recours, /https:\/\/www\.defenseurdesdroits\.fr\/nous-contacter-355/);
  assert.match(recours, /https:\/\/www\.defenseurdesdroits\.fr\/carte-des-delegues/);
  assert.match(recours, /Libre réponse 71120\n\s*75342 Paris CEDEX 07/);
});

test("9 : schéma pluriannuel et plan de l'année, joignables depuis la déclaration et le sommaire", () => {
  const page = lit("accessibilite.md");
  const texte = corps(page);
  const titres = [...texte.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const schema = titres.find((t) => /^Schéma pluriannuel de mise en accessibilité 20\d\d-20\d\d$/.test(t));
  const plan = titres.find((t) => /^Plan d'actions 20\d\d$/.test(t));
  assert.ok(schema, "titre du schéma pluriannuel");
  assert.ok(plan, "titre du plan d'actions de l'année");
  /* La déclaration renvoie au schéma et au plan par leur ancre. */
  assert.ok(texte.includes("](#" + ancre(schema) + ")"), "lien vers le schéma");
  assert.ok(texte.includes("](#" + ancre(plan) + ")"), "lien vers le plan");
  /* Chaque entrée du sommaire pointe vers un titre de la page. */
  const ancres = [...frontMatter(page).matchAll(/ancre: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ancres.length >= 5);
  for (const a of ancres) assert.ok(titres.map(ancre).includes(a), "ancre sans titre : " + a);
});

test("9 : aucun texte provisoire visible", () => {
  assert.doesNotMatch(lit("accessibilite.md"), PROVISOIRE);
});
