// Doublure minimale d'un navigateur pour exécuter assets/js/site.js dans un
// contexte vm : un arbre d'éléments, des sélecteurs simples, le focus et la
// tabulation, l'adresse, l'historique et une file de tâches pour les
// événements que le navigateur envoie plus tard (hashchange, retour arrière).
//
// Règles du navigateur reproduites (spécification HTML) :
// - suivre une ancre vers une autre adresse ajoute une entrée d'historique
//   (« push ») ; location.replace remplace l'entrée courante ;
// - aller vers un fragment donne le focus à la cible si elle est focalisable,
//   sinon le rend à la page, et déplace le point de départ de la tabulation
//   sur la cible ; hashchange part ensuite, dans une tâche ;
// - history.back() est asynchrone ;
// - une vue .visionneuse n'est affichée que quand elle est la cible de
//   l'adresse (:target) : ses liens ne sont focalisables que dans ce cas ;
// - Tab sans script passe à l'élément focalisable suivant dans l'ordre du
//   document, même s'il est caché sous le voile de la vue ouverte.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { RACINE } from "./outils.mjs";

function correspondSimple(el, selecteur, doc) {
  const s = selecteur.trim();
  const m = /^([a-zA-Z][a-zA-Z0-9-]*|\*)?((?:\.[\w-]+|#[\w-]+|\[[\w-]+(?:="[^"]*")?\]|:target)*)$/.exec(s);
  if (!m) throw new Error("sélecteur non pris en charge par la doublure : " + s);
  if (m[1] && m[1] !== "*" && el.tagName !== m[1].toUpperCase()) return false;
  const re = /\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|(:target)/g;
  let p;
  while ((p = re.exec(m[2]))) {
    if (p[1] && !el.classList.contains(p[1])) return false;
    if (p[2] && el.id !== p[2]) return false;
    if (p[3]) {
      if (!(p[3] in el.attributs)) return false;
      if (p[4] !== undefined && el.attributs[p[3]] !== p[4]) return false;
    }
    if (p[5] && !(el.id && doc.location.hash === "#" + el.id)) return false;
  }
  return true;
}

export class Element {
  constructor(doc, balise, attributs = {}, enfants = []) {
    this.ownerDocument = doc;
    this.tagName = balise.toUpperCase();
    this.attributs = { ...attributs };
    this.enfants = [];
    this.parentNode = null;
    this.ecouteurs = {};
    this.hidden = false;
    this.disabled = false;
    this.scrollLeft = 0;
    this.scrollWidth = 0;
    this.clientWidth = 0;
    this.complete = true;
    for (const e of enfants) this.appendChild(e);
    const el = this;
    this.classList = {
      contains: (c) => (el.attributs.class || "").split(/\s+/).includes(c),
    };
  }
  get id() { return this.attributs.id || ""; }
  get className() { return this.attributs.class || ""; }
  set className(v) { this.attributs.class = v; }
  set innerHTML(_) { /* contenu décoratif des flèches : sans effet ici */ }
  get href() {
    const h = this.attributs.href;
    return h == null ? "" : new URL(h, this.ownerDocument.location.href).href;
  }
  getAttribute(n) { return n in this.attributs ? this.attributs[n] : null; }
  setAttribute(n, v) { this.attributs[n] = String(v); }
  hasAttribute(n) { return n in this.attributs; }
  appendChild(e) {
    if (e.parentNode) e.parentNode.enfants.splice(e.parentNode.enfants.indexOf(e), 1);
    e.parentNode = this;
    this.enfants.push(e);
    return e;
  }
  insertBefore(e, ref) {
    if (e.parentNode) e.parentNode.enfants.splice(e.parentNode.enfants.indexOf(e), 1);
    e.parentNode = this;
    this.enfants.splice(this.enfants.indexOf(ref), 0, e);
    return e;
  }
  matches(sel) {
    return sel.split(",").some((s) => correspondSimple(this, s, this.ownerDocument));
  }
  closest(sel) {
    for (let e = this; e instanceof Element; e = e.parentNode) if (e.matches(sel)) return e;
    return null;
  }
  querySelectorAll(sel) {
    const res = [];
    const visite = (e) => {
      for (const f of e.enfants) {
        if (f.matches(sel)) res.push(f);
        visite(f);
      }
    };
    visite(this);
    return res;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  contains(autre) {
    for (let e = autre; e; e = e.parentNode) if (e === this) return true;
    return false;
  }
  addEventListener(type, fn) { (this.ecouteurs[type] = this.ecouteurs[type] || []).push(fn); }
  getBoundingClientRect() { return { width: 0, height: 0 }; }
  scrollBy() {}
  focus() {
    const doc = this.ownerDocument;
    if (doc.estFocalisable(this)) doc.actif = this;
  }
  click() { this.ownerDocument.clique(this); }
}

export class Page {
  constructor(adresse) {
    this.entrees = [adresse];
    this.index = 0;
    this.taches = [];
    this.ecouteurs = {};
    this.ecouteursFenetre = {};
    this.readyState = "complete";
    this.body = new Element(this, "body");
    this.actif = this.body;
    this.depart = null;
    this.evenements = [];
    const page = this;
    this.location = {
      get href() { return page.entrees[page.index]; },
      get hash() { return new URL(page.entrees[page.index]).hash; },
      replace(url) { page.navigue(url, "replace"); },
    };
    this.history = {
      get length() { return page.entrees.length; },
      back() { page.traverse(-1); },
      forward() { page.traverse(1); },
    };
  }

  /* --- arbre ---------------------------------------------------------------- */
  el(balise, attributs, enfants) { return new Element(this, balise, attributs, enfants); }
  createElement(balise) { return new Element(this, balise); }
  getElementById(id) { return this.body.querySelectorAll("#" + id)[0] || null; }
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); }
  querySelector(sel) { return this.body.querySelector(sel); }
  get activeElement() { return this.actif; }
  addEventListener(type, fn) { (this.ecouteurs[type] = this.ecouteurs[type] || []).push(fn); }

  /* --- affichage et focus ---------------------------------------------------- */
  estAffiche(el) {
    for (let e = el; e instanceof Element; e = e.parentNode) {
      if (e.hidden) return false;
      if (e.classList.contains("visionneuse") && this.location.hash !== "#" + e.id) return false;
    }
    return true;
  }
  estFocalisable(el) {
    if (!this.estAffiche(el)) return false;
    if (el.tagName === "BUTTON") return !el.disabled;
    return (el.tagName === "A" && el.hasAttribute("href")) || el.hasAttribute("tabindex");
  }
  tabulables() {
    const res = [];
    const visite = (e) => {
      for (const f of e.enfants) {
        if (this.estFocalisable(f) && f.getAttribute("tabindex") !== "-1") res.push(f);
        visite(f);
      }
    };
    visite(this.body);
    return res;
  }
  ordre() {
    const res = [];
    const visite = (e) => { for (const f of e.enfants) { res.push(f); visite(f); } };
    visite(this.body);
    return res;
  }

  /* --- navigation -------------------------------------------------------------- */
  navigue(url, mode) {
    const cible = new URL(url, this.location.href);
    const courante = new URL(this.location.href);
    if (cible.origin + cible.pathname !== courante.origin + courante.pathname) {
      throw new Error("la doublure ne quitte pas la page : " + cible.href);
    }
    const avant = this.location.hash;
    if (mode === "push" && cible.href !== courante.href) {
      this.entrees = this.entrees.slice(0, this.index + 1).concat(cible.href);
      this.index++;
    } else {
      this.entrees[this.index] = cible.href;
    }
    /* Aller vers un fragment : focus à la cible si elle est focalisable, sinon
       à la page ; la tabulation repart de la cible. */
    const element = cible.hash ? this.getElementById(cible.hash.slice(1)) : null;
    if (element) {
      this.actif = this.estFocalisable(element) ? element : this.body;
      this.depart = element;
    }
    this.apresChangement(avant, true);
  }
  /* Retour ou Suivant du navigateur : asynchrone, sans toucher au focus sauf
     si l'élément qui l'avait disparaît de l'écran. */
  traverse(pas) {
    this.taches.push(() => {
      const i = this.index + pas;
      if (i < 0 || i >= this.entrees.length) return;
      const avant = this.location.hash;
      this.index = i;
      this.apresChangement(avant, false);
    });
  }
  apresChangement(avant, focusDejaFait) {
    if (!focusDejaFait && !this.estAffiche(this.actif)) this.actif = this.body;
    if (this.location.hash !== avant) {
      this.taches.push(() => this.envoieFenetre("hashchange", { type: "hashchange" }));
    }
  }
  vide() {
    for (let n = 0; this.taches.length; n++) {
      if (n > 1000) throw new Error("file de tâches sans fin");
      this.taches.shift()();
    }
  }

  /* --- événements ---------------------------------------------------------------- */
  evenement(type, cible, options = {}) {
    return {
      type, target: cible, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
      defaultPrevented: false, ...options,
      preventDefault() { this.defaultPrevented = true; },
    };
  }
  envoieDocument(type, evt) {
    for (const fn of (this.ecouteurs[type] || []).slice()) fn(evt);
    return evt;
  }
  envoieFenetre(type, evt) {
    this.evenements.push(type);
    for (const fn of (this.ecouteursFenetre[type] || []).slice()) fn(evt);
    return evt;
  }
  /* Un clic : l'événement remonte au document, puis l'action par défaut d'un
     lien s'exécute si personne ne l'a empêchée. */
  clique(el, options = {}) {
    const evt = this.envoieDocument("click", this.evenement("click", el, options));
    if (!evt.defaultPrevented) {
      const lien = el.closest("a");
      if (lien && lien.hasAttribute("href") && !options.ctrlKey && !options.metaKey) {
        const h = lien.getAttribute("href");
        if (h.startsWith("#")) this.navigue(h, "push");
      }
    }
    return evt;
  }
  /* Un clic à la souris donne d'abord le focus au lien (Chrome, Firefox). */
  clicSouris(el, options) {
    el.focus();
    return this.clique(el, options);
  }
  /* Une touche : keydown remonte au document ; sans script, Tab passe à
     l'élément focalisable suivant et Entrée active le lien qui a le focus. */
  touche(cle, options = {}) {
    const evt = this.envoieDocument("keydown", this.evenement("keydown", this.actif, { key: cle, ...options }));
    if (evt.defaultPrevented) return evt;
    if (cle === "Tab") {
      const liste = this.tabulables();
      let i = liste.indexOf(this.actif);
      if (i === -1) {
        /* Rien n'a le focus : on repart du point de départ de la tabulation. */
        const ordre = this.ordre();
        const pos = this.depart ? ordre.indexOf(this.depart) : -1;
        const apres = liste.filter((e) => ordre.indexOf(e) >= pos);
        const avant = liste.filter((e) => ordre.indexOf(e) < pos);
        const suivant = options.shiftKey ? avant[avant.length - 1] : apres[0];
        if (suivant) this.actif = suivant;
      } else {
        i += options.shiftKey ? -1 : 1;
        if (liste[i]) this.actif = liste[i];
      }
    } else if (cle === "Enter" && this.actif.tagName === "A") {
      this.clique(this.actif);
    }
    return evt;
  }
}

/* Un article à galerie, tel que le construisent galerie.html et
   photo-vue.html : la bande de vignettes, puis une vue en grand par photo,
   puis le pied de page. */
export function article(nombre, adresse = "https://gapree.com/actualites/2026-09-07-repas/") {
  const p = new Page(adresse);
  const e = (b, a, f) => p.el(b, a, f);
  p.body.appendChild(e("a", { class: "skip-link", href: "#contenu" }));
  const vignettes = [];
  for (let i = 1; i <= nombre; i++) {
    vignettes.push(e("figure", { class: "galerie-photo" }, [
      e("a", { class: "galerie-lien", href: "#photo-" + i, "aria-label": "Voir la photo " + i + " en grand" }, [e("img")]),
    ]));
  }
  const corps = e("main", { id: "contenu" }, [
    e("div", { class: "galerie", id: "les-photos", role: "group", "aria-label": "Photos de l'article", tabindex: "0" }, vignettes),
  ]);
  for (let i = 1; i <= nombre; i++) {
    const enfants = [
      e("a", { class: "visionneuse-fond", href: "#les-photos", "aria-label": "Fermer les photos", tabindex: "-1" }),
      e("a", { class: "visionneuse-fermer", href: "#les-photos", "aria-label": "Fermer les photos" }),
    ];
    if (nombre > 1) {
      const precedent = i - 1 < 1 ? nombre : i - 1;
      const suivant = i + 1 > nombre ? 1 : i + 1;
      enfants.push(e("a", { class: "visionneuse-fleche visionneuse-fleche--avant", href: "#photo-" + precedent, "aria-label": "Photo précédente", rel: "prev" }, [e("span")]));
      enfants.push(e("a", { class: "visionneuse-fleche visionneuse-fleche--apres", href: "#photo-" + suivant, "aria-label": "Photo suivante", rel: "next" }, [e("span")]));
    }
    enfants.push(e("figure", { class: "visionneuse-cadre" }, [e("img")]));
    corps.appendChild(e("div", { class: "visionneuse", id: "photo-" + i, role: "dialog", "aria-modal": "true" }, enfants));
  }
  p.body.appendChild(corps);
  p.body.appendChild(e("footer", { class: "site-footer" }, [
    e("a", { href: "tel:+33233278829" }),
    e("a", { href: "/mentions-legales/" }),
  ]));
  /* Arrivée directe sur une photo : la tabulation part de sa vue. */
  const hash = new URL(adresse).hash;
  if (hash) p.depart = p.getElementById(hash.slice(1));
  return p;
}

/* Exécute assets/js/site.js dans la page, comme le ferait <script defer>. */
export function chargeScript(page) {
  const code = readFileSync(join(RACINE, "assets/js/site.js"), "utf8");
  const fenetre = {
    document: page,
    location: page.location,
    history: page.history,
    addEventListener(type, fn) { (page.ecouteursFenetre[type] = page.ecouteursFenetre[type] || []).push(fn); },
    getComputedStyle() { return { columnGap: "0", gap: "0" }; },
    ResizeObserver: undefined,
    console,
  };
  fenetre.window = fenetre;
  vm.runInNewContext(code, fenetre, { filename: "site.js" });
  page.vide();
  return page;
}

/* La vue affichée, ou null. */
export function vueOuverte(page) {
  return page.querySelector(".visionneuse:target");
}
