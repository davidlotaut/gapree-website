// Réglages de construction du site (_config.yml) et effets directs sur les pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit, sousCles } from "./outils.mjs";

const config = lit("_config.yml");

test("contrat 10 : le dossier tests n'est pas publié avec le site", () => {
  const exclus = sousCles(config, "exclude");
  assert.ok(exclus, "_config.yml doit avoir une liste exclude");
  assert.ok(exclus.includes("- tests"), "tests doit figurer dans exclude : " + exclus.join(", "));
});
