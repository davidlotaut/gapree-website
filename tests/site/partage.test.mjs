// Défauts 59 et 68 : l'aperçu de partage (WhatsApp, Facebook) montre la photo
// et le résumé de la page partagée ; à défaut, un paysage sans personne et la
// description du site. La photo de groupe de l'accueil (environ soixante-dix
// habitants reconnaissables, dont un enfant) n'illustre plus chaque lien.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit, existe, taille, attributs, filtres } from "./outils.mjs";

const head = lit("_includes/head.html");
const metas = attributs(head).filter((a) => a.balise === "meta" && a.nom === "content");
const IMAGE_PAR_DEFAUT = "/assets/img/hero-gapree.jpg";

function contenuDe(propriete) {
  const ligne = head.split("\n").find((l) => l.includes(propriete));
  assert.ok(ligne, propriete + " introuvable dans head.html");
  return metas.find((a) => ligne.includes(a.valeur));
}

test("68 : l'image de partage est celle de la page, sinon un paysage sans personne", () => {
  assert.ok(!head.includes("site.data.accueil.photo"), "la photo d'accueil ne doit plus servir d'aperçu");
  const ogImage = contenuDe('property="og:image"');
  assert.equal(ogImage.sorties.length, 1);
  const { expression, filtres: chaine } = filtres(ogImage.sorties[0]);
  assert.equal(expression, "page.image");
  assert.deepEqual(chaine, ["default", "absolute_url", "escape"]);
  assert.ok(ogImage.sorties[0].includes("'" + IMAGE_PAR_DEFAUT + "'"), "image par défaut : " + IMAGE_PAR_DEFAUT);
});

test("59 : l'image par défaut existe et passe sous les 600 Ko des aperçus WhatsApp", () => {
  const chemin = IMAGE_PAR_DEFAUT.slice(1);
  assert.ok(existe(chemin), chemin + " doit exister");
  assert.ok(taille(chemin) < 600 * 1024, chemin + " pèse " + taille(chemin) + " octets");
});

test("59 : la description de partage est le résumé de la page partagée", () => {
  /* Un article (actualité ou talent) se résume par le début de son texte. */
  assert.match(head, /\{%- if page\.collection == "actualites" or page\.collection == "talents" -%\}/);
  assert.match(head, /\{%- assign resume = page\.content \| strip_html \| normalize_whitespace \| truncate: 160 -%\}/);
  /* Jekyll garde les variables d'une page à l'autre : resume est d'abord
     assigné sans condition, sinon une page sans résumé hériterait du résumé
     de la page construite avant elle. */
  const premiere = head.indexOf("assign resume = page.description");
  assert.ok(premiere !== -1, "resume doit partir de page.description");
  assert.ok(premiere < head.indexOf("{%- if resume"), "l'assignation sans condition vient d'abord");
  assert.match(head, /\{%- if resume == nil or resume == "" -%\}\{%- assign resume = site\.description -%\}\{%- endif/);
  /* Le texte d'un article est déjà du HTML (entités comprises) : escape_once
     protège les guillemets sans doubler les &amp; déjà écrits. */
  for (const propriete of ['name="description"', 'property="og:description"']) {
    const meta = contenuDe(propriete);
    assert.deepEqual(meta.sorties, ["resume | escape_once"], propriete);
  }
});
