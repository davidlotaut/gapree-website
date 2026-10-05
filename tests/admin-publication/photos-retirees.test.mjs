/* Défaut 6 : une photo ou une pièce jointe retirée ou remplacée, et celles
   d'un élément supprimé, partent dans les suppressions de la même publication
   quand plus aucun contenu (données ou brouillon) ne les cite. Jamais un
   fichier dont le nom sort de la liste blanche du serveur, ni l'image que le
   site utilise par défaut. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide, article, elu } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const PB = "_elus/pierre-breton.md";
const PORTRAIT = "/assets/img/pierre-breton-muvmlze2-6sxz4.jpg";
const IMAGE_H = "/assets/img/halloween-a1b2c3d4-aaaaa.jpg";
const R = "_actualites/2026-09-11-repas.md";
const PH = (n) => "/assets/img/repas-mtwqwo4p-" + n + ".jpg";

const retraits = (corps) => corps.suppressions.map((s) => (typeof s === "string" ? s : s.chemin));

function siteAvecReportage() {
  const site = siteDeDepart();
  site[R] = article("Repas", "2026-09-11", "Le repas.", { image: PH("aaaaa"), photos: [{ src: PH("bbbbb"), alt: "Table" }, { src: PH("ccccc") }] });
  return site;
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

test("défaut 6 : un portrait remplacé est retiré du site", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.modifies[PB] = { nom: "Pierre Breton", fonction: "Conseiller municipal", ordre: 4, photo: "data:image/jpeg;base64,Tk9VVkVBVQ==" };
  const { corps } = await publieBrouillon(m, b);
  assert.ok(retraits(corps).includes(PORTRAIT.slice(1)));
  assert.equal(m.depot[PORTRAIT.slice(1)], undefined);
});

test("défaut 6 : les photos d'un article supprimé partent avec lui", async () => {
  const m = creeMonde(siteAvecReportage());
  const b = vide();
  b.supprimes.push(R);
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(retraits(corps).sort(), [R, PH("aaaaa").slice(1), PH("bbbbb").slice(1), PH("ccccc").slice(1)].sort());
});

test("défaut 6 : seule la photo retirée d'un reportage part, les autres restent", async () => {
  const m = creeMonde(siteAvecReportage());
  const b = vide();
  b.modifies[R] = { titre: "Repas", date: "2026-09-11", image: PH("aaaaa"), alt: null,
    photos: [{ src: PH("ccccc"), alt: "" }], video: null, texte: "Le repas." };
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(retraits(corps), [PH("bbbbb").slice(1)]);
});

test("défaut 6 : une photo encore citée ailleurs (données ou brouillon) n'est pas retirée", async () => {
  const site = siteAvecReportage();
  site["_actualites/2026-09-12-suite.md"] = article("Suite", "2026-09-12", "La suite.", { image: PH("bbbbb") });
  const m = creeMonde(site);
  const b = vide();
  b.modifies[R] = { titre: "Repas", date: "2026-09-11", image: PH("aaaaa"), alt: null, photos: [], video: null, texte: "Le repas." };
  b.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: PH("ccccc"), alt: null, photos: [], video: null, texte: "x" };
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(retraits(corps).sort(), [IMAGE_H.slice(1)], "seule l'ancienne image d'Halloween n'est plus citée");
});

test("défaut 6 : la photo d'accueil remplacée part, l'image par défaut du site jamais", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.reglages.accueil = { photo: "data:image/jpeg;base64,QUNDVUVJTA==", alt_photo: "Le bourg", sous_titre: "", texte: "Bienvenue." };
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(retraits(corps), ["assets/img/accueil-mto4xq8j.jpg"]);

  const site = siteDeDepart();
  site["_data/accueil.yml"] = site["_data/accueil.yml"].replace("/assets/img/accueil-mto4xq8j.jpg", "/assets/img/hero-gapree.jpg");
  const m2 = creeMonde(site);
  const b2 = vide();
  b2.reglages.accueil = { photo: "data:image/jpeg;base64,QUNDVUVJTA==", alt_photo: "", sous_titre: "", texte: "" };
  const r2 = await publieBrouillon(m2, b2);
  assert.deepEqual(retraits(r2.corps), []);
});

test("défaut 6 : une pièce jointe retirée part, un fichier hors liste blanche jamais", async () => {
  const site = siteDeDepart();
  site[R] = article("Repas", "2026-09-11", "Le repas.", { image: "/assets/img/demo/forge.jpg" })
    .replace("---\nLe repas.", 'documents:\n  - src: "/assets/docs/menu-du-repas-mu1a2b3c-xyz12.pdf"\n    titre: "Menu"\n---\nLe repas.');
  const m = creeMonde(site);
  assert.equal(m.deploye.actualites.find((a) => a.chemin === R).documents[0].src, "/assets/docs/menu-du-repas-mu1a2b3c-xyz12.pdf");
  const b = vide();
  b.modifies[R] = { titre: "Repas", date: "2026-09-11", image: null, alt: null, photos: [], video: null, texte: "Le repas.", documents: [] };
  const { corps } = await publieBrouillon(m, b);
  assert.deepEqual(retraits(corps), ["assets/docs/menu-du-repas-mu1a2b3c-xyz12.pdf"]);
});

test("défaut 6 : une photo publiée puis retirée avant la mise en ligne part elle aussi", async () => {
  const m = creeMonde(siteDeDepart());
  const b = vide();
  b.nouveaux.actualites.push({ chemin: "nouveau:actualites:1", titre: "Fête", date: "2026-10-06",
    image: "data:image/jpeg;base64,RkVURQ==", alt: null, photos: [], video: null, texte: "La fête." });
  m.poseBrouillon(b);
  const p = ouvrePage(m);
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  const publiee = m.publications[0].fichiers.find((f) => f.sha).chemin;
  p.onglet("actualites");
  await p.attends();
  p.ouvre("_actualites/2026-10-06-fete.md");
  await p.attends();
  p.el("liste-photos").querySelector("[data-retire]").tire("click");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.deepEqual(retraits(m.publications[1]), [publiee]);
});

test("défaut 6 : l'élu supprimé emporte son portrait, que personne d'autre ne cite", async () => {
  const site = siteDeDepart();
  site["_elus/jean-breton.md"] = elu("Jean Breton", "Adjoint", 2, "/assets/img/jean-breton-muvmlze1-hzpow.jpg");
  const m = creeMonde(site);
  const p = ouvrePage(m);
  await p.attends();
  p.onglet("elus");
  await p.attends();
  p.ouvre(PB);
  await p.attends();
  p.clic("btn-supprimer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.deepEqual(retraits(m.publications[0]).sort(), [PB, PORTRAIT.slice(1)].sort());
  assert.equal(p.questions.filter((q) => /Publier 1 modification/.test(q)).length, 1, "la confirmation ne compte que l'élu");
});
