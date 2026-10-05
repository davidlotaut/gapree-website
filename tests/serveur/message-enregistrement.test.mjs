/* Défaut 7 : le message de l'enregistrement, public sur GitHub, ne porte plus
   l'adresse de la personne qui publie, mais un libellé non identifiant :
   « compte » suivi des 8 premiers caractères de l'empreinte SHA-256 de
   l'adresse. L'adresse reste dans le journal du Worker. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel, adresse, empreinteSha256 } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas.md";

async function publieEtLitMessage(banc, jeton, texte) {
  const r = await appel(banc.env, "POST", "/publier", {
    message: "Mise à jour du site depuis l'espace d'administration\n\nmodification : Repas\n",
    fichiers: [{ chemin: X, texte }]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  return banc.github.message();
}

test("le message de l'enregistrement ne contient aucune adresse, seulement un libellé de compte", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jeton = await ouvreSession(banc, "camille", false);
  const journal = [];
  const log = console.log;
  console.log = (...a) => { journal.push(a.join(" ")); };
  let message;
  try {
    message = await publieEtLitMessage(banc, jeton, "nouveau\n");
  } finally {
    console.log = log;
  }
  assert.ok(!message.includes("@"), "aucune adresse dans le message : " + JSON.stringify(message));
  assert.ok(!message.includes(adresse("camille")));
  const attendu = "compte " + empreinteSha256(adresse("camille")).slice(0, 8);
  assert.ok(message.endsWith("\n\nPublié par " + attendu + "\n"), JSON.stringify(message));
  assert.ok(message.startsWith("Mise à jour du site depuis l'espace d'administration"));
  /* La correspondance reste lisible dans le journal du Worker. */
  assert.ok(journal.some((l) => l.includes(adresse("camille")) && l.includes(attendu)), JSON.stringify(journal));
});

test("le libellé est stable pour un même compte et distinct d'un compte à l'autre", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  const jetonA = await ouvreSession(banc, "camille", false);
  const jetonB = await ouvreSession(banc, "mairie", true);
  const m1 = await publieEtLitMessage(banc, jetonA, "un\n");
  const m2 = await publieEtLitMessage(banc, jetonA, "deux\n");
  const m3 = await publieEtLitMessage(banc, jetonB, "trois\n");
  const libelle = (m) => m.split("Publié par ")[1];
  assert.equal(libelle(m1), libelle(m2));
  assert.notEqual(libelle(m1), libelle(m3));
  assert.match(libelle(m3), /^compte [0-9a-f]{8}\n$/);
});
