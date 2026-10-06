/* Décision David du 06/10/2026 : un plafond de tentatives de connexion compté
   chez Cloudflare (liaison de limitation de débit), qui n'écrit rien dans le
   stockage, par connexion d'origine et par compte. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, poseCompte, connexion } from "./banc.mjs";

/* Fausse liaison : chaque clé a droit à « limite » appels, comme simple.limit. */
function fausseLimite(limite) {
  const vus = new Map();
  return {
    cles: [],
    async limit({ key }) {
      this.cles.push(key);
      vus.set(key, (vus.get(key) || 0) + 1);
      return { success: vus.get(key) <= limite };
    }
  };
}

test("au-delà du plafond, la connexion est refusée en 429 sans écrire dans le stockage", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  banc.env.LIMITE_CONNEXIONS = fausseLimite(2);
  assert.equal((await connexion(banc.env, "mairie", "faux-1", "198.51.100.7")).statut, 401);
  assert.equal((await connexion(banc.env, "mairie", "faux-2", "198.51.100.7")).statut, 401);
  const ecrituresAvant = banc.kv.ecritures.length;
  const refus = await connexion(banc.env, "mairie", "faux-3", "198.51.100.7");
  assert.equal(refus.statut, 429);
  assert.match(refus.d.erreur, /Réessayez dans une minute/);
  assert.equal(banc.kv.ecritures.length, ecrituresAvant, "aucune écriture au-delà du plafond");
});

test("le plafond compte par connexion d'origine ET par compte", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  const limite = fausseLimite(100);
  banc.env.LIMITE_CONNEXIONS = limite;
  await connexion(banc.env, "mairie", "faux", "203.0.113.9");
  assert.ok(limite.cles.some((k) => k === "ip:203.0.113.9"), "clé par connexion d'origine");
  assert.ok(limite.cles.some((k) => k.startsWith("compte:")), "clé par compte");
});

test("une attaque répartie sur plusieurs connexions bute sur le plafond du compte", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  banc.env.LIMITE_CONNEXIONS = fausseLimite(3);
  const statuts = [];
  for (let i = 0; i < 5; i++) statuts.push((await connexion(banc.env, "mairie", "faux", "198.51.100." + i)).statut);
  assert.deepEqual(statuts, [401, 401, 401, 429, 429]);
});

test("sans la liaison, la connexion se comporte comme avant", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  delete banc.env.LIMITE_CONNEXIONS;
  assert.equal((await connexion(banc.env, "mairie", "bon-mot-de-passe", "203.0.113.9")).statut, 200);
});
