/* Défaut 4 (part de l'écriture, contrat 9) : une ligne faite seulement de « - »
   ou de « = » sous une ligne de texte en faisait un intertitre sur le site
   (« Bien cordialement. » suivi de « -- » dans l'article des élections). La
   ligne est désormais précédée d'une barre oblique inverse. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";
const corpsDe = (fichier) => fichier.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/\n$/, "");

/* Règle des intertitres « setext » de kramdown : une ligne de texte suivie
   d'une ligne faite seulement de « - » ou de « = » (parser/kramdown/header.rb). */
function intertitresSetext(corps) {
  const lignes = corps.split("\n");
  return lignes.filter((l, i) => i > 0 && /^(-|=)+\s*$/.test(l) && /\S/.test(lignes[i - 1]));
}

async function publieTexte(b, texte) {
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-texte", texte);
  b.clic("btn-enregistrer");
  await b.pause(5);
  return corpsDe(b.fichierPublie(await b.publie(), RONDE));
}

const SIGNATURE = "Nous restons à votre disposition.\n\nBien cordialement.\n--\nLucie RETOUX\nAdjointe";

test("la signature « -- » ne fait plus d'intertitre", async () => {
  const b = await ouvreBanc();
  const corps = await publieTexte(b, SIGNATURE);
  assert.deepEqual(intertitresSetext(corps), []);
  assert.match(corps, /Bien cordialement\.\n\\--\nLucie RETOUX/);
  b.ferme();
});

test("lignes de « = », de longueur 1, mêlées ou entourées d'espaces : toutes neutralisées", async () => {
  const b = await ouvreBanc();
  const corps = await publieTexte(b, "Titre\n=====\nAutre\n-\nEncore\n-=-=\nDernier\n  ---  \nFin");
  assert.deepEqual(intertitresSetext(corps), []);
  assert.match(corps, /^\\=====$/m);
  assert.match(corps, /^\\-$/m);
  assert.match(corps, /^\\-=-=$/m);
  assert.match(corps, /^ {2}\\--- {2}$/m);
  b.ferme();
});

test("les lignes qui ne sont pas faites que de tirets ne bougent pas", async () => {
  const b = await ouvreBanc();
  const texte = "- premier point\n- second point\n\n--- Bien à vous ---\nPrix -- 3 €";
  const corps = await publieTexte(b, texte);
  assert.equal(corps, texte);
  b.ferme();
});

test("aller-retour : l'éditeur rouvert montre « -- » sans barre, et republie à l'identique", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-texte", SIGNATURE);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const fichier = b.fichierPublie(await b.publie(), RONDE);
  b.ferme();

  const b2 = await ouvreBanc();
  b2.raw.textes[RONDE] = fichier;
  b2.ouvre(RONDE);
  await b2.pause(10);
  assert.equal(b2.el("ch-texte").value, SIGNATURE);
  b2.saisit("ch-titre", "Ronde classique ornaise");
  b2.clic("btn-enregistrer");
  await b2.pause(5);
  assert.equal(corpsDe(b2.fichierPublie(await b2.publie(), RONDE)), corpsDe(fichier));
  b2.ferme();
});
