/* Défaut 77 : la date proposée pour un nouvel article était la date UTC
   (toISOString) : publié entre minuit et 2 h l'été (1 h l'hiver), il était
   daté et nommé de la veille. Le banc est réglé sur le fuseau de Paris. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

async function nouvelArticle(maintenant) {
  const b = await ouvreBanc({ maintenant });
  b.clic("btn-nouveau");
  await b.pause(5);
  const propose = b.el("ch-date").value;
  b.saisit("ch-titre", "Avis de nuit");
  b.clic("btn-enregistrer");
  await b.pause(5);
  const p = await b.publie();
  const fichier = p.fichiers.find((f) => /^_actualites\//.test(f.chemin));
  b.ferme();
  return { propose, chemin: fichier.chemin, texte: fichier.texte };
}

test("le 6 novembre à 0 h 30 (heure d'hiver) : daté et nommé du 6", async () => {
  const r = await nouvelArticle(new Date(2026, 10, 6, 0, 30, 0));
  assert.equal(r.propose, "2026-11-06");
  assert.equal(r.chemin, "_actualites/2026-11-06-avis-de-nuit.md");
  assert.match(r.texte, /^date: 2026-11-06/m);
});

test("le 14 juillet à 1 h 59 (heure d'été) : daté et nommé du 14", async () => {
  const r = await nouvelArticle(new Date(2026, 6, 14, 1, 59, 0));
  assert.equal(r.propose, "2026-07-14");
  assert.equal(r.chemin, "_actualites/2026-07-14-avis-de-nuit.md");
});

test("témoin : le 5 novembre à 23 h 30, daté du 5", async () => {
  const r = await nouvelArticle(new Date(2026, 10, 5, 23, 30, 0));
  assert.equal(r.propose, "2026-11-05");
  assert.equal(r.chemin, "_actualites/2026-11-05-avis-de-nuit.md");
});

test("un brouillon sans date prend la date locale pour le nom de son fichier", async () => {
  const brouillon = {
    modifies: {}, supprimes: [], reglages: {}, deposees: {},
    nouveaux: { actualites: [{ chemin: "nouveau:actualites:1", titre: "Sans date", date: "", texte: "Texte." }], talents: [], elus: [] }
  };
  const b = await ouvreBanc({ maintenant: new Date(2026, 10, 6, 0, 30, 0), brouillon });
  const p = await b.publie();
  assert.ok(p.fichiers.some((f) => f.chemin === "_actualites/2026-11-06-sans-date.md"), JSON.stringify(p.fichiers.map((f) => f.chemin)));
  b.ferme();
});
