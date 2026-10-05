/* Défaut 36 : Enregistrer avant l'arrivée du texte, ou après un échec de
   chargement, publiait « Chargement du texte… » ou un texte vide. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";
const MESSE = "_actualites/2026-09-11-messe.md";

test("texte lent : le champ et Enregistrer attendent le texte, sans libellé dans le champ", async () => {
  const b = await ouvreBanc();
  b.raw.delai = 200;
  b.ouvre(RONDE);
  await b.pause(10);
  assert.equal(b.el("btn-enregistrer").disabled, true, "Enregistrer doit attendre le texte");
  assert.equal(b.el("ch-texte").disabled, true, "le champ Texte doit attendre le texte");
  assert.doesNotMatch(b.el("ch-texte").value, /Chargement/);
  assert.equal(b.el("etat-texte").hidden, false);
  assert.match(b.el("etat-texte").innerHTML, /Chargement du texte/);
  b.saisit("ch-titre", "Ronde classique ornaise");
  assert.equal(b.clic("btn-enregistrer"), false);
  assert.equal(b.brouillon(), null, "rien ne doit être enregistré avant le texte");

  await b.pause(300);
  assert.equal(b.el("btn-enregistrer").disabled, false);
  assert.equal(b.el("ch-texte").disabled, false);
  assert.equal(b.el("ch-texte").value, "La ronde passe par le bourg.");
  assert.equal(b.el("etat-texte").hidden, true);
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.brouillon().modifies[RONDE].texte, "La ronde passe par le bourg.");
  b.ferme();
});

test("échec du chargement : message qui reste, Enregistrer refusé, « Réessayer » recharge le texte", async () => {
  const b = await ouvreBanc();
  b.raw.echec = true;
  b.ouvre(RONDE);
  await b.pause(20);
  b.saisit("ch-titre", "Ronde classique ornaise");
  assert.equal(b.el("btn-enregistrer").disabled, true);
  assert.equal(b.clic("btn-enregistrer"), false);
  await b.pause(10);
  assert.equal(b.brouillon(), null, "un article ne doit jamais partir avec un texte vide");
  assert.equal(b.el("etat-texte").hidden, false);
  assert.match(b.el("etat-texte").innerHTML, /n'a pas pu être chargé/);
  assert.ok(b.el("btn-reessayer-texte"), "bouton Réessayer absent");

  b.raw.echec = false;
  b.clic("btn-reessayer-texte");
  await b.pause(20);
  assert.equal(b.el("ch-texte").value, "La ronde passe par le bourg.");
  assert.equal(b.el("btn-enregistrer").disabled, false);
  assert.equal(b.el("etat-texte").hidden, true);
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.brouillon().modifies[RONDE].titre, "Ronde classique ornaise");
  assert.equal(b.brouillon().modifies[RONDE].texte, "La ronde passe par le bourg.");
  b.ferme();
});

test("le gestionnaire d'Enregistrer refuse aussi tant que le texte manque", async () => {
  const b = await ouvreBanc();
  b.raw.delai = 200;
  b.ouvre(RONDE);
  await b.pause(10);
  b.el("btn-enregistrer").disabled = false;
  b.el("btn-enregistrer").tire("click");
  await b.pause(5);
  assert.equal(b.brouillon(), null);
  assert.match(b.dernierToast(), /texte/i);
  b.ferme();
});

test("un article neuf s'enregistre sans attendre : il n'a rien à charger", async () => {
  const b = await ouvreBanc();
  b.clic("btn-nouveau");
  await b.pause(5);
  assert.equal(b.el("btn-enregistrer").disabled, false);
  assert.equal(b.el("ch-texte").disabled, false);
  b.saisit("ch-titre", "Repas communal");
  b.saisit("ch-texte", "Rendez-vous à midi.");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.brouillon().nouveaux.actualites[0].texte, "Rendez-vous à midi.");
  b.ferme();
});

test("le texte d'un article arrivé en retard n'écrit pas dans l'éditeur d'un autre", async () => {
  const b = await ouvreBanc();
  b.raw.delais[RONDE] = 300;
  b.ouvre(RONDE);
  await b.pause(10);
  b.clic("btn-retour");
  await b.pause(5);
  b.ouvre(MESSE);
  await b.pause(450);
  assert.equal(b.el("ch-titre").value, "Messe annuelle");
  assert.equal(b.el("ch-texte").value, "Chaque année a lieu une messe.");
  assert.match(b.el("apercu").innerHTML, /<h1>Messe annuelle<\/h1>/);
  assert.match(b.el("apercu").innerHTML, /Chaque année a lieu une messe/);
  assert.doesNotMatch(b.el("apercu").innerHTML, /La ronde passe/);
  b.ferme();
});
