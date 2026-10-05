/* Défauts 31 et 72 (contrat 7) : quand rien ne change réellement, /publier
   répond 200 { ok: true, inchange: true } sans créer d'enregistrement ni
   déplacer la branche, au lieu d'une erreur (suppression déjà faite, seule en
   attente) ou d'un enregistrement vide qui relance la construction du site. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas.md";
const Y = "_elus/pierre-breton.md";
const DEPART = { [X]: "---\ntitle: \"Repas\"\n---\nTexte.\n", [Y]: "---\ntitle: \"Pierre Breton\"\n---\n" };

const ecrituresGit = (banc) => banc.github.ecritures().map((a) => a.methode + " " + a.p);

test("retirer de nouveau un article déjà retiré, seul en attente, répond « inchangé » sans enregistrement", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const avant = banc.github.tete();
  const r = await appel(banc.env, "POST", "/publier", {
    message: "suppression", suppressions: ["_actualites/2026-07-05-deja-retire.md"]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.deepEqual(r.d, { ok: true, inchange: true });
  assert.equal(banc.github.tete(), avant);
  assert.deepEqual(ecrituresGit(banc), []);
});

test("republier un portrait sans rien changer répond « inchangé », sans enregistrement vide", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const avant = banc.github.tete();
  const commits = banc.github.nombreCommits();
  const r = await appel(banc.env, "POST", "/publier", {
    message: "modification : Pierre Breton", fichiers: [{ chemin: Y, texte: DEPART[Y] }]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.deepEqual(r.d, { ok: true, inchange: true });
  assert.equal(banc.github.tete(), avant, "la branche n'a pas bougé");
  assert.equal(banc.github.nombreCommits(), commits, "aucun enregistrement créé");
  assert.ok(!ecrituresGit(banc).some((e) => e.startsWith("PATCH") || e === "POST /git/commits"), JSON.stringify(ecrituresGit(banc)));
});

test("une suppression déjà faite accompagnée d'un vrai changement publie normalement", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai",
    fichiers: [{ chemin: X, texte: "---\ntitle: \"Repas\"\n---\nNouveau texte.\n" }],
    suppressions: ["_actualites/2026-07-05-deja-retire.md"]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.equal(r.d.ok, true);
  assert.equal(r.d.inchange, undefined);
  assert.match(r.d.commit, /^[0-9a-f]{40}$/);
  assert.equal(banc.github.tete(), r.d.commit);
  assert.equal(banc.github.lit(X), "---\ntitle: \"Repas\"\n---\nNouveau texte.\n");
});

test("une demande vide reste refusée", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "camille", false);
  const r = await appel(banc.env, "POST", "/publier", { message: "rien", fichiers: [], suppressions: [] }, { jeton });
  assert.equal(r.statut, 500);
  assert.equal(r.d.erreur, "Rien à publier.");
});
