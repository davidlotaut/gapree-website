/* Contrat 2, côté espace d'administration : chaque modification ou
   suppression du brouillon garde la révision en vigueur quand l'élément a été
   ouvert, et l'envoie comme « base » ; un nouvel élément part avec
   « nouveau: true ». Sans révision dans contenu.json, aucune base. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide, article } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const A = "_actualites/2026-09-11-archives.md";

const fichier = (corps, chemin) => corps.fichiers.find((f) => f.chemin === chemin);

async function modifieTexte(p, chemin, texte) {
  p.onglet("actualites");
  await p.attends();
  p.ouvre(chemin);
  await p.attends();
  p.saisit("ch-texte", texte);
  p.clic("btn-enregistrer");
  await p.attends();
}

async function publie(p) {
  p.clic("btn-publier");
  await p.attends();
}

test("contrat 2 : modification, suppression et réglages partent avec la révision d'ouverture ; un ajout part « nouveau »", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await modifieTexte(p, H, "Rendez-vous le 24 octobre.");
  p.ouvre(A);
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-titre", "Fermeture de la mairie");
  p.saisit("ch-texte", "Fermée lundi.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);

  const corps = m.publications[0];
  assert.equal(fichier(corps, H).base, "c0");
  assert.equal(fichier(corps, H).nouveau, undefined);
  assert.equal(fichier(corps, "_data/mairie.yml").base, "c0");
  const nouveau = corps.fichiers.find((f) => /fermeture-de-la-mairie\.md$/.test(f.chemin));
  assert.equal(nouveau.nouveau, true);
  assert.equal(nouveau.base, undefined);
  assert.deepEqual(corps.suppressions, [{ chemin: A, base: "c0" }]);
});

test("contrat 2 : la base reste celle de la première ouverture, même rouverte plus tard sur une révision plus récente", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await modifieTexte(p, H, "Rendez-vous le 24 octobre.");
  m.applique({ fichiers: [{ chemin: "_actualites/2026-10-06-autre.md", texte: article("Autre", "2026-10-06", "Autre.") }], suppressions: [] });
  m.construit("c1");
  const q = ouvrePage(m);
  await q.attends();
  await modifieTexte(q, H, "Rendez-vous le 24 octobre à 18 h.");
  q.ouvre(A);
  await q.attends();
  q.saisit("ch-texte", "Les archives ferment le 30.");
  q.clic("btn-enregistrer");
  await q.attends();
  await publie(q);
  const corps = m.publications[0];
  assert.equal(fichier(corps, H).base, "c0", "H a été ouvert sur c0");
  assert.equal(fichier(corps, A).base, "c1", "A a été ouvert sur c1");
});

test("contrat 2 : un élément rouvert avant la mise en ligne a pour base le commit publié", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await modifieTexte(p, H, "Rendez-vous le 24 octobre.");
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  await modifieTexte(p, H, "Rendez-vous le 24 octobre, déguisement conseillé.");
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-adresse", "1 rue du Bourg");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  const corps = m.publications[1];
  assert.equal(fichier(corps, H).base, "c1");
  assert.equal(fichier(corps, "_data/mairie.yml").base, "c1");
});

test("contrat 2 : les Réglages restés ouverts pendant une publication prennent le commit publié pour base", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  p.saisit("ch-adresse", "1 rue du Bourg");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  assert.equal(fichier(m.publications[1], "_data/mairie.yml").base, "c1");
});

test("contrat 2 : sans révision dans contenu.json, aucune base n'est envoyée", async () => {
  const m = creeMonde(siteDeDepart(), { sansRevision: true });
  const p = ouvrePage(m);
  await p.attends();
  await modifieTexte(p, H, "Rendez-vous le 24 octobre.");
  p.ouvre(A);
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();
  await publie(p);
  const corps = m.publications[0];
  assert.equal(fichier(corps, H).base, undefined);
  assert.deepEqual(corps.suppressions, [A]);
});

test("contrat 2 : un brouillon d'avant la règle, sans base, n'en reçoit pas après coup", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: "/assets/img/halloween-a1b2c3d4-aaaaa.jpg", alt: null,
    photos: [], video: null, texte: "Ancien brouillon." };
  b.supprimes.push(A);
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  await modifieTexte(p, H, "Ancien brouillon, retouché.");
  await publie(p);
  const corps = m.publications[0];
  assert.equal(fichier(corps, H).base, undefined, "la version vue à l'origine n'est pas connue");
  assert.deepEqual(corps.suppressions, [A]);
});
