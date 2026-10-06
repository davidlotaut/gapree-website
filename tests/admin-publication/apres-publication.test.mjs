/* Défauts 10, 3, 57 et 5, contrats 3, 4, 7 et 8 : après « Publié », l'écran
   suit la mise en ligne réelle (relecture de contenu.json toutes les 15 s),
   n'affirme jamais « à jour » avant, garde les valeurs publiées comme base de
   tout élément rouvert, ne recharge plus la page, et lit le texte d'un
   article à la révision exacte que porte contenu.json. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creeMonde, ouvrePage, siteDeDepart, vide, litEnTete, article } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const PB = "_elus/pierre-breton.md";
const MISE_EN_LIGNE = "Mise en ligne en cours : cela prend en général une à trois minutes.";
const EN_LIGNE = "En ligne. Si une page du site est déjà ouverte, rechargez-la pour voir le changement.";

const texteDe = (corps, chemin) => (corps.fichiers.find((f) => f.chemin === chemin) || {}).texte;

async function corrigeHalloween(p) {
  p.onglet("actualites");
  await p.attends();
  p.ouvre(H);
  await p.attends();
  p.saisit("ch-titre", "Halloween 2026");
  p.saisit("ch-texte", "Rendez-vous le 24 octobre.");
  p.clic("btn-enregistrer");
  await p.attends();
}

async function publie(p) {
  p.clic("btn-publier");
  await p.attends();
}

test("défauts 10, 3 et 57 : après « Publié », la barre dit « Mise en ligne en cours », jamais « à jour », et la page ne se recharge pas", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  assert.equal(m.publications.length, 1);
  assert.equal(p.etat(), MISE_EN_LIGNE);
  p.onglet("talents");
  await p.attends();
  assert.equal(p.etat(), MISE_EN_LIGNE, "un changement d'onglet ne fait pas dire « à jour »");
  assert.equal(p.minuteriesDe(60000), 0, "plus de rechargement programmé à 60 s");
  await p.avance(120000);
  assert.equal(p.rechargements, 0);
  assert.equal(p.etat(), MISE_EN_LIGNE, "contenu.json n'a pas changé : toujours en cours");
});

test("défauts 10 et 3 : l'article rouvert avant la mise en ligne montre ce qui a été publié, et la retouche suivante le garde", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  p.onglet("actualites");
  await p.attends();
  assert.ok(p.app().includes("Halloween 2026"), "la liste montre le titre publié");
  p.ouvre(H);
  await p.attends();
  assert.equal(p.el("ch-titre").value, "Halloween 2026");
  assert.equal(p.el("ch-texte").value, "Rendez-vous le 24 octobre.");
  p.saisit("ch-video", "https://youtu.be/abc");
  p.clic("btn-enregistrer");
  await p.attends();
  await publie(p);
  assert.equal(m.publications.length, 2);
  const f = litEnTete(texteDe(m.publications[1], H));
  assert.equal(f.valeurs.title, "Halloween 2026");
  assert.equal(f.corps.trim(), "Rendez-vous le 24 octobre.");
  assert.equal(f.valeurs.video, "https://youtu.be/abc");
});

test("contrat 8 : contenu.json est relu toutes les 15 s, sans cache, jusqu'au commit publié, puis « En ligne. »", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  const lues = m.lecturesContenu.length;
  await p.avance(15000);
  const relue = m.lecturesContenu.slice(lues).pop();
  assert.ok(relue, "contenu.json relu après 15 s");
  assert.match(relue.url, /^contenu\.json\?/, "avec un paramètre qui contourne le cache");
  assert.equal(relue.cache, "no-store");
  assert.equal(p.etat(), MISE_EN_LIGNE);

  m.construit("c1");
  await p.avance(15000);
  assert.equal(p.etat(), EN_LIGNE);
  const apres = m.lecturesContenu.length;
  await p.avance(60000);
  assert.equal(m.lecturesContenu.length, apres, "plus de relecture une fois en ligne");

  p.onglet("actualites");
  await p.attends();
  p.ouvre(H);
  await p.attends();
  assert.equal(p.el("ch-titre").value, "Halloween 2026");
  assert.equal(p.el("ch-texte").value, "Rendez-vous le 24 octobre.");
  assert.deepEqual(m.lectures.pop(), { ref: "c1", chemin: H }, "texte lu à la révision construite");
  assert.equal(p.etat(), "Le site en ligne est à jour.");
});

test("contrat 8 : un commit postérieur au commit publié vaut mise en ligne", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  m.applique({ fichiers: [{ chemin: "_actualites/2026-10-06-autre.md", texte: article("Autre", "2026-10-06", "Autre.") }], suppressions: [] });
  m.construit("c2");
  await p.avance(15000);
  assert.equal(p.etat(), EN_LIGNE);
});

test("contrat 8 : une révision plus ancienne, construite avant la publication mais jamais vue par la page, ne vaut pas mise en ligne", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  m.applique({ fichiers: [{ chemin: "_actualites/2026-10-06-autre.md", texte: article("Autre", "2026-10-06", "Autre.") }], suppressions: [] });
  m.construit("c1");
  await corrigeHalloween(p);
  await publie(p);
  assert.equal(m.publications.length, 1);
  await p.avance(15000);
  assert.equal(p.etat(), MISE_EN_LIGNE, "c1 était déjà en ligne avant la publication (c2)");
  m.construit("c2");
  await p.avance(15000);
  assert.equal(p.etat(), EN_LIGNE);
});

test("défauts 10 et 3 : rechargée pendant la construction, la page garde les valeurs publiées et suit toujours la mise en ligne", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  const q = ouvrePage(m);
  await q.attends();
  assert.equal(q.etat(), MISE_EN_LIGNE);
  q.ouvre(H);
  await q.attends();
  assert.equal(q.el("ch-titre").value, "Halloween 2026");
  assert.equal(q.el("ch-texte").value, "Rendez-vous le 24 octobre.");
  m.construit("c1");
  await q.avance(15000);
  assert.equal(q.etat(), EN_LIGNE);
  const r = ouvrePage(m);
  await r.attends();
  assert.equal(r.etat(), "Le site en ligne est à jour.");
  assert.deepEqual(m.brouillon().publiees, {}, "plus rien à suivre une fois en ligne");
});

test("défaut 3 : le portrait publié reste sur la fiche rouverte, et la retouche suivante le garde sans le renvoyer", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.modifies[PB] = { nom: "Pierre Breton", fonction: "Conseiller municipal", ordre: 4, photo: "data:image/jpeg;base64,UE9SVFJBSVQ=" };
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  await publie(p);
  const ligne1 = litEnTete(texteDe(m.publications[0], PB)).valeurs.photo;
  assert.match(ligne1, /^\/assets\/img\/pierre-breton-.+\.jpg$/);
  p.onglet("elus");
  await p.attends();
  p.ouvre(PB);
  await p.attends();
  assert.equal(p.el("photo-actuelle").hidden, false, "le portrait publié est affiché");
  assert.equal(p.el("photo-actuelle").src, ".." + ligne1);
  p.saisit("ch-fonction", "Conseiller municipal délégué");
  p.clic("btn-enregistrer");
  await p.attends();
  await publie(p);
  const f2 = litEnTete(texteDe(m.publications[1], PB)).valeurs;
  assert.equal(f2.photo, ligne1, "même adresse de portrait");
  assert.equal(f2.fonction, "Conseiller municipal délégué");
  assert.equal(m.televersements.length, 1, "la photo n'est pas renvoyée");
});

test("défaut 3 : les coordonnées de la mairie rouvertes avant la mise en ligne gardent le numéro publié", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("reglages");
  await p.attends();
  p.saisit("ch-telephone", "02 33 99 99 99");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  p.onglet("actualites");
  await p.attends();
  p.onglet("reglages");
  await p.attends();
  assert.equal(p.el("ch-telephone").value, "02 33 99 99 99");
  p.saisit("ch-adresse", "1 rue du Bourg");
  p.clic("btn-enregistre-mairie");
  await p.attends();
  await publie(p);
  const v = litEnTete(texteDe(m.publications[1], "_data/mairie.yml")).valeurs;
  assert.equal(v.telephone, "02 33 99 99 99");
  assert.equal(v.adresse, "1 rue du Bourg");
});

test("contrat 3 (cas c268939) : le texte se lit à la révision de contenu.json, jamais sur main resservi par un cache", async () => {
  const m = creeMonde(siteDeDepart());
  const ancien = m.depot[H];
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  m.construit("c1");
  m.cacheMain = { [H]: ancien };
  const q = ouvrePage(m);
  await q.attends();
  q.ouvre(H);
  await q.attends();
  assert.equal(q.el("ch-titre").value, "Halloween 2026");
  assert.equal(q.el("ch-texte").value, "Rendez-vous le 24 octobre.");
  assert.deepEqual(m.lectures.pop(), { ref: "c1", chemin: H });
});

test("contrat 3 : sans révision dans contenu.json, le texte se lit sur main", async () => {
  const m = creeMonde(siteDeDepart(), { sansRevision: true });
  const p = ouvrePage(m);
  await p.attends();
  p.ouvre(H);
  await p.attends();
  assert.equal(p.el("ch-texte").value, "Rendez-vous le 17 octobre.");
  assert.deepEqual(m.lectures.pop(), { ref: "main", chemin: H });
});

test("contrat 8 : sans révision dans contenu.json, la mise en ligne est tenue pour faite au bout de dix minutes", async () => {
  const m = creeMonde(siteDeDepart(), { sansRevision: true });
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  assert.equal(p.etat(), MISE_EN_LIGNE);
  await p.avance(5 * 60000);
  assert.equal(p.etat(), MISE_EN_LIGNE);
  await p.avance(6 * 60000);
  assert.equal(p.etat(), EN_LIGNE);
});

test("contrat 7 : une réponse « inchangé » vide le brouillon et dit « Le site était déjà à jour. »", async () => {
  const m = creeMonde(siteDeDepart());
  m.repondPublie = () => ({ ok: true, inchange: true });
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  assert.equal(p.etat(), "Le site était déjà à jour.");
  assert.deepEqual(m.brouillon().modifies, {});
  assert.deepEqual(m.brouillon().publiees || {}, {});
  const lues = m.lecturesContenu.length;
  await p.avance(60000);
  assert.equal(m.lecturesContenu.length, lues, "rien à suivre");
});

test("défaut 5 : une saisie commencée après « Publié » n'est plus effacée par un rechargement", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  p.onglet("actualites");
  await p.attends();
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-titre", "Repas des aînés");
  p.saisit("ch-texte", "Le repas aura lieu le 15 novembre.");
  await p.avance(180000);
  assert.equal(p.rechargements, 0);
  assert.equal(p.el("ch-titre").value, "Repas des aînés");
});

test("contrat 4 : contenu.json exporte la révision construite, la date avec l'heure et les pièces jointes", () => {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const gabarit = fs.readFileSync(path.resolve(ici, "../../admin/contenu.json"), "utf8");
  assert.match(gabarit, /"revision": \{\{ site\.github\.build_revision \| jsonify \}\}/);
  assert.match(gabarit, /"date": \{\{ a\.date \| date_to_xmlschema \| jsonify \}\}/);
  assert.match(gabarit, /"date": \{\{ t\.date \| date_to_xmlschema \| jsonify \}\}/);
  assert.match(gabarit, /"documents": \{\{ a\.documents \| jsonify \}\}/);
  assert.doesNotMatch(gabarit, /date: "%Y-%m-%d"/);
});

test("défauts 10 et 45 : « Annuler les modifications non publiées » ne fait pas oublier une publication pas encore en ligne", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  p.onglet("actualites");
  await p.attends();
  p.ouvre("_actualites/2026-09-11-archives.md");
  await p.attends();
  p.saisit("ch-texte", "Brouillon à abandonner.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-annule-brouillon");
  await p.attends();
  assert.deepEqual(m.brouillon().modifies, {});
  assert.equal(p.etat(), MISE_EN_LIGNE);
  p.ouvre(H);
  await p.attends();
  assert.equal(p.el("ch-titre").value, "Halloween 2026", "toujours la version publiée");
});

test("décision David du 06/10 : après dix minutes sans mise en ligne, la barre demande de prévenir, puis « En ligne. » reprend", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  await corrigeHalloween(p);
  await publie(p);
  await p.avance(9 * 60 * 1000);
  assert.equal(p.etat(), MISE_EN_LIGNE, "avant dix minutes, le message habituel");
  await p.avance(75 * 1000);
  assert.equal(p.etat(), "La mise en ligne prend anormalement longtemps : prévenez la personne qui a installé le site.");
  m.construit("c1");
  await p.avance(15000);
  assert.equal(p.etat(), EN_LIGNE);
});
