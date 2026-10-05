// Défauts 8 et 35 : les mentions légales nomment la direction de la
// publication et le téléphone de l'hébergeur (LCEN art. 1-1 I 3° et 4°), et la
// rubrique « Données personnelles » dit ce que le site traite vraiment, au
// lieu d'affirmer qu'il ne collecte aucune donnée.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { lit, corps, frontMatter, RACINE, PROVISOIRE } from "./outils.mjs";

const page = lit("mentions-legales.md");

function rubrique(titre) {
  const m = new RegExp("^## " + titre + "\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))", "m").exec(page);
  assert.ok(m, "rubrique « " + titre + " » introuvable");
  return m[1];
}

test("35 : la direction de la publication est la maire en fonction, lue sur sa fiche d'élu", () => {
  const editeur = rubrique("Éditeur du site");
  assert.match(page, /\{%- assign maire = site\.elus \| where: "fonction", "Maire" \| first -%\}/);
  assert.match(editeur, /\*\*Direction de la publication\*\* : \{% if maire %\}\{\{ maire\.title \}\}, maire de Gâprée\{% else %\}le maire de Gâprée\{% endif %\}\./);
  /* La fiche existe : une et une seule personne porte la fonction « Maire ». */
  const fiches = readdirSync(join(RACINE, "_elus")).filter((f) => f.endsWith(".md"));
  const maires = fiches.filter((f) => /^fonction: "?Maire"?$/m.test(frontMatter(lit("_elus/" + f))));
  assert.deepEqual(maires, ["laetitia-raimbourg.md"]);
});

test("35 : l'hébergeur est nommé avec son adresse et son téléphone", () => {
  const hebergement = rubrique("Hébergement");
  assert.match(hebergement, /GitHub, Inc\., 88 Colin P\. Kelly Jr\. Street, San Francisco, CA 94107, États-Unis/);
  assert.match(hebergement, /Téléphone : \+1 877 448 4820/);
});

test("8 : la rubrique Données personnelles dit ce que le site traite, et comment exercer ses droits", () => {
  const donnees = rubrique("Données personnelles");
  assert.doesNotMatch(page, /ne collecte aucune donnée personnelle/);
  assert.match(donnees, /La commune de Gâprée est responsable/);
  /* Une ligne par traitement : publications, journaux de l'hébergeur, vidéos. */
  assert.match(donnees, /actualités/);
  assert.match(donnees, /portraits/);
  assert.match(donnees, /adresse IP/);
  assert.match(donnees, /GitHub/);
  assert.match(donnees, /États-Unis/);
  assert.match(donnees, /YouTube/);
  /* Retrait d'une photo, droits, délégué, réclamation. */
  assert.match(donnees, /retire sur simple demande/);
  assert.match(donnees, /rectifier ou effacer/);
  assert.match(donnees, /qui transmet votre demande au délégué de la commune/);
  assert.match(donnees, /CNIL/);
  assert.match(donnees, /https:\/\/www\.cnil\.fr\/fr\/plaintes/);
  assert.match(donnees, /3 place de Fontenoy, 75007 Paris/);
  /* Le courriel de la mairie est celui des Réglages, pas une copie figée. */
  assert.match(donnees, /\{\{ site\.data\.mairie\.email \}\}/);
});

test("8 et 35 : aucun texte provisoire visible", () => {
  assert.doesNotMatch(corps(page), PROVISOIRE);
});
