/* Défauts 42 et 5 : une saisie faite dans un éditeur et pas encore
   enregistrée n'est plus perdue sans question : confirmation avant un onglet,
   « ← » ou la déconnexion, et le navigateur prévient à la fermeture.
   « Annuler » reste direct, et rien n'est demandé quand rien n'a été saisi. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const PB = "_elus/pierre-breton.md";
const QUESTION = /pas enregistré/;
/* Seules comptent les questions sur une saisie non enregistrée : d'autres
   confirmations (photo sans description, suppression…) relèvent d'autres lots. */
const questionsSaisie = (p) => p.questions.filter((q) => QUESTION.test(q));

async function nouvelleActualiteTapee(p) {
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-titre", "Coupure d'eau");
  p.saisit("ch-texte", "Coupure d'eau jeudi matin.");
}

test("défaut 42 : un onglet touché pendant une saisie non enregistrée demande confirmation, et « non » garde la saisie", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await nouvelleActualiteTapee(p);
  p.reponses.push(false);
  p.onglet("elus");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1);
  assert.match(questionsSaisie(p)[0], QUESTION);
  assert.equal(p.el("ch-titre").value, "Coupure d'eau", "l'éditeur est toujours là");
  p.reponses.push(true);
  p.onglet("elus");
  await p.attends();
  assert.ok(p.app().includes("Équipe municipale"));
  p.onglet("actualites");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 2, "la liste quittée sans saisie ne demande rien");
});

test("défaut 42 : « ← » pendant une saisie non enregistrée demande confirmation ; « Annuler » reste direct", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await nouvelleActualiteTapee(p);
  p.reponses.push(false);
  p.clic("btn-retour");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1);
  assert.equal(p.el("ch-texte").value, "Coupure d'eau jeudi matin.");
  p.clic("btn-annuler");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1, "Annuler efface sans question, comme son nom le dit");
  assert.equal(p.el("ch-titre"), null);
});

test("défauts 42 et 5 : le navigateur prévient à la fermeture quand une saisie n'est pas enregistrée", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  assert.equal(p.retiendrait(), false);
  await nouvelleActualiteTapee(p);
  assert.equal(p.retiendrait(), true);
  p.clic("btn-annuler");
  await p.attends();
  assert.equal(p.retiendrait(), false);
});

test("défaut 42 : après « Enregistrer », plus de question ; ouvrir puis quitter sans rien taper non plus", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.ouvre(H);
  await p.attends();
  p.onglet("talents");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 0, "rien n'a été saisi");
  p.onglet("actualites");
  await p.attends();
  p.ouvre(H);
  await p.attends();
  p.saisit("ch-texte", "Rendez-vous le 24 octobre.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.onglet("talents");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 0);
});

test("défaut 42 : dans les Réglages, chaque panneau compte à part", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-sous-titre", "Village fleuri");
  p.clic("btn-enregistre-accueil");
  await p.attends();
  p.onglet("actualites");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 0, "le panneau d'accueil a été enregistré");

  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.saisit("ch-sous-titre", "Village fleuri et calme");
  p.clic("btn-enregistre-accueil");
  await p.attends();
  p.reponses.push(false);
  p.onglet("actualites");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1, "le téléphone tapé n'est pas enregistré");
  assert.equal(p.el("ch-telephone").value, "02 33 99 99 99");
});

test("défaut 42 : retirer un portrait compte comme une saisie", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("elus");
  await p.attends();
  p.ouvre(PB);
  await p.attends();
  p.clic("btn-retire-photo");
  p.reponses.push(false);
  p.onglet("actualites");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1);
});

test("défaut 42 : l'onglet Accès ne compte pas comme un éditeur", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("acces");
  await p.attends();
  p.saisit("ch-nouvel-email", "quelqu-un@exemple.fr");
  p.onglet("actualites");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 0);
});

test("défaut 42 : se déconnecter avec une saisie non enregistrée demande confirmation", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await nouvelleActualiteTapee(p);
  p.reponses.push(false);
  p.clic("btn-deconnexion");
  await p.attends();
  assert.equal(questionsSaisie(p).length, 1);
  assert.equal(m.connecte, true);
});
