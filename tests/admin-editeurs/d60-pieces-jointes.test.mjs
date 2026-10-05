/* Défaut 60 : l'éditeur n'acceptait que des photos ; trois articles du 05/10
   renvoyaient à une pièce jointe absente ou réduite à une image. Contrat 6 :
   une actualité porte des PDF (assets/docs/<nom>.pdf, déposés tels quels,
   10 Mo au plus), inscrits dans le champ documents {src, titre, taille}. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc, contenuDeTest } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";
const MESSE = "_actualites/2026-09-11-messe.md";
const EMPLACEMENT = /^assets\/docs\/[a-z0-9][a-z0-9-]*\.pdf$/;   // contrat 1

const pdf = (nom, taille, extra) => Object.assign({ name: nom, type: "application/pdf", size: taille, contenu: "%PDF-1.4 " + nom }, extra || {});

async function ajouteDocuments(b, fichiers) {
  b.choisit("ch-documents", fichiers);
  await b.pause(30);
}

test("l'éditeur d'actualité propose des documents PDF, pas celui d'un portrait de talent", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  assert.ok(b.el("ch-documents"), "champ de documents absent");
  assert.match(b.el("ch-documents").getAttribute("accept"), /application\/pdf/);
  assert.equal(b.el("ch-documents").hasAttribute("multiple"), true);
  b.clic("btn-retour");
  await b.pause(5);
  b.onglet("talents");
  await b.pause(5);
  b.ouvre("_talents/habitants.md");
  await b.pause(10);
  assert.equal(b.el("ch-documents"), null);
  b.ferme();
});

test("un PDF ajouté, renommé, puis publié : déposé tel quel et inscrit dans documents", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  await ajouteDocuments(b, [pdf("Lettre élections n°15.pdf", 350000)]);
  const champ = b.document.querySelectorAll(".document-titre")[0];
  assert.equal(champ.value, "Lettre élections n°15");
  assert.match(b.el("liste-documents").innerHTML, /342 Ko/);
  champ.value = "la lettre élections n°15";
  champ.tire("input");
  assert.ok(b.el("apercu").innerHTML.includes("Télécharger la lettre élections n°15 (PDF, 342 Ko)"));
  b.clic("btn-enregistrer");
  await b.pause(5);
  const p = await b.publie();

  const depots = b.televersements.flat();
  assert.equal(depots.length, 1);
  assert.match(depots[0].chemin, EMPLACEMENT);
  assert.equal(Buffer.from(depots[0].base64, "base64").toString(), "%PDF-1.4 Lettre élections n°15.pdf", "le PDF doit partir sans conversion");

  const fichier = b.fichierPublie(p, RONDE);
  const attendu = "documents:\n  - src: \"/" + depots[0].chemin + "\"\n    titre: \"la lettre élections n°15\"\n    taille: \"342 Ko\"\n";
  assert.ok(fichier.includes(attendu), fichier);
  assert.ok(p.fichiers.some((f) => f.chemin === depots[0].chemin && f.sha), "le document déposé est cité à la publication");
  b.ferme();
});

test("un PDF choisi parmi les photos est écarté avec l'indication du bon champ", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.choisit("ch-images", [pdf("lettre.pdf", 5000)]);
  await b.pause(10);
  assert.match(b.dernierToast(), /ce ne sont pas des photos.*Documents à télécharger/);
  b.ferme();
});

test("poids affiché : en Ko sous 1 Mo, en Mo avec une décimale au-delà", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  await ajouteDocuments(b, [pdf("a.pdf", 2500000), pdf("b.pdf", 800)]);
  const zone = b.el("liste-documents").innerHTML;
  assert.match(zone, /2,4 Mo/);
  assert.match(zone, /1 Ko/);
  b.ferme();
});

test("un fichier qui n'est pas un PDF, ou un PDF de plus de 10 Mo, est écarté avec un message", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  await ajouteDocuments(b, [
    { name: "photo.jpg", type: "image/jpeg", size: 300000 },
    pdf("enorme.pdf", 10 * 1024 * 1024 + 1),
    pdf("juste.pdf", 10 * 1024 * 1024)
  ]);
  assert.equal(b.document.querySelectorAll(".document-titre").length, 1);
  assert.equal(b.document.querySelectorAll(".document-titre")[0].value, "juste");
  assert.ok(b.toasts.some((t) => /2 fichiers écartés/.test(t) && /PDF/.test(t) && /10 Mo/.test(t)), JSON.stringify(b.toasts));
  b.ferme();
});

test("retirer un document : seul celui qui reste est publié", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  await ajouteDocuments(b, [pdf("Premier.pdf", 5000), pdf("Second.pdf", 6000)]);
  b.clic(b.document.querySelectorAll("[data-retire-document]")[0]);
  assert.equal(b.document.querySelectorAll(".document-titre").length, 1);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const fichier = b.fichierPublie(await b.publie(), RONDE);
  assert.match(fichier, /titre: "Second"/);
  assert.doesNotMatch(fichier, /Premier/);
  assert.equal(b.televersements.flat().length, 1);
  b.ferme();
});

test("un document déjà en ligne est gardé tel quel, sans nouvel envoi", async () => {
  const contenu = contenuDeTest();
  contenu.actualites[2].documents = [{ src: "/assets/docs/bon-de-commande-mx1.pdf", titre: "le bon de commande", taille: "180 Ko" }];
  const b = await ouvreBanc({ contenu });
  b.ouvre(MESSE);
  await b.pause(10);
  assert.equal(b.document.querySelectorAll(".document-titre")[0].value, "le bon de commande");
  assert.ok(b.el("apercu").innerHTML.includes('href="../assets/docs/bon-de-commande-mx1.pdf"'));
  b.saisit("ch-titre", "Messe annuelle 2026");
  b.clic("btn-enregistrer");
  await b.pause(5);
  const fichier = b.fichierPublie(await b.publie(), MESSE);
  assert.ok(fichier.includes("documents:\n  - src: \"/assets/docs/bon-de-commande-mx1.pdf\"\n    titre: \"le bon de commande\"\n    taille: \"180 Ko\"\n"), fichier);
  assert.equal(b.televersements.length, 0);
  b.ferme();
});

test("pendant la lecture d'un PDF, Enregistrer attend ; un éditeur fermé ne reçoit rien", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.choisit("ch-documents", [pdf("lent.pdf", 5000, { delai: 80 })]);
  await b.pause(10);
  assert.equal(b.el("btn-enregistrer").disabled, true);
  await b.pause(120);
  assert.equal(b.el("btn-enregistrer").disabled, false);
  assert.equal(b.document.querySelectorAll(".document-titre").length, 1);

  b.choisit("ch-documents", [pdf("trop-tard.pdf", 5000, { delai: 80 })]);
  await b.pause(10);
  b.el("btn-retour").disabled = false;
  b.el("btn-retour").tire("click");
  await b.pause(5);
  b.ouvre(MESSE);
  await b.pause(150);
  assert.deepEqual(b.erreurs, []);
  assert.equal(b.document.querySelectorAll(".document-titre").length, 0);
  b.ferme();
});
