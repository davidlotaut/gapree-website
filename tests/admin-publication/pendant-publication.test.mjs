/* Défauts 14 et 30 : pendant l'envoi d'une publication, le brouillon ne doit
   plus changer. Enregistrer, Supprimer et « Annuler les modifications non
   publiées » sont refusés avec un message, et la barre reste sur
   « Publication en cours… ». */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const A = "_actualites/2026-09-11-archives.md";
const PB = "_elus/pierre-breton.md";

async function pendantUnePublication() {
  const m = creeMonde(siteDeDepart());
  const brouillon = vide();
  brouillon.modifies[H] = { titre: "Halloween 2026", date: "2026-10-01", image: "/assets/img/halloween-a1b2c3d4-aaaaa.jpg",
    alt: null, photos: [], video: null, texte: "Rendez-vous le 24 octobre." };
  m.poseBrouillon(brouillon);
  const p = ouvrePage(m);
  await p.attends();
  m.suspend = true;
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 1, "la publication est partie et attend la réponse du serveur");
  return { m, p };
}

test("défaut 14 : Enregistrer pendant l'envoi est refusé, la saisie reste dans l'éditeur, puis s'enregistre après", async () => {
  const { m, p } = await pendantUnePublication();
  p.ouvre(A);
  await p.attends();
  p.saisit("ch-texte", "Les archives ferment le 30.");
  p.clic("btn-enregistrer");
  await p.attends();
  assert.match(p.dernierToast(), /publication est en cours/i);
  assert.equal(p.el("ch-texte").value, "Les archives ferment le 30.", "l'éditeur reste ouvert avec la saisie");
  assert.deepEqual(Object.keys(m.brouillon().modifies), [H], "rien n'a été ajouté au brouillon");
  assert.equal(p.etat(), "Publication en cours…");
  assert.equal(p.el("btn-publier").disabled, true);

  m.liberePublication();
  await p.attends();
  assert.equal(m.publications.length, 1);
  assert.equal(p.el("ch-texte").value, "Les archives ferment le 30.");
  p.clic("btn-enregistrer");
  await p.attends();
  assert.deepEqual(Object.keys(m.brouillon().modifies), [A], "la correction est enregistrée une fois l'envoi fini");
});

test("défaut 14 : la barre garde « Publication en cours… » et Publier grisé quand on change d'onglet", async () => {
  const { m, p } = await pendantUnePublication();
  p.onglet("talents");
  await p.attends();
  assert.equal(p.etat(), "Publication en cours…");
  assert.equal(p.el("btn-publier").disabled, true);
  m.liberePublication();
  await p.attends();
  assert.notEqual(p.etat(), "Publication en cours…");
});

test("défaut 14 : Supprimer un article ou un élu et enregistrer les Réglages sont refusés pendant l'envoi", async () => {
  const { m, p } = await pendantUnePublication();
  p.ouvre(A);
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();
  assert.equal(p.questions.length, 1, "seule la confirmation de publication a été posée : pas celle de suppression");
  assert.match(p.dernierToast(), /publication est en cours/i);

  p.onglet("elus");
  await p.attends();
  p.ouvre(PB);
  await p.attends();
  p.saisit("ch-fonction", "Adjoint");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();

  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  p.saisit("ch-sous-titre", "Village fleuri");
  p.clic("btn-enregistre-accueil");
  await p.attends();

  const b = m.brouillon();
  assert.deepEqual(Object.keys(b.modifies), [H]);
  assert.deepEqual(b.supprimes, []);
  assert.deepEqual(b.reglages, {});
  assert.ok(p.toasts.filter((t) => /publication est en cours/i.test(t)).length >= 5);
});

test("défaut 30 : « Annuler les modifications non publiées » pendant l'envoi est refusé et dit que l'envoi ne peut plus être arrêté", async () => {
  const { m, p } = await pendantUnePublication();
  p.clic("btn-annule-brouillon");
  await p.attends();
  assert.equal(p.questions.length, 1, "aucune question « Effacer » n'est posée");
  assert.match(p.dernierToast(), /ne peut plus être arrêtée/);
  assert.equal(p.etat(), "Publication en cours…");
  assert.deepEqual(Object.keys(m.brouillon().modifies), [H], "le brouillon n'a pas été effacé");
  m.liberePublication();
  await p.attends();
  assert.equal(m.publications.length, 1);
  assert.ok(!p.toasts.includes("Modifications effacées"));
});
