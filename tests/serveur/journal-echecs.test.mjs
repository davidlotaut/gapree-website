/* Défaut 63 : les journaux de Cloudflare ne vivent que 3 jours sur l'offre
   gratuite. Chaque échec de /publier et de /televerser, et chaque compte
   rendu d'erreur reçu par /journal, est aussi gardé 30 jours dans COMPTES
   (clé « journal:… », expirationTtl 2 592 000), avec le statut et le détail
   de GitHub, le compte désigné par son libellé haché (comme dans les
   enregistrements), jamais l'adresse en clair ni le contenu d'une photo. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel, adresse, empreinteSha256, serveur } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas.md";
const TRENTE_JOURS = 2592000;

function entrees(banc) {
  return banc.kv.cles("journal:").map((cle) => ({
    cle,
    brut: banc.kv.brut(cle),
    valeur: JSON.parse(banc.kv.brut(cle)),
    options: banc.kv.ecritures.filter((e) => e.cle === cle).pop().options
  }));
}

test("un échec de /publier chez GitHub est gardé 30 jours, avec le statut et le détail de GitHub", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  banc.github.pannes.push({ quand: (m, p) => p.startsWith("/git/ref/"), statut: 502, corps: { message: "Server Error: panne simulée" } });
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai", fichiers: [{ chemin: X, texte: "nouveau\n" }], suppressions: ["_actualites/autre.md"]
  }, { jeton });
  assert.equal(r.statut, 500);
  const e = entrees(banc);
  assert.equal(e.length, 1, "une entrée par échec");
  assert.match(e[0].cle, /^journal:\d{4}-\d\d-\d\dT/);
  assert.equal(e[0].options.expirationTtl, TRENTE_JOURS);
  const v = e[0].valeur;
  assert.equal(v.route, "/publier");
  assert.equal(v.statut, 500);
  assert.equal(v.erreur, r.d.erreur);
  assert.equal(v.github.statut, 502);
  assert.match(v.github.detail, /panne simulée/);
  assert.equal(v.compte, "compte " + empreinteSha256(adresse("camille")).slice(0, 8));
  assert.deepEqual(v.envoi.chemins, [X]);
  assert.deepEqual(v.envoi.retraits, ["_actualites/autre.md"]);
  assert.ok(!e[0].brut.includes("@"), "aucune adresse en clair : " + e[0].brut);
});

test("un échec de /televerser est gardé sans le contenu des photos", async () => {
  const banc = nouveauBanc({});
  const jeton = await ouvreSession(banc, "camille", false);
  const photo = Buffer.alloc(3000, 7).toString("base64");
  banc.github.pannes.push({ quand: (m, p) => p === "/git/blobs", statut: 500 });
  const r = await appel(banc.env, "POST", "/televerser", { fichiers: [{ chemin: "assets/img/fete-a.jpg", base64: photo }] }, { jeton });
  assert.equal(r.statut, 500);
  const e = entrees(banc);
  assert.equal(e.length, 1);
  assert.equal(e[0].valeur.route, "/televerser");
  assert.equal(e[0].valeur.github.statut, 500);
  assert.deepEqual(e[0].valeur.envoi.chemins, ["assets/img/fete-a.jpg"]);
  assert.ok(!e[0].brut.includes(photo.slice(0, 40)), "le contenu de la photo n'est pas gardé");
  assert.ok(e[0].brut.length < 2000, "entrée courte : " + e[0].brut.length);
});

test("les refus du serveur sont gardés aussi : emplacement interdit, conflit, envoi trop lourd", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  const R0 = banc.github.tete();
  await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: "admin/config.js", texte: "x" }] }, { jeton });
  banc.github.publieDirect({ [X]: "autre\n" });
  await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "moi\n", base: R0 }] }, { jeton });
  /* Envoi qui annonce plus de 24 Mo : refusé avant d'être lu. */
  const lourd = await serveur.fetch(new Request("https://banc.invalid/televerser", {
    method: "POST", body: "{}",
    headers: { "Content-Length": String(25 * 1024 * 1024), Authorization: "Bearer " + jeton, Origin: "https://gapree.com" }
  }), banc.env);
  assert.equal(lourd.status, 413);
  const v = entrees(banc).map((e) => e.valeur);
  /* Trois refus dans la même seconde : leurs clés ne départagent pas l'ordre, on compare le contenu. */
  assert.deepEqual(v.map((x) => x.statut).sort(), [403, 409, 413]);
  assert.deepEqual(v.find((x) => x.statut === 409).conflits, [X]);
});

test("/journal garde les comptes rendus d'erreur, pas ceux de départ", async () => {
  const banc = nouveauBanc({});
  const jeton = await ouvreSession(banc, "camille", false);
  const depart = await appel(banc.env, "POST", "/journal", { version: "v", etape: "départ", erreur: "null", fichiers: 3 }, { jeton });
  assert.equal(depart.statut, 200);
  assert.equal(entrees(banc).length, 0);
  const echec = await appel(banc.env, "POST", "/journal", {
    version: "v", etape: "publication", erreur: "Une photo n'est pas arrivée entière.", fichiers: 3, cheminsSansRien: ["assets/img/a.jpg"]
  }, { jeton });
  assert.equal(echec.statut, 200);
  const e = entrees(banc);
  assert.equal(e.length, 1);
  assert.equal(e[0].options.expirationTtl, TRENTE_JOURS);
  assert.equal(e[0].valeur.route, "/journal");
  assert.match(e[0].valeur.compteRendu, /Une photo n'est pas arrivée entière/);
  assert.ok(!e[0].brut.includes("@"));
});

test("une publication réussie n'écrit rien au journal", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  const r = await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "nouveau\n" }] }, { jeton });
  assert.equal(r.statut, 200);
  assert.equal(entrees(banc).length, 0);
});
