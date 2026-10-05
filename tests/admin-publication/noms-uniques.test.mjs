/* Défaut 11 : le chemin d'un nouvel élément (date + titre, titre seul pour
   les talents et les élus) est rendu unique : suffixe -2, -3 s'il existe
   dans les données, parmi les autres nouveaux ou dans les suppressions. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide, article } from "./banc.mjs";

const NOM_AUTORISE = /^_(actualites|talents|elus)\/[a-z0-9][a-z0-9-]*\.md$/;
const textes = (corps) => corps.fichiers.filter((f) => typeof f.texte === "string" && /\.md$/.test(f.chemin));

function nouveau(titre, date, extra) {
  return Object.assign({ chemin: "nouveau:actualites:" + titre + date, titre, date, image: null, alt: null,
    photos: [], video: null, texte: "Texte de " + titre }, extra || {});
}

async function publieBrouillon(m, b) {
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 1);
  return { p, corps: m.publications[0] };
}

test("défaut 11 : une nouvelle actualité au même titre et à la même date qu'une existante prend le suffixe -2", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-titre", "Halloween");
  p.saisit("ch-date", "2026-10-01");
  p.saisit("ch-texte", "Deuxième annonce.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  const ecrits = textes(m.publications[0]);
  assert.deepEqual(ecrits.map((f) => f.chemin), ["_actualites/2026-10-01-halloween-2.md"]);
  assert.equal(ecrits[0].nouveau, true);
  assert.match(m.depot["_actualites/2026-10-01-halloween.md"], /17 octobre/, "l'article existant n'est pas réécrit");
});

test("défaut 11 : deux nouveaux éléments au même nom dans une publication ne s'écrasent pas", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.nouveaux.actualites.push(nouveau("INFORMATION", "2026-10-06"), nouveau("Information", "2026-10-06"));
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(textes(corps).map((f) => f.chemin),
    ["_actualites/2026-10-06-information.md", "_actualites/2026-10-06-information-2.md"]);
});

test("défaut 11 : un élu retiré puis recréé au même nom part sous un autre chemin, sans chemin à la fois écrit et retiré", async () => {
  const m = creeMonde(siteDeDepart());
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("elus");
  await p.attends();
  p.ouvre("_elus/pierre-breton.md");
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-nom", "Pierre Breton");
  p.saisit("ch-fonction", "Conseiller municipal");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  const corps = m.publications[0];
  const ecrits = textes(corps).map((f) => f.chemin);
  const retires = corps.suppressions.map((s) => (typeof s === "string" ? s : s.chemin));
  assert.deepEqual(ecrits, ["_elus/pierre-breton-2.md"]);
  assert.ok(retires.includes("_elus/pierre-breton.md"));
  assert.ok(!ecrits.some((c) => retires.includes(c)));
});

test("défaut 11 : un nouveau talent au titre d'un talent existant prend le suffixe -2", async () => {
  const site = siteDeDepart();
  site["_talents/apiculture.md"] = article("Apiculture", "2026-09-01", "Le miel du bourg.");
  const m = creeMonde(site);
  const b = vide();
  b.nouveaux.talents.push({ chemin: "nouveau:talents:1", titre: "Apiculture", date: "2026-10-06", image: null, alt: null,
    photos: [], video: null, texte: "Une autre ruche.", sous_titre: null });
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(textes(corps).map((f) => f.chemin), ["_talents/apiculture-2.md"]);
});

test("défaut 11 : un chemin publié depuis ce navigateur mais pas encore dans contenu.json est pris", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.nouveaux.actualites.push(nouveau("Repas des aînés", "2026-10-06"));
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  p.clic("btn-nouveau");
  await p.attends();
  p.saisit("ch-titre", "Repas des aînés");
  p.saisit("ch-date", "2026-10-06");
  p.saisit("ch-texte", "Rectificatif.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.deepEqual(textes(m.publications[1]).map((f) => f.chemin), ["_actualites/2026-10-06-repas-des-aines-2.md"]);
});

test("défaut 11 et contrat 5 : une date avec l'heure ne garde que le jour dans le nom, et un titre long reste un nom autorisé", async () => {
  const m = creeMonde(siteDeDepart());
  const long = "Recherche volontaires testeurs de caméra à détection précoce des frelons asiatiques";
  const b = vide();
  b.nouveaux.actualites.push(
    nouveau("Halloween", "2026-10-01T12:06:58+02:00"),
    nouveau(long + " (partie 1)", "2026-10-05 12:06:58 +0200"),
    nouveau(long + " (partie 2)", "2026-10-05 12:07:30 +0200"));
  const { corps } = await publieBrouillon(m, b);
  const chemins = textes(corps).map((f) => f.chemin);
  assert.equal(chemins[0], "_actualites/2026-10-01-halloween-2.md");
  assert.match(chemins[1], /^_actualites\/2026-10-05-recherche-volontaires/);
  assert.equal(chemins[2], chemins[1].replace(/\.md$/, "-2.md"));
  chemins.forEach((c) => assert.match(c, NOM_AUTORISE));
});
