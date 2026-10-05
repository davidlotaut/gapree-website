/* Filet du défaut 11 : un même chemin à la fois écrit et retiré dans une
   publication (un élément retiré puis recréé sous le même nom) faisait
   rejeter l'enregistrement entier par GitHub. L'écriture l'emporte, le
   retrait est ignoré et journalisé. Un retrait cité deux fois ne compte
   qu'une fois. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel } from "./banc.mjs";

const ELU = "_elus/pierre-breton.md";
const PHOTO = "assets/img/pierre-breton-mgx1-ab12c.jpg";
const DEPART = {
  [ELU]: "---\ntitle: \"Pierre Breton\"\nfonction: \"Conseiller\"\nordre: 4\n---\n",
  [PHOTO]: "ancienne photo",
  "_actualites/2026-10-05-repas.md": "---\ntitle: \"Repas\"\n---\n"
};

async function avecJournal(action) {
  const lignes = [];
  const log = console.log;
  console.log = (...a) => { lignes.push(a.join(" ")); };
  try { return { resultat: await action(), lignes }; } finally { console.log = log; }
}

test("retirer puis recréer une fiche sous le même nom publie la fiche recréée", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const recree = "---\ntitle: \"Pierre Breton\"\nfonction: \"Adjoint\"\nordre: 2\n---\n";
  const { resultat: r, lignes } = await avecJournal(() => appel(banc.env, "POST", "/publier", {
    message: "suppression puis ajout", fichiers: [{ chemin: ELU, texte: recree }], suppressions: [ELU]
  }, { jeton }));
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.equal(banc.github.lit(ELU), recree);
  assert.ok(lignes.some((l) => l.includes("retrait ignoré") && l.includes(ELU)), JSON.stringify(lignes));
});

test("une photo écrite et retirée dans le même envoi reste en ligne avec son nouveau contenu", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const R0 = banc.github.tete();
  const tel = await appel(banc.env, "POST", "/televerser", {
    fichiers: [{ chemin: PHOTO, base64: Buffer.from("nouvelle photo").toString("base64") }]
  }, { jeton });
  assert.equal(tel.statut, 200);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai",
    suppressions: [{ chemin: PHOTO, base: R0 }, "_actualites/2026-10-05-repas.md"],
    fichiers: tel.d.fichiers
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.equal(banc.github.lit(PHOTO), "nouvelle photo");
  assert.equal(banc.github.lit("_actualites/2026-10-05-repas.md"), undefined, "l'autre retrait a bien lieu");
});

test("un retrait cité deux fois ne fait pas rejeter la publication", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai", suppressions: [PHOTO, { chemin: PHOTO }]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.equal(banc.github.lit(PHOTO), undefined);
});
