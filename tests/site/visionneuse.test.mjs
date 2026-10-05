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

/* Un élément décrit en une ligne : les messages d'échec restent lisibles. */
function decrit(el) {
  if (!el) return String(el);
  const parent = el.closest && el.closest(".visionneuse");
  return (parent ? parent.id + " > " : "") + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className ? "." + el.className.split(/\s+/).join(".") : "") +
    (el.getAttribute && el.getAttribute("href") ? '[href="' + el.getAttribute("href") + '"]' : "");
}

function focusSur(page, attendu, message) {
  assert.equal(decrit(page.activeElement), decrit(attendu), message);
  assert.ok(page.activeElement === attendu, message);
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

/* --- Défaut 75 : le clavier dans la vue -------------------------------------------- */

function ouvreAuClavier(p, rang) {
  vignette(p, rang).focus();
  p.touche("Enter");
  p.vide();
  assert.equal(p.location.hash, "#photo-" + rang);
  return vueOuverte(p);
}

test("75 : à l'ouverture, le focus va sur Fermer", () => {
  const p = chargeScript(article(4, ADRESSE));
  const vue = ouvreAuClavier(p, 2);
  focusSur(p, vue.querySelector(".visionneuse-fermer"));
});

test("75 : Tab et Maj+Tab tournent sur les trois liens de la vue, jamais sous le voile", () => {
  const p = chargeScript(article(4, ADRESSE));
  const vue = ouvreAuClavier(p, 2);
  const fermer = vue.querySelector(".visionneuse-fermer");
  const avant = vue.querySelector(".visionneuse-fleche--avant");
  const apres = vue.querySelector(".visionneuse-fleche--apres");
  const suite = [];
  for (let i = 0; i < 4; i++) {
    p.touche("Tab");
    suite.push(decrit(p.activeElement));
  }
  assert.deepEqual(suite, [avant, apres, fermer, avant].map(decrit), "Tab : flèche avant, flèche après, Fermer, puis on recommence");
  p.touche("Tab", { shiftKey: true });
  focusSur(p, fermer);
  p.touche("Tab", { shiftKey: true });
  focusSur(p, apres, "Maj+Tab depuis Fermer reste dans la vue");
});

test("75 : d'une photo à l'autre, le focus reste sur la même flèche", () => {
  const p = chargeScript(article(4, ADRESSE));
  ouvreAuClavier(p, 1);
  p.touche("Tab");
  p.touche("Tab");
  focusSur(p, vueOuverte(p).querySelector(".visionneuse-fleche--apres"));
  p.touche("Enter");
  p.vide();
  assert.equal(p.location.hash, "#photo-2");
  focusSur(p, vueOuverte(p).querySelector(".visionneuse-fleche--apres"));
  p.touche("Enter");
  p.vide();
  assert.equal(p.location.hash, "#photo-3", "un second Entrée avance encore au lieu de fermer");
});

test("75 : les flèches du clavier gardent le focus sur Fermer", () => {
  const p = chargeScript(article(4, ADRESSE));
  ouvreAuClavier(p, 1);
  p.touche("ArrowRight");
  p.vide();
  focusSur(p, vueOuverte(p).querySelector(".visionneuse-fermer"));
});

test("75 : à la fermeture, le focus revient sur la vignette de la dernière photo vue", () => {
  const p = chargeScript(article(4, ADRESSE));
  ouvreAuClavier(p, 1);
  p.touche("ArrowRight");
  p.vide();
  p.touche("ArrowRight");
  p.vide();
  p.touche("Escape");
  p.vide();
  assert.equal(vueOuverte(p), null);
  focusSur(p, vignette(p, 3));
});

test("75 : arrivé par un lien partagé, le focus est déjà dans la vue", () => {
  const p = chargeScript(article(4, ADRESSE + "#photo-3"));
  focusSur(p, vueOuverte(p).querySelector(".visionneuse-fermer"));
  p.touche("Tab", { shiftKey: true });
  assert.ok(vueOuverte(p).contains(p.activeElement));
});

test("75 : une vue d'une seule photo garde le focus sur Fermer", () => {
  const p = chargeScript(article(1, ADRESSE));
  const vue = ouvreAuClavier(p, 1);
  const fermer = vue.querySelector(".visionneuse-fermer");
  p.touche("Tab");
  focusSur(p, fermer);
  p.touche("Tab", { shiftKey: true });
  focusSur(p, fermer);
});

test("75 : Alt, Ctrl ou Cmd avec une flèche restent au navigateur (Retour au clavier)", () => {
  const p = chargeScript(article(4, ADRESSE));
  ouvreAuClavier(p, 2);
  const evt = p.touche("ArrowLeft", { altKey: true });
  assert.equal(evt.defaultPrevented, false);
  assert.equal(p.location.hash, "#photo-2");
});

/* --- Défaut 74 : la promesse du commentaire --------------------------------------- */

test("74 : site.js ne promet plus le glissement au doigt des photos d'une carte", () => {
  const entete = /^\/\*[\s\S]*?\*\//.exec(lit("assets/js/site.js"))[0];
  assert.doesNotMatch(entete, /les bandes se font glisser au doigt/);
  /* Le lien étiré de la carte (.card-title a::after) couvre ses photos : sur
     les cartes, elles se passent avec les flèches du script. */
  assert.match(lit("assets/css/style.css"), /\.card-title a::after \{\n  content: "";\n  position: absolute;\n  inset: 0;/);
  assert.match(entete, /cartes/);
  assert.match(entete, /flèches/);
  assert.match(entete, /article/);
});
