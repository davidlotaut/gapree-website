/* Faux navigateur minimal pour exécuter admin/app.js sans réseau ni dépendance.
   Il comprend juste assez de HTML (balises, id, classes, data-*, value, hidden,
   contenu des zones de texte) et d'événements (capture, cible, bulle) pour que
   l'espace d'administration fonctionne comme dans un vrai navigateur.
   Repris du banc des vérificateurs (brut/journaux/verif-saisies-perdues/faux-dom.js),
   complété : propagation des événements, sélecteurs composés, ajout d'éléments. */

const VIDES = new Set(["input", "img", "br", "meta", "link", "hr", "source"]);

function decode(t) {
  return String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&larr;/g, "←").replace(/&uarr;/g, "↑").replace(/&darr;/g, "↓")
    .replace(/&times;/g, "×").replace(/&amp;/g, "&");
}

/* Sélecteurs : listes séparées par des virgules, descendance par espaces,
   composés de balise, #id, .classe, [attribut] et [attribut="valeur"]. */
function analyseCompose(s) {
  const c = { tag: null, id: null, classes: [], attrs: [] };
  const re = /([a-zA-Z][a-zA-Z0-9-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) c.tag = m[1].toUpperCase();
    else if (m[2]) c.id = m[2];
    else if (m[3]) c.classes.push(m[3]);
    else c.attrs.push({ nom: m[4].toLowerCase(), valeur: m[5] });
  }
  return c;
}

function correspondCompose(el, c) {
  if (!el || el.nodeType !== 1) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  const classes = String(el.className || "").split(/\s+/);
  if (c.classes.some((k) => !classes.includes(k))) return false;
  return c.attrs.every((a) => {
    if (!(a.nom in el.attrs)) return false;
    return a.valeur === undefined || el.attrs[a.nom] === a.valeur;
  });
}

function correspond(el, selecteur) {
  return selecteur.split(",").some((groupe) => {
    const parts = groupe.trim().split(/\s+/).map(analyseCompose);
    if (!correspondCompose(el, parts[parts.length - 1])) return false;
    let p = el.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (p && !correspondCompose(p, parts[i])) p = p.parentNode;
      if (!p) return false;
      p = p.parentNode;
    }
    return true;
  });
}

export function creeDocument(htmlCorps, crochets) {
  crochets = crochets || {};
  let racine = null;

  function descendants(el) {
    const out = [];
    (function parcours(e) { e.enfants.forEach((d) => { out.push(d); parcours(d); }); })(el);
    return out;
  }

  function cree(tag, attrs) {
    attrs = attrs || {};
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      attrs: Object.assign({}, attrs),
      enfants: [],
      parentNode: null,
      ecouteurs: [],
      style: {},
      files: [],
      dataset: {},
      hidden: "hidden" in attrs,
      disabled: "disabled" in attrs,
      checked: "checked" in attrs,
      src: attrs.src !== undefined ? decode(attrs.src) : "",
      value: attrs.value !== undefined ? decode(attrs.value) : "",
      _texte: null,
      _html: "",
      get id() { return this.attrs.id || ""; },
      set id(v) { this.attrs.id = String(v); },
      get className() { return this.attrs.class || ""; },
      set className(v) { this.attrs.class = String(v); },
      get classList() {
        const e = this;
        const liste = () => e.className.split(/\s+/).filter(Boolean);
        return {
          contains: (c) => liste().includes(c),
          add: (c) => { if (!liste().includes(c)) e.className = liste().concat(c).join(" "); },
          remove: (c) => { e.className = liste().filter((x) => x !== c).join(" "); },
          toggle: (c, v) => {
            const a = v === undefined ? !liste().includes(c) : !!v;
            if (a) { if (!liste().includes(c)) e.className = liste().concat(c).join(" "); }
            else e.className = liste().filter((x) => x !== c).join(" ");
            return a;
          }
        };
      },
      get isConnected() {
        let p = this;
        while (p.parentNode) p = p.parentNode;
        return p === racine;
      },
      get textContent() {
        if (this._texte !== null) return this._texte;
        return decode(String(this._html || "").replace(/<[^>]*>/g, ""));
      },
      set textContent(v) {
        this._texte = String(v);
        this._html = "";
        this.enfants.forEach((d) => { d.parentNode = null; });
        this.enfants = [];
        if (crochets.texte) crochets.texte(this, this._texte);
      },
      get innerHTML() { return this._html; },
      set innerHTML(h) {
        this._texte = null;
        this._html = String(h);
        this.enfants.forEach((d) => { d.parentNode = null; });
        this.enfants = [];
        analyse(this._html, this);
      },
      get nextSibling() {
        if (!this.parentNode) return null;
        const f = this.parentNode.enfants;
        return f[f.indexOf(this) + 1] || null;
      },
      getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; },
      setAttribute(n, v) { this.attrs[n] = String(v); },
      appendChild(enfant) {
        if (enfant.parentNode) enfant.parentNode.enfants.splice(enfant.parentNode.enfants.indexOf(enfant), 1);
        enfant.parentNode = this;
        this.enfants.push(enfant);
        return enfant;
      },
      insertBefore(enfant, repere) {
        if (!repere) return this.appendChild(enfant);
        if (enfant.parentNode) enfant.parentNode.enfants.splice(enfant.parentNode.enfants.indexOf(enfant), 1);
        enfant.parentNode = this;
        this.enfants.splice(this.enfants.indexOf(repere), 0, enfant);
        return enfant;
      },
      remove() {
        if (this.parentNode) this.parentNode.enfants.splice(this.parentNode.enfants.indexOf(this), 1);
        this.parentNode = null;
      },
      focus() { document.activeElement = this; },
      blur() {},
      matches(sel) { return correspond(this, sel); },
      closest(sel) { let p = this; while (p && p.nodeType === 1) { if (correspond(p, sel)) return p; p = p.parentNode; } return null; },
      querySelectorAll(sel) { return descendants(this).filter((e) => correspond(e, sel)); },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      addEventListener(type, f, options) {
        const capture = options === true || !!(options && options.capture);
        this.ecouteurs.push({ type, f, capture });
      },
      removeEventListener(type, f) {
        this.ecouteurs = this.ecouteurs.filter((e) => !(e.type === type && e.f === f));
      },
      /* Déclenche un événement avec ses trois phases, comme le navigateur. */
      tire(type, complement) {
        const ev = Object.assign({
          type, target: this, currentTarget: null, defaultPrevented: false, _arret: false, _arretImmediat: false,
          preventDefault() { this.defaultPrevented = true; },
          stopPropagation() { this._arret = true; },
          stopImmediatePropagation() { this._arret = true; this._arretImmediat = true; }
        }, complement || {});
        if (this.disabled && (type === "click" || type === "submit")) return ev;
        const chemin = [];
        let p = this;
        while (p) { chemin.unshift(p); p = p.parentNode; }
        const appelle = (noeud, filtre) => {
          ev.currentTarget = noeud;
          for (const e of noeud.ecouteurs.slice()) {
            if (e.type !== type || !filtre(e)) continue;
            e.f.call(noeud, ev);
            if (ev._arretImmediat) break;
          }
        };
        for (let i = 0; i < chemin.length - 1 && !ev._arret; i++) appelle(chemin[i], (e) => e.capture);
        if (!ev._arret) appelle(this, () => true);
        for (let i = chemin.length - 2; i >= 0 && !ev._arret; i--) appelle(chemin[i], (e) => !e.capture);
        return ev;
      }
    };
    for (const k in attrs) {
      if (k.startsWith("data-")) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = decode(attrs[k]);
    }
    return el;
  }

  function analyse(html, parent) {
    const pile = [parent];
    const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
    let m;
    while ((m = re.exec(html))) {
      if (!m[1] && !m[2]) continue;
      if (m[1]) {
        const tag = m[1].toUpperCase();
        for (let i = pile.length - 1; i > 0; i--) {
          if (pile[i].tagName === tag) { pile.length = i; break; }
        }
        continue;
      }
      const tag = m[2].toLowerCase();
      const attrs = {};
      (m[3].match(/[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g) || []).forEach((a) => {
        const i = a.indexOf("=");
        if (i < 0) attrs[a.toLowerCase()] = "";
        else attrs[a.slice(0, i).trim().toLowerCase()] = a.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      });
      const el = cree(tag, attrs);
      const sommet = pile[pile.length - 1];
      el.parentNode = sommet;
      sommet.enfants.push(el);
      if (tag === "textarea") {
        const fin = html.indexOf("</textarea>", re.lastIndex);
        el.value = decode(html.slice(re.lastIndex, fin < 0 ? html.length : fin));
        re.lastIndex = fin < 0 ? html.length : fin + "</textarea>".length;
        continue;
      }
      if (!VIDES.has(tag)) pile.push(el);
    }
  }

  const document = {
    activeElement: null,
    getElementById: (id) => descendants(racine).find((e) => e.id === id) || null,
    querySelectorAll: (sel) => descendants(racine).filter((e) => correspond(e, sel)),
    querySelector: (sel) => descendants(racine).find((e) => correspond(e, sel)) || null,
    createElement: (tag) => {
      if (tag === "canvas") return crochets.toile ? crochets.toile() : cree("canvas", {});
      return cree(tag, {});
    }
  };
  racine = cree("html", {});
  racine.innerHTML = htmlCorps;
  document.documentElement = racine;
  document.body = racine;
  return document;
}
