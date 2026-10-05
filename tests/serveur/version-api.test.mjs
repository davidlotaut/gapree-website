/* Défaut 64 : le serveur demande la version d'API GitHub la plus récente
   (2026-03-10, lue sur docs.github.com le 05/10/2026 ; 2022-11-28 cesse le
   10/03/2028), et un refus 400 ou 410 de GitHub, que réessayer ne réglera
   jamais, dit que le site doit être mis à jour par la personne qui l'a
   installé, sans inviter à réessayer. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas.md";

test("chaque appel à GitHub demande la version d'API 2026-03-10", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  const tel = await appel(banc.env, "POST", "/televerser", {
    fichiers: [{ chemin: "assets/img/photo-a.jpg", base64: Buffer.from("photo").toString("base64") }]
  }, { jeton });
  assert.equal(tel.statut, 200);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai", fichiers: [{ chemin: X, texte: "nouveau\n" }].concat(tel.d.fichiers), suppressions: ["_actualites/absent.md"]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.ok(banc.github.appels.length >= 6);
  for (const a of banc.github.appels) assert.equal(a.version, "2026-03-10", a.methode + " " + a.p);
});

for (const statut of [400, 410]) {
  test("un refus " + statut + " de GitHub demande de prévenir la personne qui a installé le site, sans inviter à réessayer", async () => {
    const banc = nouveauBanc({ [X]: "ancien\n" });
    const jeton = await ouvreSession(banc, "camille", false);
    banc.github.pannes.push({ quand: () => true, statut, corps: { message: "API version closed down" } });
    for (const [route, corps] of [
      ["/publier", { message: "essai", fichiers: [{ chemin: X, texte: "nouveau\n" }] }],
      ["/televerser", { fichiers: [{ chemin: "assets/img/photo-a.jpg", base64: Buffer.from("photo").toString("base64") }] }]
    ]) {
      const r = await appel(banc.env, "POST", route, corps, { jeton });
      assert.notEqual(r.statut, 200);
      assert.match(r.d.erreur, /doit être mis à jour par la personne qui l'a installé/, route + " : " + r.d.erreur);
      assert.doesNotMatch(r.d.erreur, /essay/i, route + " : " + r.d.erreur);
    }
  });
}

test("les autres refus gardent leurs messages", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  banc.github.pannes.push({ quand: () => true, statut: 401 });
  let r = await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "x\n" }] }, { jeton });
  assert.match(r.d.erreur, /clé d'écriture du site n'est plus valable/);
  banc.github.pannes.length = 0;
  banc.github.pannes.push({ quand: () => true, statut: 502 });
  r = await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "x\n" }] }, { jeton });
  assert.match(r.d.erreur, /erreur 502\). Réessayez dans un instant/);
});
