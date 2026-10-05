/* Défaut 21 : les actualités n'avaient qu'une date sans heure ; entre articles
   du même jour, le site les classait par nom de fichier, et la dernière publiée
   pouvait manquer à l'accueil. Contrat 5 : « date: AAAA-MM-JJ HH:MM:SS +HHMM »
   à l'heure locale. Le banc est réglé sur le fuseau de Paris, heure figée au
   05/10/2026 à 14 h 32 min 10 s. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const MAINTENANT = new Date(2026, 9, 5, 14, 32, 10);
const ELECTIONS = "_actualites/2026-10-05-elections.md";   // 2026-10-05T12:06:58+02:00 dans contenu.json
const RONDE = "_actualites/2026-10-05-ronde.md";           // 2026-10-05T00:00:00+02:00 : sans heure
const MESSE = "_actualites/2026-09-11-messe.md";           // 2026-09-11 : ancien format, sans heure

const ligneDate = (texte) => (texte.match(/^date: .*$/m) || [""])[0];

async function modifie(chemin, changements, options) {
  const b = await ouvreBanc(Object.assign({ maintenant: MAINTENANT }, options));
  b.ouvre(chemin);
  await b.pause(10);
  const propose = b.el("ch-date").value;
  for (const [id, v] of Object.entries(changements)) b.saisit(id, v);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const texte = b.fichierPublie(await b.publie(), chemin);
  b.ferme();
  return { propose, date: ligneDate(texte) };
}

test("un nouvel article prend l'heure de sa création ; son fichier garde le jour local", async () => {
  const b = await ouvreBanc({ maintenant: MAINTENANT });
  b.clic("btn-nouveau");
  await b.pause(5);
  assert.equal(b.el("ch-date").value, "2026-10-05");
  b.saisit("ch-titre", "Élections : bureau de vote");
  b.clic("btn-enregistrer");
  await b.pause(5);
  const p = await b.publie();
  const f = p.fichiers.find((x) => /^_actualites\//.test(x.chemin));
  assert.equal(f.chemin, "_actualites/2026-10-05-elections-bureau-de-vote.md");
  assert.equal(ligneDate(f.texte), "date: 2026-10-05 14:32:10 +0200");
  b.ferme();
});

test("un nouveau portrait de talent prend aussi l'heure", async () => {
  const b = await ouvreBanc({ maintenant: new Date(2026, 11, 24, 9, 5, 0) });
  b.onglet("talents");
  await b.pause(5);
  b.clic("btn-nouveau");
  await b.pause(5);
  b.saisit("ch-titre", "Apicultrice");
  b.clic("btn-enregistrer");
  await b.pause(5);
  const f = (await b.publie()).fichiers.find((x) => /^_talents\//.test(x.chemin));
  assert.equal(ligneDate(f.texte), "date: 2026-12-24 09:05:00 +0100");
  b.ferme();
});

test("article existant à l'heure connue : le champ montre le jour, l'heure est gardée", async () => {
  const r = await modifie(ELECTIONS, { "ch-titre": "Informations élections 2027" });
  assert.equal(r.propose, "2026-10-05");
  assert.equal(r.date, "date: 2026-10-05 12:06:58 +0200");
});

test("article existant sans heure, jour inchangé : il reste daté du jour seul", async () => {
  assert.equal((await modifie(RONDE, { "ch-titre": "Ronde ornaise" })).date, "date: 2026-10-05");
  const messe = await modifie(MESSE, { "ch-titre": "Messe annuelle 2026" });
  assert.equal(messe.propose, "2026-09-11");
  assert.equal(messe.date, "date: 2026-09-11");
});

test("article existant sans heure dont le jour change : il prend l'heure du moment", async () => {
  assert.equal((await modifie(MESSE, { "ch-date": "2026-09-12" })).date, "date: 2026-09-12 14:32:10 +0200");
});

test("article à l'heure connue dont le jour change : même heure, décalage du nouveau jour", async () => {
  assert.equal((await modifie(ELECTIONS, { "ch-date": "2026-12-01" })).date, "date: 2026-12-01 12:06:58 +0100");
});

test("trois avis du même jour se classent dans l'ordre de leur création, pas de leur nom", async () => {
  const dates = [];
  /* Par nom de fichier, l'ordre serait zone, camera, annonce : la dernière publiée en dernier. */
  for (const [heure, titre] of [[[11, 36, 0], "Zone de collecte"], [[11, 56, 0], "Caméra"], [[12, 6, 0], "Annonce élections"]]) {
    const b = await ouvreBanc({ maintenant: new Date(2026, 9, 5, ...heure) });
    b.clic("btn-nouveau");
    await b.pause(5);
    b.saisit("ch-titre", titre);
    b.clic("btn-enregistrer");
    await b.pause(5);
    const f = (await b.publie()).fichiers.find((x) => /^_actualites\//.test(x.chemin));
    const m = ligneDate(f.texte).match(/^date: (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/);
    assert.ok(m, ligneDate(f.texte));
    dates.push({ chemin: f.chemin, instant: Date.UTC(+m[1], m[2] - 1, +m[3], +m[4] - +m[7], +m[5], +m[6]) });
    b.ferme();
  }
  /* Tri du site : sort: "date" | reverse. */
  const accueil = dates.slice().sort((a, b) => b.instant - a.instant).map((d) => d.chemin);
  assert.deepEqual(accueil, [
    "_actualites/2026-10-05-annonce-elections.md",
    "_actualites/2026-10-05-camera.md",
    "_actualites/2026-10-05-zone-de-collecte.md"
  ]);
});

test("la liste de l'espace affiche le jour en clair quelle que soit la forme de la date", async () => {
  const b = await ouvreBanc();
  assert.equal(b.document.querySelectorAll(".ligne-meta").length, 3);
  assert.ok(b.el("app").innerHTML.includes("5 octobre 2026"));
  assert.ok(b.el("app").innerHTML.includes("11 septembre 2026"));
  assert.doesNotMatch(b.el("app").innerHTML, /T12:06:58/);
  b.ferme();
});
