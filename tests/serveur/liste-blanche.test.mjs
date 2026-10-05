/* Défaut 1 : le serveur n'écrit et ne retire que dans les emplacements de
   contenu (contrat 1), en refusant tout autre chemin AVANT le moindre appel à
   GitHub, dans /publier comme dans /televerser. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { nouveauBanc, ouvreSession, appel } from "./banc.mjs";

const DEPART = {
  "CNAME": "gapree.com\n",
  "_config.yml": "title: Gâprée\n",
  "admin/config.js": "window.GAPREE_SERVEUR = \"https://serveur.invalid\";\n",
  "admin/app.js": "// code de l'administration\n",
  "_actualites/2026-10-05-repas.md": "---\ntitle: \"Repas\"\n---\nTexte.\n",
  "_data/accueil.yml": "photo: \"/assets/img/hero.jpg\"\n",
  "assets/img/demo/forge.jpg": "image"
};

const ECRITURES_REFUSEES = [
  "admin/config.js", "admin/app.js", "CNAME", "_config.yml", ".claude/settings.json",
  "CLAUDE.md", "serveur/wrangler.toml", "serveur/src/index.js", "_layouts/default.html",
  "_actualites/../admin/app.js", "_actualites/Majuscule.md", "_actualites/-tiret.md",
  "_actualites/sous/dossier.md", "_actualites/a.md.js", "_data/autre.yml", "_data/accueil.yaml",
  "assets/img/demo/forge.jpg", "assets/img/x.svg", "assets/img/x.html", "assets/js/site.js",
  "assets/docs/note.docx", "assets/docs/-note.pdf", "/_actualites/a.md", "_actualites/a.md\n",
  "", 42, null
];

test("une écriture hors des emplacements de contenu est refusée par /publier, sans aucun appel à GitHub", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "editeur", false);
  for (const chemin of ECRITURES_REFUSEES) {
    banc.github.appels.length = 0;
    const r = await appel(banc.env, "POST", "/publier", {
      message: "essai", fichiers: [{ chemin, texte: "piège" }]
    }, { jeton });
    assert.equal(r.statut, 403, "chemin " + JSON.stringify(chemin) + " : statut " + r.statut);
    if (typeof chemin === "string" && chemin.trim()) {
      assert.ok(r.d.erreur.includes(chemin.trim()), "le message nomme l'emplacement refusé : " + r.d.erreur);
    }
    assert.equal(banc.github.appels.length, 0, "aucun appel à GitHub pour " + JSON.stringify(chemin));
  }
  assert.equal(banc.github.lit("admin/config.js"), DEPART["admin/config.js"]);
});

test("un seul chemin interdit fait refuser toute la publication", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "editeur", false);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai",
    fichiers: [
      { chemin: "_actualites/2026-10-05-repas.md", texte: "---\ntitle: \"Repas\"\n---\nNouveau.\n" },
      { chemin: "admin/config.js", texte: "window.GAPREE_SERVEUR = \"https://pirate.invalid\";\n" }
    ]
  }, { jeton });
  assert.equal(r.statut, 403);
  assert.equal(banc.github.appels.length, 0);
});

test("un retrait hors des emplacements de contenu est refusé, réglages compris", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "editeur", false);
  for (const chemin of ["_config.yml", "CNAME", "admin/app.js", "_data/accueil.yml", "_data/mairie.yml", "assets/img/demo/forge.jpg"]) {
    banc.github.appels.length = 0;
    const r = await appel(banc.env, "POST", "/publier", { message: "essai", suppressions: [chemin] }, { jeton });
    assert.equal(r.statut, 403, chemin + " : " + r.statut);
    assert.ok(r.d.erreur.includes(chemin), r.d.erreur);
    assert.equal(banc.github.appels.length, 0);
  }
  /* Forme objet du contrat 2 ({chemin, base}) : même règle. */
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai", suppressions: [{ chemin: "_config.yml", base: "a".repeat(40) }]
  }, { jeton });
  assert.equal(r.statut, 403);
  assert.equal(banc.github.lit("_config.yml"), DEPART["_config.yml"]);
});

test("/televerser refuse un dépôt hors des emplacements de contenu, sans appel à GitHub", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "editeur", false);
  banc.github.appels.length = 0;
  const r = await appel(banc.env, "POST", "/televerser", {
    fichiers: [{ chemin: "admin/app.js", base64: Buffer.from("alert(1)").toString("base64") }]
  }, { jeton });
  assert.equal(r.statut, 403);
  assert.ok(r.d.erreur.includes("admin/app.js"), r.d.erreur);
  assert.equal(banc.github.appels.length, 0);
});

test("les emplacements de contenu restent acceptés : articles, élus, talents, réglages, photos, documents", async () => {
  const banc = nouveauBanc(DEPART);
  const jeton = await ouvreSession(banc, "editeur", false);
  const tel = await appel(banc.env, "POST", "/televerser", {
    fichiers: [
      { chemin: "assets/img/repas-mgx1k2-ab12c.jpg", base64: Buffer.from("photo").toString("base64") },
      { chemin: "assets/docs/proces-verbal-2026-10-01.pdf", base64: Buffer.from("%PDF-1.4").toString("base64") }
    ]
  }, { jeton });
  assert.equal(tel.statut, 200);
  const r = await appel(banc.env, "POST", "/publier", {
    message: "essai",
    fichiers: [
      { chemin: "_actualites/2026-10-06-fete.md", texte: "---\ntitle: \"Fête\"\n---\n" },
      { chemin: "_talents/potier.md", texte: "---\ntitle: \"Potier\"\n---\n" },
      { chemin: "_elus/pierre-breton.md", texte: "---\ntitle: \"Pierre Breton\"\n---\n" },
      { chemin: "_data/accueil.yml", texte: "photo: \"/assets/img/repas-mgx1k2-ab12c.jpg\"\n" },
      { chemin: "_data/mairie.yml", texte: "telephone: \"02 33 00 00 00\"\n" },
      { chemin: "assets/img/fete.webp", base64: Buffer.from("webp").toString("base64") }
    ].concat(tel.d.fichiers),
    suppressions: ["_actualites/2026-10-05-repas.md"]
  }, { jeton });
  assert.equal(r.statut, 200, JSON.stringify(r.d));
  assert.equal(banc.github.lit("_actualites/2026-10-05-repas.md"), undefined);
  assert.equal(banc.github.lit("_talents/potier.md"), "---\ntitle: \"Potier\"\n---\n");
  assert.equal(banc.github.lit("assets/docs/proces-verbal-2026-10-01.pdf"), "%PDF-1.4");
});

test("tous les fichiers de contenu présents dans le dépôt restent modifiables et supprimables", async () => {
  const racine = new URL("../../", import.meta.url);
  const chemins = [];
  for (const dossier of ["_actualites", "_talents", "_elus"]) {
    for (const nom of readdirSync(new URL(dossier + "/", racine))) if (nom.endsWith(".md")) chemins.push(dossier + "/" + nom);
  }
  const photos = readdirSync(new URL("assets/img/", racine), { withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => "assets/img/" + e.name);
  assert.ok(chemins.length >= 20 && photos.length >= 100, "le dépôt contient bien ses contenus");
  const depart = {};
  for (const c of chemins.concat(photos)) depart[c] = "ancien " + c;
  depart["_data/accueil.yml"] = "ancien";
  depart["_data/mairie.yml"] = "ancien";
  const banc = nouveauBanc(depart);
  const jeton = await ouvreSession(banc, "editeur", false);
  const ecriture = await appel(banc.env, "POST", "/publier", {
    message: "essai",
    fichiers: chemins.concat(["_data/accueil.yml", "_data/mairie.yml"]).map((c) => ({ chemin: c, texte: "nouveau " + c }))
  }, { jeton });
  assert.equal(ecriture.statut, 200, JSON.stringify(ecriture.d));
  const retrait = await appel(banc.env, "POST", "/publier", { message: "essai", suppressions: chemins.concat(photos) }, { jeton });
  assert.equal(retrait.statut, 200, JSON.stringify(retrait.d));
});
