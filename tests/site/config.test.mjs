// Réglages de construction du site (_config.yml) et effets directs sur les pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit, sousCles, frontMatter } from "./outils.mjs";

const config = lit("_config.yml");

test("contrat 10 : le dossier tests n'est pas publié avec le site", () => {
  const exclus = sousCles(config, "exclude");
  assert.ok(exclus, "_config.yml doit avoir une liste exclude");
  assert.ok(exclus.includes("- tests"), "tests doit figurer dans exclude : " + exclus.join(", "));
});

test("9000 : le site est ouvert aux moteurs de recherche, le guide reste exclu", () => {
  assert.match(config, /^mode_dev: false\s*$/m, "mode_dev doit valoir false");
  assert.doesNotMatch(config, /^mode_dev: true/m);
  const head = lit("_includes/head.html");
  /* La seule balise robots du site public : posée par mode_dev ou par la page. */
  assert.match(head, /\{% if site\.mode_dev or page\.noindex %\}<meta name="robots" content="noindex">/);
  assert.match(frontMatter(lit("guide-administration.md")), /^noindex: true$/m, "le guide garde son noindex");
  assert.match(lit("admin/index.html"), /<meta name="robots" content="noindex">/, "l'espace d'administration garde le sien");
});
