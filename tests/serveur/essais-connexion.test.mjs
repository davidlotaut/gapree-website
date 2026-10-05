/* Défaut 51 : dix mots de passe faux envoyés par un inconnu bloquaient le
   compte visé pour tout le monde pendant un quart d'heure. Le compteur
   d'essais faux est désormais tenu par adresse ET par connexion d'origine
   (en-tête CF-Connecting-IP) : un attaquant ne bloque plus que lui-même, et
   il n'y a toujours qu'un compteur, donc pas plus d'écritures qu'avant. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, poseCompte, connexion, avance } from "./banc.mjs";

const ATTAQUANT = "198.51.100.7";
const MAIRIE = "203.0.113.9";

test("dix essais faux depuis une autre connexion ne bloquent pas la personne titulaire du compte", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  for (let i = 0; i < 10; i++) {
    assert.equal((await connexion(banc.env, "mairie", "faux-" + i, ATTAQUANT)).statut, 401);
  }
  const titulaire = await connexion(banc.env, "mairie", "bon-mot-de-passe", MAIRIE);
  assert.equal(titulaire.statut, 200, JSON.stringify(titulaire.d));
  /* L'attaquant, lui, reste bloqué, même avec le bon mot de passe. */
  const bloque = await connexion(banc.env, "mairie", "bon-mot-de-passe", ATTAQUANT);
  assert.equal(bloque.statut, 429);
  assert.match(bloque.d.erreur, /Trop de tentatives/);
});

test("un seul compteur : une écriture par essai faux, aucune pendant le blocage", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  const avant = banc.kv.ecritures.length;
  for (let i = 0; i < 10; i++) await connexion(banc.env, "mairie", "faux-" + i, ATTAQUANT);
  for (let i = 0; i < 5; i++) assert.equal((await connexion(banc.env, "mairie", "faux-bis-" + i, ATTAQUANT)).statut, 429);
  const ecrites = banc.kv.ecritures.slice(avant);
  assert.equal(ecrites.length, 10);
  assert.equal(new Set(ecrites.map((e) => e.cle)).size, 1, "un seul compteur pour cette adresse et cette connexion");
  assert.ok(ecrites.every((e) => e.options.expirationTtl === 900));
});

test("le blocage d'une connexion se lève au bout d'un quart d'heure", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "mairie", "bon-mot-de-passe", true);
  for (let i = 0; i < 10; i++) await connexion(banc.env, "mairie", "faux-" + i, ATTAQUANT);
  avance(899);
  assert.equal((await connexion(banc.env, "mairie", "bon-mot-de-passe", ATTAQUANT)).statut, 429);
  avance(2);
  assert.equal((await connexion(banc.env, "mairie", "bon-mot-de-passe", ATTAQUANT)).statut, 200);
});
