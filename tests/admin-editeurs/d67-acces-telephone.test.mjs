/* Défaut 67 : sur téléphone, chaque ligne de l'onglet Accès débordait de
   l'écran (liens de 441 à 467 points pour 306 disponibles à 375 de large ; la
   ligne ne tient qu'à partir de 554). Sans navigateur, le test lit la feuille
   de style : sous ce seuil, la ligne et ses liens doivent pouvoir se replier,
   et une adresse plus large que l'écran se couper. Le rendu à 375 points reste
   à constater au navigateur. */
import test from "node:test";
import assert from "node:assert/strict";
import { lit } from "./banc.mjs";

const SEUIL = 554;

/* Règles des blocs @media (max-width: N px) dont N couvre le seuil. */
function reglesTelephone(css) {
  const regles = [];
  const re = /@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (+m[1] < SEUIL) continue;
    const bloc = m[2];
    const r = /([^{}]+)\{([^{}]*)\}/g;
    let x;
    while ((x = r.exec(bloc))) {
      const declarations = {};
      x[2].split(";").forEach((d) => {
        const i = d.indexOf(":");
        if (i > 0) (declarations[d.slice(0, i).trim()] = declarations[d.slice(0, i).trim()] || []).push(d.slice(i + 1).trim());
      });
      x[1].split(",").forEach((sel) => regles.push({ selecteur: sel.trim().replace(/\s+/g, " "), declarations }));
    }
  }
  return regles;
}

function valeurs(regles, selecteur, propriete) {
  return regles.filter((r) => r.selecteur === selecteur).flatMap((r) => r.declarations[propriete] || []);
}

test("sous 554 points de large, la ligne d'accès et ses liens se replient", () => {
  const regles = reglesTelephone(lit("admin/admin.css"));
  assert.ok(valeurs(regles, ".ligne--acces", "flex-wrap").includes("wrap"), ".ligne--acces ne se replie pas");
  assert.ok(valeurs(regles, ".acces-actions", "flex-wrap").includes("wrap"), "les liens ne se replient pas");
  assert.ok(valeurs(regles, ".acces-actions", "flex-shrink").includes("1"), "les liens ne peuvent pas rétrécir");
});

test("une adresse plus large que l'écran peut se couper", () => {
  const regles = reglesTelephone(lit("admin/admin.css"));
  const coupe = valeurs(regles, ".ligne--acces .ligne-titre", "overflow-wrap");
  assert.ok(coupe.includes("anywhere") || coupe.includes("break-word"), "aucune coupure possible de l'adresse");
});
