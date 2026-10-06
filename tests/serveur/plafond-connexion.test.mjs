/* Décision David du 06/10/2026 : un plafond de tentatives de connexion compté
   chez Cloudflare (liaison de limitation de débit), qui n'écrit rien dans le
   stockage, par connexion d'origine. Le plafond par compte, essayé puis retiré
   le 06/10, rouvrait le défaut 51. */

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

test("le plafond compte par connexion d'origine, jamais par compte", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  const limite = fausseLimite(100);
  banc.env.LIMITE_CONNEXIONS = limite;
  await connexion(banc.env, "mairie", "faux", "203.0.113.9");
  assert.deepEqual(limite.cles, ["ip:203.0.113.9"]);
});

test("défaut 51 : un flot d'essais avec l'adresse de la mairie ne bloque pas la mairie depuis sa propre connexion", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  banc.env.LIMITE_CONNEXIONS = fausseLimite(20);
  for (let i = 0; i < 25; i++) await connexion(banc.env, "mairie", "faux-" + i, "198.51.100.7");
  assert.equal((await connexion(banc.env, "mairie", "faux", "198.51.100.7")).statut, 429, "l'attaquant est arrêté");
  assert.equal((await connexion(banc.env, "mairie", "bon-mot-de-passe", "203.0.113.9")).statut, 200, "la mairie passe");
});

test("sans la liaison, la connexion se comporte comme avant", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  delete banc.env.LIMITE_CONNEXIONS;
  assert.equal((await connexion(banc.env, "mairie", "bon-mot-de-passe", "203.0.113.9")).statut, 200);
});
