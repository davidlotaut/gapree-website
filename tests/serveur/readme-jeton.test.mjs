/* Défaut 23 : l'étape du jeton GitHub, dans serveur/README.md, ne disait rien
   de son expiration. Un jeton recréé en la suivant prendrait la durée proposée
   par GitHub (30 jours), et toute publication échouerait ensuite. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("l'étape du jeton GitHub impose « No expiration » et date le jeton en service", () => {
  const readme = readFileSync(new URL("../../serveur/README.md", import.meta.url), "utf8");
  const debut = readme.indexOf("# 4. (vous) créer un jeton GitHub");
  assert.ok(debut > 0, "étape 4 présente");
  const etape = readme.slice(debut, readme.indexOf("wrangler secret put JETON_GITHUB", debut));
  assert.match(etape, /Expiration : No expiration/);
  assert.match(etape, /04\/09\/2026/);
  assert.match(etape, /un an sans servir/);
});
