// La vue en grand des photos d'un article (photo-vue.html et site.js), dans
// une doublure de navigateur : bouton Retour (défaut 56), clavier (défaut 75).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit } from "./outils.mjs";
import { article, chargeScript, vueOuverte } from "./navigateur.mjs";

const ADRESSE = "https://gapree.com/actualites/2026-09-07-repas/";

function lien(page, classe) {
  const vue = vueOuverte(page);
  assert.ok(vue, "aucune vue ouverte");
  return vue.querySelector(classe);
}

function vignette(page, rang) {
  return page.querySelector('.galerie-lien[href="#photo-' + rang + '"]');
}

/* --- Défaut 56 : le bouton Retour ---------------------------------------------- */

test("sans script, les liens de la vue restent de vraies ancres", () => {
  const vue = lit("_includes/photo-vue.html");
  assert.match(vue, /<a class="visionneuse-fond" href="#les-photos"/);
  assert.match(vue, /<a class="visionneuse-fermer" href="#les-photos"/);
  assert.match(vue, /href="#photo-\{\{ precedent \}\}"/);
  assert.match(vue, /href="#photo-\{\{ suivant \}\}"/);
  assert.match(lit("_includes/galerie.html"), /<a class="galerie-lien" href="#photo-\{\{ rang \}\}"/);
});

test("56 : ouvrir d'un clic, trois flèches, Fermer : on est revenu sur l'article, un seul Retour le quitte", () => {
  const p = chargeScript(article(54, ADRESSE));
  p.clicSouris(vignette(p, 1));
  p.vide();
  assert.equal(p.location.hash, "#photo-1");
  for (let i = 0; i < 3; i++) {
    p.clicSouris(lien(p, '[rel="next"]'));
    p.vide();
  }
  assert.equal(p.location.hash, "#photo-4");
  assert.equal(p.history.length, 2, "les flèches remplacent la photo au lieu d'empiler l'historique");
  p.clicSouris(lien(p, ".visionneuse-fermer"));
  p.vide();
  assert.equal(vueOuverte(p), null);
  assert.equal(p.location.href, ADRESSE, "Fermer revient à l'article lui-même");
  assert.equal(p.index, 0, "le Retour suivant quitte l'article");
});

test("56 : arrivé par un lien partagé vers une photo, Fermer ramène à la bande sans quitter le site", () => {
  const p = chargeScript(article(4, ADRESSE + "#photo-3"));
  p.clicSouris(lien(p, '[rel="next"]'));
  p.vide();
  assert.equal(p.location.hash, "#photo-4");
  p.clicSouris(lien(p, ".visionneuse-fermer"));
  p.vide();
  assert.equal(p.location.hash, "#les-photos");
  assert.deepEqual(p.entrees, [ADRESSE + "#les-photos"], "aucune entrée d'historique ajoutée");
});

test("56 : au clavier, Entrée ouvre, les flèches avancent, Échap ferme d'un seul pas", () => {
  const p = chargeScript(article(4, ADRESSE));
  vignette(p, 2).focus();
  p.touche("Enter");
  p.vide();
  assert.equal(p.location.hash, "#photo-2");
  p.touche("ArrowRight");
  p.vide();
  p.touche("ArrowRight");
  p.vide();
  p.touche("ArrowLeft");
  p.vide();
  assert.equal(p.location.hash, "#photo-3");
  assert.equal(p.history.length, 2);
  p.touche("Escape");
  p.vide();
  assert.equal(p.location.href, ADRESSE);
  assert.equal(p.index, 0);
});

test("56 : le fond de la vue ferme comme le bouton Fermer", () => {
  const p = chargeScript(article(4, ADRESSE));
  p.clicSouris(vignette(p, 3));
  p.vide();
  p.clique(lien(p, ".visionneuse-fond"));
  p.vide();
  assert.equal(p.location.href, ADRESSE);
  assert.equal(p.index, 0);
});

test("56 : un clic avec Ctrl ou Cmd garde le comportement du navigateur", () => {
  const p = chargeScript(article(4, ADRESSE));
  p.clicSouris(vignette(p, 1));
  p.vide();
  const evt = p.clique(lien(p, '[rel="next"]'), { ctrlKey: true });
  assert.equal(evt.defaultPrevented, false);
});

test("56 : après un lien partagé puis Fermer, une photo rouverte d'un clic se referme d'un pas", () => {
  const p = chargeScript(article(4, ADRESSE + "#photo-2"));
  p.clicSouris(lien(p, ".visionneuse-fermer"));
  p.vide();
  assert.equal(p.location.hash, "#les-photos");
  p.clicSouris(vignette(p, 4));
  p.vide();
  p.clicSouris(lien(p, '[rel="prev"]'));
  p.vide();
  assert.equal(p.location.hash, "#photo-3");
  p.clicSouris(lien(p, ".visionneuse-fermer"));
  p.vide();
  assert.equal(p.location.hash, "#les-photos");
  assert.equal(p.index, 0, "retour à l'entrée d'avant l'ouverture");
  assert.equal(p.history.length, 2);
});

test("56 : fermée par le bouton Retour, puis rouverte par Suivant du navigateur, la vue ne recule pas hors du site", () => {
  const p = chargeScript(article(4, ADRESSE));
  p.clicSouris(vignette(p, 1));
  p.vide();
  p.history.back();
  p.vide();
  assert.equal(vueOuverte(p), null);
  /* Suivant du navigateur : la vue revient sans clic sur la bande. */
  p.history.forward();
  p.vide();
  assert.equal(p.location.hash, "#photo-1");
  p.clicSouris(lien(p, ".visionneuse-fermer"));
  p.vide();
  assert.equal(p.location.hash, "#les-photos", "Fermer remplace l'adresse au lieu de reculer d'une page");
  assert.equal(p.index, 1);
});
