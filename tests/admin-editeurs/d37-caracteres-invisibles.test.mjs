/* Défaut 37 : un séparateur de ligne Unicode ou un caractère de contrôle collé
   dans une saisie rendait le fichier YAML illisible (site figé, ou article sans
   titre ni photo). Contrat 9 : ces caractères sont retirés ou changés en saut
   de ligne avant l'écriture. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";

/* Règles du lecteur libyaml 0.2.5 (reader.c) : seuls #x9, #xA, #xD, #x20-#x7E,
   #x85, #xA0-#xD7FF, #xE000-#xFFFD et au-delà sont admis. */
const REFUSES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F\uFFFE\uFFFF]/;
/* Lus comme des retours à la ligne par libyaml (yaml_private.h, IS_BREAK) :
   ils coupent un bloc littéral. */
const SEPARATEURS = /[\u0085\u2028\u2029]/;

const CAS = {
  "séparateur de ligne U+2028": "Ligne un\u2028Ligne deux",
  "séparateur de paragraphe U+2029": "Ligne un\u2029Ligne deux",
  "NEL U+0085": "Ligne un\u0085Ligne deux",
  "saut de ligne de Word U+000B": "Ligne un\u000BLigne deux",
  "saut de page U+000C": "Ligne un\u000CLigne deux",
  "sonnerie U+0007": "Bip\u0007 fin",
  "suppression U+007F": "Suppr\u007F fin",
  "nul U+0000": "Nul\u0000 fin",
  "non-caractère U+FFFE": "Non\uFFFE fin"
};

/* Remplit tous les champs écrits en YAML (et le corps) avec la même saisie, puis publie. */
async function publieSaisiePartout(b, valeur) {
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-titre", valeur);
  const alt = b.document.querySelectorAll(".photo-alt")[0];
  alt.value = valeur;
  alt.tire("input");
  b.saisit("ch-texte", valeur);
  b.clic("btn-enregistrer");
  await b.pause(5);

  b.onglet("elus");
  await b.pause(5);
  b.ouvre("_elus/second-elu.md");
  await b.pause(5);
  b.saisit("ch-fonction", valeur);
  b.clic("btn-enregistrer");
  await b.pause(5);

  b.onglet("reglages");
  await b.pause(5);
  b.saisit("ch-alt-accueil", valeur);
  b.saisit("ch-sous-titre", valeur);
  b.saisit("ch-texte-accueil", valeur);
  b.clic("btn-enregistre-accueil");
  b.saisit("ch-adresse", valeur);
  for (const champ of b.document.querySelectorAll(".ligne-horaire input")) {
    champ.value = valeur;
    champ.tire("input");
  }
  b.clic("btn-enregistre-mairie");
  await b.pause(5);
  return b.publie();
}

for (const [nom, valeur] of Object.entries(CAS)) {
  test(nom + " : les quatre fichiers écrits restent lisibles", async () => {
    const b = await ouvreBanc();
    const p = await publieSaisiePartout(b, valeur);
    const ecrits = p.fichiers.filter((f) => typeof f.texte === "string");
    assert.deepEqual(ecrits.map((f) => f.chemin).sort(),
      ["_actualites/2026-10-05-ronde.md", "_data/accueil.yml", "_data/mairie.yml", "_elus/second-elu.md"]);
    for (const f of ecrits) {
      assert.doesNotMatch(f.texte, REFUSES, f.chemin + " contient un caractère que libyaml refuse");
      assert.doesNotMatch(f.texte, SEPARATEURS, f.chemin + " contient un séparateur qui coupe le YAML");
    }
    b.ferme();
  });
}

test("un séparateur devient un vrai retour à la ligne (espace dans une valeur d'une ligne)", async () => {
  const b = await ouvreBanc();
  const p = await publieSaisiePartout(b, "Ligne un\u2028Ligne deux");
  const article = b.fichierPublie(p, RONDE);
  assert.match(article, /^title: "Ligne un Ligne deux"$/m);
  assert.match(article, /^alt: "Ligne un Ligne deux"$/m);
  assert.match(article, /\n---\nLigne un\nLigne deux\n$/);
  const accueil = b.fichierPublie(p, "_data/accueil.yml");
  assert.match(accueil, /^texte: \|-\n {2}Ligne un\n {2}Ligne deux$/m);
  const mairie = b.fichierPublie(p, "_data/mairie.yml");
  assert.match(mairie, /^adresse: \|-\n {2}Ligne un\n {2}Ligne deux$/m);
  b.ferme();
});

test("le saut de ligne manuel de Word (U+000B) garde la coupure au lieu de coller les mots", async () => {
  const b = await ouvreBanc();
  const p = await publieSaisiePartout(b, "Ligne un\u000BLigne deux");
  assert.match(b.fichierPublie(p, "_data/accueil.yml"), /^ {2}Ligne un\n {2}Ligne deux$/m);
  b.ferme();
});

test("témoin : une saisie ordinaire est écrite à l'identique", async () => {
  const b = await ouvreBanc();
  const saisie = "Texte « ordinaire » : 12 €, #1, \"cité\", \\ fin,\ttabulation, émoji 🎃";
  const p = await publieSaisiePartout(b, saisie);
  const article = b.fichierPublie(p, RONDE);
  assert.ok(article.includes('title: "Texte « ordinaire » : 12 €, #1, \\"cité\\", \\\\ fin,\ttabulation, émoji 🎃"'), article);
  assert.ok(b.fichierPublie(p, "_data/accueil.yml").includes("  " + saisie));
  b.ferme();
});
