/* Défaut 38 : pendant la préparation des photos, Enregistrer ou changer
   d'écran les perdait sans message, et elles pouvaient s'afficher dans
   l'éditeur d'un autre article. Même faute pour le portrait d'élu et la photo
   d'accueil. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc, photos, photo } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";

function onglets(b) { return b.document.querySelectorAll(".onglets button"); }

test("article : pendant la préparation, Enregistrer, retour, Annuler, Supprimer et onglets attendent", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.choisit("ch-images", photos(3, { delai: 60 }));
  await b.pause(70);
  for (const id of ["btn-enregistrer", "btn-retour", "btn-annuler", "btn-supprimer", "ch-images"]) {
    assert.equal(b.el(id).disabled, true, id + " doit attendre la fin de la préparation");
  }
  assert.ok(onglets(b).every((o) => o.disabled), "les onglets doivent attendre");
  assert.equal(b.clic("btn-enregistrer"), false);
  assert.equal(b.onglet("reglages"), false);
  await b.pause(300);
  assert.deepEqual(b.erreurs, []);
  for (const id of ["btn-enregistrer", "btn-retour", "btn-annuler", "btn-supprimer", "ch-images"]) {
    assert.equal(b.el(id).disabled, false, id + " doit revenir après la préparation");
  }
  assert.ok(onglets(b).every((o) => !o.disabled));
  assert.equal(b.document.querySelectorAll(".photo-ligne").length, 5);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const m = b.brouillon().modifies[RONDE];
  assert.equal(m.image, "/assets/img/ronde.jpg");
  assert.equal(m.photos.length, 4, "la photo d'origine et les 3 nouvelles");
  b.ferme();
});

test("article : des photos préparées pour un éditeur fermé n'apparaissent pas dans un autre", async () => {
  const b = await ouvreBanc();
  b.clic("btn-nouveau");
  await b.pause(5);
  b.saisit("ch-titre", "Repas communal 2027");
  b.choisit("ch-images", photos(4, { delai: 50 }));
  await b.pause(60);
  /* Une sortie forcée (aucune n'est offerte à l'écran pendant la préparation). */
  b.el("btn-retour").disabled = false;
  b.el("btn-retour").tire("click");
  await b.pause(5);
  b.ouvre(RONDE);
  await b.pause(400);
  assert.deepEqual(b.erreurs, [], "aucune erreur non rattrapée");
  assert.equal(b.el("ch-titre").value, "Ronde classique");
  assert.equal(b.document.querySelectorAll(".photo-ligne").length, 2, "seules les photos de Ronde");
  assert.doesNotMatch(b.el("apercu").innerHTML, /Repas communal 2027/);
  assert.ok(b.toasts.some((t) => /n'ont pas été ajoutées/.test(t)), "la perte est dite");
  b.ferme();
});

test("article : vider le brouillon pendant la préparation ne fait pas apparaître les photos ailleurs", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.choisit("ch-images", photos(2, { delai: 60 }));
  await b.pause(30);
  b.clic("btn-annule-brouillon");
  await b.pause(300);
  assert.deepEqual(b.erreurs, []);
  assert.equal(b.document.querySelectorAll(".photo-ligne").length, 2, "l'éditeur rouvert garde ses seules photos");
  assert.ok(onglets(b).every((o) => !o.disabled), "les onglets reviennent");
  b.ferme();
});

test("portrait d'élu : Enregistrer attend la photo, et une fiche fermée ne reçoit rien ni faux message", async () => {
  const b = await ouvreBanc();
  b.onglet("elus");
  await b.pause(5);
  b.ouvre("_elus/second-elu.md");
  await b.pause(5);
  b.choisit("ch-image", [photo("portrait.jpg", { delai: 80 })]);
  await b.pause(10);
  for (const id of ["btn-enregistrer", "btn-retour", "btn-annuler", "btn-supprimer", "ch-image"]) {
    assert.equal(b.el(id).disabled, true, id + " doit attendre la photo");
  }
  assert.ok(onglets(b).every((o) => o.disabled));
  await b.pause(150);
  assert.equal(b.el("btn-enregistrer").disabled, false);
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.match(b.brouillon().modifies["_elus/second-elu.md"].photo, /^data:image\/jpeg;base64,/);

  /* Fiche fermée (sortie forcée) avant la fin : rien n'est écrit, aucun faux « illisible ». */
  b.ouvre("_elus/premiere-elue.md");
  await b.pause(5);
  b.choisit("ch-image", [photo("portrait-2.jpg", { delai: 80 })]);
  await b.pause(10);
  b.el("btn-retour").disabled = false;
  b.el("btn-retour").tire("click");
  await b.pause(5);
  b.ouvre("_elus/second-elu.md");
  await b.pause(150);
  assert.deepEqual(b.erreurs, []);
  assert.ok(!b.toasts.some((t) => /n'a pas pu être lue/.test(t)), "aucun faux message de photo illisible");
  assert.equal(b.brouillon().modifies["_elus/premiere-elue.md"], undefined);
  b.ferme();
});

test("photo d'accueil : Enregistrer et onglets attendent la photo, puis elle est bien enregistrée", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  b.choisit("ch-photo-accueil", [photo("accueil.jpg", { delai: 80 })]);
  await b.pause(10);
  assert.equal(b.el("btn-enregistre-accueil").disabled, true);
  assert.ok(onglets(b).every((o) => o.disabled));
  await b.pause(150);
  assert.equal(b.el("btn-enregistre-accueil").disabled, false);
  assert.ok(onglets(b).every((o) => !o.disabled));
  b.clic("btn-enregistre-accueil");
  await b.pause(5);
  assert.match(b.brouillon().reglages.accueil.photo, /^data:image\/jpeg;base64,/);
  b.ferme();
});
