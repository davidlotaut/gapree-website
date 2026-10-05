/* Défaut 49 : un nouveau mot de passe ne coupait pas une session déjà
   ouverte. Chaque compte porte désormais un numéro de version, copié dans ses
   sessions et changé au changement de mot de passe, à la réinitialisation et
   à la création ; toute session qui porte un autre numéro est refusée. La
   session de la personne qui change son propre mot de passe reste ouverte,
   jusqu'à son échéance d'origine. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { nouveauBanc, poseCompte, connexion, appel, adresse, avance } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas.md";
const moi = (banc, jeton) => appel(banc.env, "GET", "/moi", null, { jeton });

test("changer son mot de passe coupe les autres sessions du compte, pas la sienne", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  await poseCompte(banc.kv, "camille", "ancien-mot-de-passe", false);
  const ici = (await connexion(banc.env, "camille", "ancien-mot-de-passe")).d.jeton;
  const ailleurs = (await connexion(banc.env, "camille", "ancien-mot-de-passe")).d.jeton;
  const r = await appel(banc.env, "POST", "/motdepasse", { nouveau: "nouveau-mot-de-passe" }, { jeton: ici });
  assert.equal(r.statut, 200);
  assert.equal((await moi(banc, ailleurs)).statut, 401, "la session ouverte sur un autre poste est coupée");
  assert.equal((await moi(banc, ici)).statut, 200, "la session de la personne reste ouverte");
  const pub = await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "nouveau\n" }] }, { jeton: ici });
  assert.equal(pub.statut, 200, JSON.stringify(pub.d));
  assert.equal((await connexion(banc.env, "camille", "nouveau-mot-de-passe")).statut, 200);
});

test("« Nouveau mot de passe » fait par un gestionnaire coupe toutes les sessions du compte", async () => {
  const banc = nouveauBanc({ [X]: "ancien\n" });
  await poseCompte(banc.kv, "camille", "mot-de-passe-camille", false);
  await poseCompte(banc.kv, "mairie", "mot-de-passe-mairie", true);
  const camille = (await connexion(banc.env, "camille", "mot-de-passe-camille")).d.jeton;
  const mairie = (await connexion(banc.env, "mairie", "mot-de-passe-mairie")).d.jeton;
  const r = await appel(banc.env, "POST", "/utilisateurs", { email: adresse("camille"), reinitialiser: true }, { jeton: mairie });
  assert.equal(r.statut, 200);
  assert.equal((await moi(banc, camille)).statut, 401);
  const pub = await appel(banc.env, "POST", "/publier", { message: "essai", fichiers: [{ chemin: X, texte: "x\n" }] }, { jeton: camille });
  assert.equal(pub.statut, 401);
  assert.equal((await moi(banc, mairie)).statut, 200, "la session du gestionnaire n'est pas touchée");
});

test("un compte retiré puis recréé ne ranime pas son ancienne session", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "camille", "mot-de-passe-camille", false);
  await poseCompte(banc.kv, "mairie", "mot-de-passe-mairie", true);
  const camille = (await connexion(banc.env, "camille", "mot-de-passe-camille")).d.jeton;
  const mairie = (await connexion(banc.env, "mairie", "mot-de-passe-mairie")).d.jeton;
  assert.equal((await appel(banc.env, "DELETE", "/utilisateurs?email=" + encodeURIComponent(adresse("camille")), null, { jeton: mairie })).statut, 200);
  assert.equal((await moi(banc, camille)).statut, 401);
  assert.equal((await appel(banc.env, "POST", "/utilisateurs", { email: adresse("camille") }, { jeton: mairie })).statut, 200);
  assert.equal((await moi(banc, camille)).statut, 401);
});

test("changer les droits d'un compte ne coupe pas ses sessions", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "camille", "mot-de-passe-camille", false);
  await poseCompte(banc.kv, "mairie", "mot-de-passe-mairie", true);
  const camille = (await connexion(banc.env, "camille", "mot-de-passe-camille")).d.jeton;
  const mairie = (await connexion(banc.env, "mairie", "mot-de-passe-mairie")).d.jeton;
  assert.equal((await appel(banc.env, "PATCH", "/utilisateurs", { email: adresse("camille"), admin: true }, { jeton: mairie })).statut, 200);
  const r = await moi(banc, camille);
  assert.equal(r.statut, 200);
  assert.equal(r.d.admin, true);
});

test("une session ouverte avant la mise à jour reste valable tant que rien ne change", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "camille", "mot-de-passe-camille", false);
  await banc.kv.put("session:jeton-de-la-veille", JSON.stringify({ email: adresse("camille") }), { expirationTtl: 3600 });
  assert.equal((await moi(banc, "jeton-de-la-veille")).statut, 200);
});

test("la session gardée après un changement de mot de passe n'est pas prolongée", async () => {
  const banc = nouveauBanc({});
  await poseCompte(banc.kv, "camille", "ancien-mot-de-passe", false);
  const jeton = (await connexion(banc.env, "camille", "ancien-mot-de-passe")).d.jeton;
  avance(6 * 3600);
  assert.equal((await appel(banc.env, "POST", "/motdepasse", { nouveau: "nouveau-mot-de-passe" }, { jeton })).statut, 200);
  avance(6 * 3600 - 10);
  assert.equal((await moi(banc, jeton)).statut, 200);
  avance(20);
  assert.equal((await moi(banc, jeton)).statut, 401, "échéance d'origine : 12 h après la connexion");
});

test("amorcer.mjs donne un numéro de version au compte qu'il crée ou recrée", () => {
  const dossier = mkdtempSync(join(tmpdir(), "banc-amorcer-"));
  try {
    const sortie = join(dossier, "arguments.json");
    /* Fausse commande wrangler : elle note ses arguments et ne touche à rien. */
    writeFileSync(join(dossier, "wrangler"), "#!/bin/sh\n" + JSON.stringify(process.execPath)
      + " -e 'require(\"fs\").writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)))' "
      + JSON.stringify(sortie) + " \"$@\"\n");
    chmodSync(join(dossier, "wrangler"), 0o755);
    const script = fileURLToPath(new URL("../../serveur/amorcer.mjs", import.meta.url));
    const versions = [];
    for (let i = 0; i < 2; i++) {
      execFileSync(process.execPath, [script, adresse("essai"), "--local"], {
        env: { PATH: dossier + ":/usr/bin:/bin", HOME: dossier }, stdio: "pipe"
      });
      const args = JSON.parse(readFileSync(sortie, "utf8"));
      assert.deepEqual(args.slice(0, 4), ["kv", "key", "put", "compte:" + adresse("essai")]);
      assert.ok(args.includes("--local") && !args.includes("--remote"));
      const compte = JSON.parse(args[4]);
      assert.equal(typeof compte.version, "string");
      assert.ok(compte.version.length >= 8);
      versions.push(compte.version);
    }
    assert.notEqual(versions[0], versions[1], "une recréation change le numéro");
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
