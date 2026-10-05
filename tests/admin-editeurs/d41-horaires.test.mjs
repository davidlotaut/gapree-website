/* Défaut 41 : l'écran des horaires, les données chargées et le brouillon
   partageaient les mêmes créneaux. Une frappe abandonnée sans « Enregistrer »
   partait à la publication suivante. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

function tapeHeures(b, valeur) {
  const champ = b.document.querySelectorAll(".ligne-horaire input").find((i) => i.dataset.champ === "heures");
  champ.value = valeur;
  champ.tire("input");
}

function heuresAffichees(b) {
  return b.document.querySelectorAll(".ligne-horaire input").find((i) => i.dataset.champ === "heures").value;
}

async function modifieUnArticle(b) {
  b.onglet("actualites");
  await b.pause(5);
  b.ouvre("_actualites/2026-10-05-ronde.md");
  await b.pause(10);
  b.saisit("ch-titre", "Ronde classique ornaise");
  b.clic("btn-enregistrer");
  await b.pause(5);
}

test("B : coordonnées enregistrées, puis frappe abandonnée dans les heures : rien de la frappe ne part", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  b.saisit("ch-telephone", "02 33 99 99 99");
  b.clic("btn-enregistre-mairie");
  await b.pause(5);
  tapeHeures(b, "10h à");
  await modifieUnArticle(b);
  assert.equal(b.brouillon().reglages.mairie.horaires[0].heures, "9h30 à 12h30");
  const yml = b.fichierPublie(await b.publie(), "_data/mairie.yml");
  assert.match(yml, /heures: "9h30 à 12h30"/);
  assert.doesNotMatch(yml, /10h à/);
  b.ferme();
});

test("B2 : enregistrer, partir, revenir, taper sans enregistrer : rien de la frappe ne part", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  b.saisit("ch-telephone", "02 33 99 99 99");
  b.clic("btn-enregistre-mairie");
  await b.pause(5);
  b.onglet("actualites");
  await b.pause(5);
  b.onglet("reglages");
  await b.pause(5);
  tapeHeures(b, "10h à");
  await modifieUnArticle(b);
  const yml = b.fichierPublie(await b.publie(), "_data/mairie.yml");
  assert.match(yml, /heures: "9h30 à 12h30"/);
  b.ferme();
});

test("A : frappe sans aucun enregistrement : l'écran rouvert et les données restent intacts", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  tapeHeures(b, "10h à");
  await modifieUnArticle(b);
  b.onglet("reglages");
  await b.pause(5);
  assert.equal(heuresAffichees(b), "9h30 à 12h30");
  const p = await b.publie();
  assert.equal(b.fichierPublie(p, "_data/mairie.yml"), null, "mairie.yml ne doit pas partir");
  b.ferme();
});

test("la frappe enregistrée, elle, part bien", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  tapeHeures(b, "10h à 12h");
  b.clic("btn-enregistre-mairie");
  await b.pause(5);
  const yml = b.fichierPublie(await b.publie(), "_data/mairie.yml");
  assert.match(yml, /heures: "10h à 12h"/);
  b.ferme();
});
