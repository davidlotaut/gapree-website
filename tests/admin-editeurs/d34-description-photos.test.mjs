/* Défaut 34 : l'éditeur ne disait ni à quoi sert la description d'une photo,
   ni qu'il faut recopier le texte d'un document photographié : 115 images sur
   116 ont été publiées sans description. Libellé visible, aide, et
   confirmation (pas d'obligation) quand la photo principale n'en a pas. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const ELECTIONS = "_actualites/2026-10-05-elections.md";   // photo principale sans description
const RONDE = "_actualites/2026-10-05-ronde.md";           // principale décrite, seconde non
const LIBELLE = "Description, lue aux personnes malvoyantes";

test("chaque photo a un libellé visible relié à son champ, et l'aide parle des documents", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  const champs = b.document.querySelectorAll(".photo-alt");
  assert.equal(champs.length, 2);
  const zone = b.el("liste-photos").innerHTML;
  for (const champ of champs) {
    assert.ok(champ.id, "champ de description sans id");
    assert.ok(zone.includes('for="' + champ.id + '">' + LIBELLE + "</label>"), "libellé absent pour " + champ.id);
  }
  assert.match(b.el("app").innerHTML, /si la photo montre un document, recopiez son texte dans l'article/i);
  b.ferme();
});

test("photo principale sans description : confirmation, et rien n'est enregistré si l'on refuse", async () => {
  const b = await ouvreBanc({ reponseConfirm: false });
  b.ouvre(ELECTIONS);
  await b.pause(10);
  b.saisit("ch-titre", "Informations élections 2027");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.confirmations.length, 1);
  assert.match(b.confirmations[0], /description/);
  assert.equal(b.brouillon(), null);
  b.ferme();
});

test("photo principale sans description : enregistrée quand on confirme (pas d'obligation)", async () => {
  const b = await ouvreBanc({ reponseConfirm: true });
  b.ouvre(ELECTIONS);
  await b.pause(10);
  b.saisit("ch-titre", "Informations élections 2027");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.confirmations.length, 1);
  assert.equal(b.brouillon().modifies[ELECTIONS].titre, "Informations élections 2027");
  b.ferme();
});

test("aucune question quand la photo principale est décrite, ou sans photo", async () => {
  const b = await ouvreBanc({ reponseConfirm: false });
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-titre", "Ronde ornaise");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.brouillon().modifies[RONDE].titre, "Ronde ornaise");

  b.clic("btn-nouveau");
  await b.pause(5);
  b.saisit("ch-titre", "Sans photo");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.confirmations.length, 0);
  assert.equal(b.brouillon().nouveaux.actualites.length, 1);
  b.ferme();
});

test("une description tapée lève la question", async () => {
  const b = await ouvreBanc({ reponseConfirm: false });
  b.ouvre(ELECTIONS);
  await b.pause(10);
  const champ = b.document.querySelectorAll(".photo-alt")[0];
  champ.value = "Affiche Élections 2027";
  champ.tire("input");
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.equal(b.confirmations.length, 0);
  assert.equal(b.brouillon().modifies[ELECTIONS].alt, "Affiche Élections 2027");
  b.ferme();
});
