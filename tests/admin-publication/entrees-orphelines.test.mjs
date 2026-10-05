/* Défaut 43 : une entrée du brouillon qui vise un fichier absent de
   contenu.json (supprimé par quelqu'un d'autre) est signalée, ne part plus à
   la publication, et se retire seule. Même traitement pour une entrée que le
   serveur refuse (409) parce que le fichier a changé depuis son ouverture :
   sans cela, ce refus bloquerait toute publication. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide, SERVEUR } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const A = "_actualites/2026-09-11-archives.md";

function modification(titre, texte) {
  return { titre, date: "2026-09-11", image: null, alt: null, photos: [], video: null, texte };
}

/* Le site où une autre personne a supprimé « Archives », construction faite. */
function siteSansArchives() {
  const m = creeMonde(siteDeDepart());
  m.applique({ fichiers: [], suppressions: [A] });
  m.construit("c1");
  return m;
}

const lignes = (p) => (p.el("entrees-bloquees") && !p.el("entrees-bloquees").hidden ? p.el("entrees-bloquees").querySelectorAll("p") : []);
const boutonRetirer = (p, i) => p.el("entrees-bloquees").querySelectorAll("button")[i || 0];

test("défaut 43 : une modification d'un article supprimé entre-temps est signalée, n'est pas publiée, et se retire seule", async () => {
  const m = siteSansArchives();
  const b = vide();
  b.modifies[A] = modification("Archives (corrigé)", "Les archives ferment le 30.");
  b.modifies[H] = modification("Halloween", "Rendez-vous le 24 octobre.");
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  assert.equal(lignes(p).length, 1);
  assert.match(lignes(p)[0].textContent, /« Archives \(corrigé\) » a été supprimé du site entre-temps/);
  assert.equal(p.etat(), "1 modification n'est pas encore en ligne.", "seule la modification publiable est comptée");

  p.clic("btn-publier");
  await p.attends();
  const corps = m.publications[0];
  assert.deepEqual(corps.fichiers.map((f) => f.chemin), [H], "l'article supprimé n'est pas recréé");
  assert.equal(m.depot[A], undefined);
  assert.deepEqual(Object.keys(m.brouillon().modifies), [A], "l'entrée signalée reste jusqu'à ce qu'on la retire");

  boutonRetirer(p).tire("click");
  await p.attends();
  assert.deepEqual(m.brouillon().modifies, {});
  assert.equal(lignes(p).length, 0);
});

test("défaut 43 : une suppression d'un fichier déjà retiré est signalée et se retire seule", async () => {
  const m = siteSansArchives();
  const b = vide();
  b.supprimes.push(A);
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  assert.equal(lignes(p).length, 1);
  assert.match(lignes(p)[0].textContent, /n'est déjà plus sur le site/);
  assert.equal(p.el("btn-publier").disabled, true, "rien de publiable");
  boutonRetirer(p).tire("click");
  await p.attends();
  assert.deepEqual(m.brouillon().supprimes, []);
});

test("défaut 43 : sans retrait, une entrée signalée ne bloque pas la publication du reste", async () => {
  const m = siteSansArchives();
  const b = vide();
  b.modifies[A] = modification("Archives", "x");
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.ouvre(H);
  await p.attends();
  p.saisit("ch-texte", "Rendez-vous le 24 octobre.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 1);
  assert.deepEqual(m.publications[0].fichiers.map((f) => f.chemin), [H]);
});

test("défaut 43 : un refus 409 signale les entrées en conflit, les écarte des publications suivantes et permet de les retirer", async () => {
  const m = creeMonde(siteDeDepart());
  const message = "Rien n'a été publié : entre-temps, quelqu'un d'autre a changé " + H + ". Reprenez ces modifications à partir de la version en ligne.";
  m.repondPublie = (corps) => {
    if (corps.fichiers.some((f) => f.chemin === H)) throw Object.assign(new Error(message), { statut: 409, conflits: [H] });
    return m.applique(corps);
  };
  const b = vide();
  b.modifies[H] = modification("Halloween", "Rendez-vous le 24 octobre.");
  b.bases = { [H]: "c0" };
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 1, "pas de nouvel essai automatique sur un refus");
  assert.equal(p.etat(), message);
  assert.equal(lignes(p).length, 1);
  assert.match(lignes(p)[0].textContent, /« Halloween » a été changé par quelqu'un d'autre/);
  assert.deepEqual(Object.keys(m.brouillon().modifies), [H], "le brouillon est intact");

  p.ouvre(A);
  await p.attends();
  p.saisit("ch-texte", "Les archives ferment le 30.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 2);
  assert.deepEqual(m.publications[1].fichiers.map((f) => f.chemin), [A]);
  boutonRetirer(p).tire("click");
  await p.attends();
  assert.deepEqual(m.brouillon().modifies, {});
});

test("défaut 43 : un nouvel article refusé parce que son nom vient d'être pris repart sous un autre nom", async () => {
  const m = creeMonde(siteDeDepart());
  const pris = "_actualites/2026-10-06-fermeture-de-la-mairie.md";
  m.repondPublie = (corps) => {
    if (corps.fichiers.some((f) => f.chemin === pris)) {
      throw Object.assign(new Error("Rien n'a été publié : entre-temps, quelqu'un d'autre a changé " + pris + "."), { statut: 409, conflits: [pris] });
    }
    return m.applique(corps);
  };
  const b = vide();
  b.nouveaux.actualites.push({ chemin: "nouveau:actualites:1", titre: "Fermeture de la mairie", date: "2026-10-06",
    image: null, alt: null, photos: [], video: null, texte: "Fermée lundi." });
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 2);
  assert.deepEqual(m.publications[1].fichiers.map((f) => f.chemin), ["_actualites/2026-10-06-fermeture-de-la-mairie-2.md"]);
  assert.deepEqual(m.brouillon().nouveaux.actualites, []);
});

test("défaut 43 : un refus ne renvoie pas les photos déjà déposées", async () => {
  const m = creeMonde(siteDeDepart());
  m.repondPublie = () => { throw Object.assign(new Error("Rien n'a été publié."), { statut: 409, conflits: [H] }); };
  const b = vide();
  b.modifies[H] = Object.assign(modification("Halloween", "x"), { image: "data:image/jpeg;base64,UEhPVE8=" });
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.televersements.length, 1);
  assert.equal(m.publications.length, 1);
});

test("défaut 43 : publication.js transmet le statut et la liste des conflits du serveur", async () => {
  const m = creeMonde(siteDeDepart());
  m.stock.set("gapree-session", "jeton-du-banc");
  m.serveur = (chemin) => {
    if (chemin === "/moi") return { statut: 200, corps: { email: "compte-du-banc", admin: true, doitChangerMotDePasse: false } };
    if (chemin === "/journal") return { statut: 200, corps: { ok: true } };
    if (chemin === "/publier") return { statut: 409, corps: { erreur: "Rien n'a été publié : entre-temps, quelqu'un d'autre a changé " + H + ".", conflits: [H] } };
    return { statut: 404, corps: { erreur: "Adresse inconnue." } };
  };
  const b = vide();
  b.modifies[H] = modification("Halloween", "x");
  m.poseBrouillon(b);
  const p = ouvrePage(m, { vraiePublication: true });
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.match(p.etat(), /quelqu'un d'autre a changé/);
  assert.equal(lignes(p).length, 1);
  assert.ok(SERVEUR);
});
