/* Défaut 45 : un seul brouillon par navigateur, que plusieurs onglets écrivent.
   Chaque écriture doit relire le brouillon gardé et n'y appliquer que le geste
   fait ; une publication ne doit retirer que ce qu'elle a publié et qui n'a
   pas changé depuis. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const A = "_actualites/2026-09-11-archives.md";

async function enregistreTexte(p, chemin, texte) {
  p.onglet("actualites");
  await p.attends();
  p.ouvre(chemin);
  await p.attends();
  p.saisit("ch-texte", texte);
  p.clic("btn-enregistrer");
  await p.attends();
}

for (const sansBase of [false, true]) {
  const ou = sansBase ? " (sans IndexedDB, réserve du navigateur)" : "";

  test("défaut 45 : deux onglets enregistrent chacun une modification, le brouillon garde les deux" + ou, async () => {
    const m = creeMonde(siteDeDepart());
    const p1 = ouvrePage(m, { sansBase });
    const p2 = ouvrePage(m, { sansBase });
    await p1.attends();
    await p2.attends();
    await enregistreTexte(p1, H, "Rendez-vous le 24 octobre.");
    await enregistreTexte(p2, A, "Les archives ferment le 30.");
    const b = m.brouillon();
    assert.deepEqual(Object.keys(b.modifies).sort(), [A, H].sort());
    assert.equal(b.modifies[H].texte, "Rendez-vous le 24 octobre.");
    const p3 = ouvrePage(m, { sansBase });
    await p3.attends();
    assert.equal(p3.etat(), "2 modifications ne sont pas encore en ligne.");
  });
}

test("défaut 45 : la publication d'un onglet ne retire que ce qu'il a publié (photos déposées comprises)", async () => {
  const m = creeMonde(siteDeDepart());
  const brouillon = vide();
  brouillon.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: "data:image/jpeg;base64,UEhPVE8tSEFMTE9XRUVO",
    alt: null, photos: [], video: null, texte: "Rendez-vous le 24 octobre." };
  m.poseBrouillon(brouillon);
  const p1 = ouvrePage(m);
  await p1.attends();
  const p2 = ouvrePage(m);
  await p2.attends();
  p2.clic("btn-nouveau");
  await p2.attends();
  p2.saisit("ch-titre", "Fermeture de la mairie");
  p2.saisit("ch-texte", "La mairie sera fermée lundi.");
  p2.clic("btn-enregistrer");
  await p2.attends();

  p1.clic("btn-publier");
  await p1.attends();
  assert.equal(m.publications.length, 1);
  assert.equal(m.televersements.length, 1, "la photo est passée par le dépôt préalable");
  assert.deepEqual(m.publications[0].fichiers.filter((f) => f.texte).map((f) => f.chemin), [H]);

  const b = m.brouillon();
  assert.deepEqual(b.modifies, {}, "la modification publiée est retirée");
  assert.deepEqual(b.nouveaux.actualites.map((x) => x.titre), ["Fermeture de la mairie"], "l'article de l'autre onglet est gardé");
  assert.deepEqual(b.deposees, {});
  const p3 = ouvrePage(m);
  await p3.attends();
  assert.equal(p3.etat(), "1 modification n'est pas encore en ligne.");
});

test("défaut 45 : une entrée publiée mais changée entre-temps dans un autre onglet reste à publier", async () => {
  const m = creeMonde(siteDeDepart());
  const p1 = ouvrePage(m);
  const p2 = ouvrePage(m);
  await p1.attends();
  await p2.attends();
  await enregistreTexte(p1, H, "Rendez-vous le 24 octobre.");
  m.suspend = true;
  p1.clic("btn-publier");
  await p1.attends();
  await enregistreTexte(p2, H, "Rendez-vous le 24 octobre, déguisement conseillé.");
  m.liberePublication();
  await p1.attends();
  const b = m.brouillon();
  assert.deepEqual(Object.keys(b.modifies), [H]);
  assert.equal(b.modifies[H].texte, "Rendez-vous le 24 octobre, déguisement conseillé.");
});

test("défaut 45 : « Annuler les modifications non publiées » n'efface que ce que la page connaît", async () => {
  const m = creeMonde(siteDeDepart());
  const p1 = ouvrePage(m);
  const p2 = ouvrePage(m);
  await p1.attends();
  await p2.attends();
  await enregistreTexte(p1, H, "Rendez-vous le 24 octobre.");
  await enregistreTexte(p2, A, "Les archives ferment le 30.");
  p1.clic("btn-annule-brouillon");
  await p1.attends();
  assert.deepEqual(Object.keys(m.brouillon().modifies), [A]);
  assert.equal(p1.etat(), "1 modification n'est pas encore en ligne.", "la page voit ce qui reste");
});
