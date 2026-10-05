/* Défaut 17 : une accolade double ou un {% dans le texte d'un article faisait
   échouer la construction du site (Liquid), alors que l'écran disait « Publié ».
   Contrat 9 : « { » suivi de « { » ou de « % » s'écrit &#123;. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";
const SAISIE = "Tarif : 12 € {{ sous réserve\n\nDate {% à confirmer %} et {{prénom}}.\n\nTrois : {{{ et { seule.";

/* Ce que Jekyll 3.10 teste avant de passer un document à Liquid (utils.rb). */
const passeParLiquid = (texte) => texte.includes("{%") || texte.includes("{{");
const corpsDe = (fichier) => fichier.replace(/^---\n[\s\S]*?\n---\n/, "");

async function publieTexte(b, chemin, texte) {
  b.ouvre(chemin);
  await b.pause(10);
  b.saisit("ch-texte", texte);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const p = await b.publie();
  return b.fichierPublie(p, chemin);
}

test("le corps publié ne contient plus ni {{ ni {%, et se lit pareil", async () => {
  const b = await ouvreBanc();
  const fichier = await publieTexte(b, RONDE, SAISIE);
  const corps = corpsDe(fichier);
  assert.equal(passeParLiquid(corps), false, "Liquid lirait encore une balise : " + corps);
  assert.match(corps, /Tarif : 12 € &#123;\{ sous réserve/);
  assert.match(corps, /Date &#123;% à confirmer %\} et &#123;\{prénom\}\}\./);
  assert.match(corps, /Trois : &#123;&#123;\{ et \{ seule\./);
  b.ferme();
});

test("un titre avec des accolades reste tel quel (l'en-tête ne passe pas par Liquid)", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-titre", "Fête {{ du village }}");
  b.clic("btn-enregistrer");
  await b.pause(5);
  const fichier = b.fichierPublie(await b.publie(), RONDE);
  assert.match(fichier, /^title: "Fête \{\{ du village \}\}"$/m);
  b.ferme();
});

test("aller-retour : l'article relu montre le texte tapé, et republié il ne change pas", async () => {
  const b = await ouvreBanc();
  const fichier = await publieTexte(b, RONDE, SAISIE);
  b.ferme();

  const b2 = await ouvreBanc();
  b2.raw.textes[RONDE] = fichier;
  b2.ouvre(RONDE);
  await b2.pause(10);
  assert.equal(b2.el("ch-texte").value, SAISIE, "l'éditeur doit montrer le texte tel qu'il a été tapé");
  b2.saisit("ch-titre", "Ronde classique ornaise");
  b2.clic("btn-enregistrer");
  await b2.pause(5);
  const fichier2 = b2.fichierPublie(await b2.publie(), RONDE);
  assert.equal(corpsDe(fichier2), corpsDe(fichier));
  b2.ferme();
});
