/* Défaut 54 : les portraits d'élus partaient en 1800 points pour un rond de
   92 points. litPhoto accepte désormais un côté maximal facultatif, et les
   portraits partent à 600 points. Les trois appels de litPhoto sont vérifiés
   (piège du 05/10/2026 : chacun doit prendre .src). */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc, photo, tailleDe } from "./banc.mjs";

test("portrait d'élu : réduit à 600 points de côté, en image (pas en objet)", async () => {
  const b = await ouvreBanc();
  b.onglet("elus");
  await b.pause(5);
  b.ouvre("_elus/second-elu.md");
  await b.pause(5);
  b.choisit("ch-image", [photo("portrait.jpg", { largeur: 3000, hauteur: 4000 })]);
  await b.pause(40);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const enregistre = b.brouillon().modifies["_elus/second-elu.md"].photo;
  assert.equal(typeof enregistre, "string");
  assert.deepEqual(tailleDe(enregistre), { largeur: 450, hauteur: 600 });
  const p = await b.publie();
  const envoi = b.televersements.flat().find((f) => /^assets\/img\//.test(f.chemin));
  assert.deepEqual(tailleDe("data:image/jpeg;base64," + envoi.base64), { largeur: 450, hauteur: 600 });
  assert.match(b.fichierPublie(p, "_elus/second-elu.md"), /^photo: "\/assets\/img\/second-elu-[a-z0-9-]+\.jpg"$/m);
  b.ferme();
});

test("un petit portrait n'est pas agrandi", async () => {
  const b = await ouvreBanc();
  b.onglet("elus");
  await b.pause(5);
  b.ouvre("_elus/second-elu.md");
  await b.pause(5);
  b.choisit("ch-image", [photo("petit.jpg", { largeur: 400, hauteur: 300 })]);
  await b.pause(40);
  b.clic("btn-enregistrer");
  await b.pause(5);
  assert.deepEqual(tailleDe(b.brouillon().modifies["_elus/second-elu.md"].photo), { largeur: 400, hauteur: 300 });
  b.ferme();
});

test("photos d'article et photo d'accueil : toujours 1800 points", async () => {
  const b = await ouvreBanc();
  b.ouvre("_actualites/2026-10-05-ronde.md");
  await b.pause(10);
  b.choisit("ch-images", [photo("a.jpg", { largeur: 4000, hauteur: 3000 })]);
  await b.pause(60);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const m = b.brouillon().modifies["_actualites/2026-10-05-ronde.md"];
  assert.deepEqual(tailleDe(m.photos[m.photos.length - 1].src), { largeur: 1800, hauteur: 1350 });

  b.onglet("reglages");
  await b.pause(5);
  b.choisit("ch-photo-accueil", [photo("accueil.jpg", { largeur: 4000, hauteur: 3000 })]);
  await b.pause(40);
  b.clic("btn-enregistre-accueil");
  await b.pause(5);
  assert.deepEqual(tailleDe(b.brouillon().reglages.accueil.photo), { largeur: 1800, hauteur: 1350 });
  b.ferme();
});
