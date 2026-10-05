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

test("4 : le site garde les retours à la ligne tapés, comme l'aperçu de l'éditeur", () => {
  assert.match(config, /^markdown: kramdown\s*$/m);
  const kramdown = sousCles(config, "kramdown");
  assert.ok(kramdown, "_config.yml doit avoir un bloc kramdown (GitHub Pages laisse surcharger hard_wrap)");
  assert.ok(kramdown.includes("hard_wrap: true"), "kramdown doit porter hard_wrap: true : " + kramdown.join(", "));
  /* Le texte de bienvenue de Réglages n'est pas du Markdown : même règle, par le filtre. */
  assert.match(lit("index.html"), /\{\{ site\.data\.accueil\.texte \| newline_to_br \}\}/);
});

test("contrat 9 : une adresse longue se coupe au lieu de déborder du texte d'un article", () => {
  const css = lit("assets/css/style.css");
  const regle = /^\.prose \{([^}]*)\}/m.exec(css);
  assert.ok(regle, "règle .prose introuvable");
  assert.match(regle[1], /overflow-wrap: break-word;/);
});
