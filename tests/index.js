// Relais pour « node --test tests/ ». Avec un dossier en argument, le lanceur
// de Node 24 charge ce dossier comme un module (tests/index.js) au lieu d'y
// chercher les tests. Ce relais relance « node --test » sur chaque fichier
// *.test.mjs des sous-dossiers des lots : chaque fichier garde son propre
// processus (exécutés ensemble dans un seul, des tests de lots différents se
// gênent), et un échec rend le code de sortie 1.
//
// NODE_TEST_CONTEXT est retiré de l'environnement : hérité, il ferait sauter
// les fichiers au lanceur imbriqué, qui annoncerait un succès sans rien lancer.
"use strict";
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function fichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name)) : e.name.endsWith(".test.mjs") ? [join(dossier, e.name)] : []);
}

const env = Object.assign({}, process.env);
delete env.NODE_TEST_CONTEXT;
const resultat = spawnSync(process.execPath, ["--test"].concat(fichiers(__dirname).sort()), { stdio: "inherit", env: env });
process.exitCode = resultat.status === null ? 1 : resultat.status;
