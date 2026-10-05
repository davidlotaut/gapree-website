/* Banc sans réseau ni dépendance pour les éditeurs de l'espace d'administration.

   Il exécute admin/app.js tel qu'il est dans le dépôt, dans un faux navigateur
   qui comprend juste assez de HTML (balises, id, classes, data-*, value,
   hidden, disabled, contenu d'un textarea) pour que les éditeurs fonctionnent
   comme dans un vrai navigateur. Le serveur est remplacé par un enregistreur,
   le texte des articles et contenu.json par des données de test, et l'heure
   peut être figée. Le fuseau est celui de la mairie. */

import vm from "node:vm";
import fs from "node:fs";

process.env.TZ = "Europe/Paris";

const RACINE = new URL("../../", import.meta.url);
export const lit = (chemin) => fs.readFileSync(new URL(chemin, RACINE), "utf8");

/* ------------------------------------------------------------ faux DOM */

const VIDES = new Set(["input", "img", "br", "meta", "link", "hr", "source", "wbr"]);

function decode(t) {
  return String(t).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function cree(tag, attrs, parent) {
  const el = {
    tagName: tag.toUpperCase(), attrs, parent, enfants: [], ecouteurs: {}, style: {}, files: [],
    id: attrs.id || "", className: attrs.class || "",
    hidden: "hidden" in attrs, disabled: "disabled" in attrs,
    value: attrs.value !== undefined ? decode(attrs.value) : "", textContent: "", checked: false,
    dataset: {}, src: attrs.src !== undefined ? decode(attrs.src) : "",
    addEventListener(t, f) { (this.ecouteurs[t] = this.ecouteurs[t] || []).push(f); },
    removeEventListener() {},
    tire(t, ev) {
      (this.ecouteurs[t] || []).slice().forEach((f) => f(Object.assign({ preventDefault() {}, target: this }, ev || {})));
    },
    focus() {},
    getAttribute(n) { return n in this.attrs ? decode(this.attrs[n]) : null; },
    hasAttribute(n) { return n in this.attrs; },
    closest(sel) { let p = this; while (p) { if (correspond(p, sel)) return p; p = p.parent; } return null; },
    querySelectorAll(sel) { return descendants(this).filter((e) => correspond(e, sel)); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    get isConnected() {
      let n = this;
      while (n.parent) {
        if (!n.parent.enfants.includes(n)) return false;
        n = n.parent;
      }
      return n.estRacine === true;
    },
    get classList() {
      const e = this;
      const noms = () => e.className.split(/\s+/).filter(Boolean);
      return {
        contains: (c) => noms().includes(c),
        toggle: (c, v) => {
          const s = new Set(noms());
          if (v === undefined ? !s.has(c) : v) s.add(c); else s.delete(c);
          e.className = [...s].join(" ");
        },
        add: (c) => { if (!noms().includes(c)) e.className = noms().concat(c).join(" "); },
        remove: (c) => { e.className = noms().filter((x) => x !== c).join(" "); }
      };
    },
    set innerHTML(h) { this._html = String(h); analyse(this._html, this); },
    get innerHTML() { return this._html || "" }
  };
  for (const k in attrs) {
    if (k.startsWith("data-")) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = decode(attrs[k]);
  }
  return el;
}

function analyse(html, racine) {
  racine.enfants = [];
  const pile = [racine];
  const re = /<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (pile.length > 1) pile.pop(); continue; }
    const tag = m[2].toLowerCase();
    const attrs = {};
    (m[3].match(/[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g) || []).forEach((a) => {
      const i = a.indexOf("=");
      if (i < 0) attrs[a.toLowerCase()] = "";
      else attrs[a.slice(0, i).trim().toLowerCase()] = a.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    });
    const parent = pile[pile.length - 1];
    const el = cree(tag, attrs, parent);
    if (tag === "textarea") {
      const fin = html.indexOf("</textarea>", re.lastIndex);
      el.value = decode(html.slice(re.lastIndex, fin));
      re.lastIndex = fin;
    }
    parent.enfants.push(el);
    if (!VIDES.has(tag)) pile.push(el);
  }
}

function descendants(el) { return el.enfants.flatMap((d) => [d, ...descendants(d)]); }

function correspond(el, sel) {
  const parts = sel.trim().split(/\s+/);
  const un = (e, s) => {
    if (s.startsWith(".")) return e.className.split(/\s+/).includes(s.slice(1));
    if (s.startsWith("#")) return e.id === s.slice(1);
    if (s.startsWith("[")) {
      const [nom, val] = s.slice(1, -1).split("=");
      return nom in e.attrs && (val === undefined || decode(e.attrs[nom]) === val.replace(/^["']|["']$/g, ""));
    }
    return e.tagName === s.toUpperCase();
  };
  if (!un(el, parts[parts.length - 1])) return false;
  let p = el.parent;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (p && !un(p, parts[i])) p = p.parent;
    if (!p) return false;
    p = p.parent;
  }
  return true;
}

function fauxDocument(html, compteur) {
  const racine = cree("html", {}, null);
  racine.estRacine = true;
  racine.innerHTML = html;
  return {
    racine,
    getElementById: (id) => descendants(racine).find((e) => e.id === id) || null,
    querySelectorAll: (sel) => descendants(racine).filter((e) => correspond(e, sel)),
    querySelector: (sel) => descendants(racine).find((e) => correspond(e, sel)) || null,
    createElement: (tag) => tag === "canvas"
      ? {
          width: 0, height: 0,
          getContext: () => ({ fillRect() {}, drawImage() {}, fillStyle: "" }),
          toDataURL(type, qualite) {
            compteur.n++;
            return "data:image/jpeg;base64," + Buffer.from("PHOTO-" + this.width + "x" + this.height + "-" + compteur.n).toString("base64");
          }
        }
      : cree(tag, {}, null)
  };
}

/* Taille d'une photo réduite, relue dans la fausse image produite plus haut. */
export function tailleDe(dataUrl) {
  const m = String(dataUrl).match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) return null;
  const t = Buffer.from(m[1], "base64").toString().match(/^PHOTO-(\d+)x(\d+)-/);
  return t ? { largeur: +t[1], hauteur: +t[2] } : null;
}

/* ------------------------------------------------------- données de test */

/* Contenu publié, au format de admin/contenu.json après la revue du 05/10/2026
   (contrat 4 : date avec l'heure, révision, documents). */
export function contenuDeTest() {
  return {
    revision: "rev-de-test",
    actualites: [
      { chemin: "_actualites/2026-10-05-elections.md", titre: "Informations élections", date: "2026-10-05T12:06:58+02:00",
        image: "/assets/img/elections.jpg", alt: null, photos: null, video: null, documents: null },
      { chemin: "_actualites/2026-10-05-ronde.md", titre: "Ronde classique", date: "2026-10-05T00:00:00+02:00",
        image: "/assets/img/ronde.jpg", alt: "Coureurs au départ", photos: [{ src: "/assets/img/ronde-2.jpg", alt: "" }], video: null },
      { chemin: "_actualites/2026-09-11-messe.md", titre: "Messe annuelle", date: "2026-09-11",
        image: "/assets/img/messe.jpg", alt: null, photos: null, video: null }
    ],
    talents: [
      { chemin: "_talents/habitants.md", titre: "Habitants de Gâprée", sous_titre: "Faites connaître vos talents",
        date: "2026-09-01T00:00:00+02:00", image: null, alt: null, photos: null, video: null }
    ],
    elus: [
      { chemin: "_elus/premiere-elue.md", nom: "Première Élue", fonction: "Maire", photo: "/assets/img/elus/premiere.jpg", ordre: 1 },
      { chemin: "_elus/second-elu.md", nom: "Second Élu", fonction: "1er adjoint au Maire", photo: null, ordre: 2 }
    ],
    reglages: {
      accueil: { photo: "/assets/img/hero.jpg", alt_photo: "Le bourg", sous_titre: "Commune de l'Orne", texte: "Bienvenue à Gâprée." },
      mairie: { adresse: "Mairie\nLe bourg\n61390 Gâprée", telephone: "02 33 00 00 00", email: "ADRESSE_PUBLIQUE_MAIRIE",
        horaires: [{ jours: "Jeudi", heures: "9h30 à 12h30" }], note_horaires: "", carte: "" }
    }
  };
}

export const TEXTES_DE_TEST = {
  "_actualites/2026-10-05-elections.md": "---\ntitle: \"Informations élections\"\ndate: 2026-10-05 12:06:58 +0200\n---\nMesdames, Messieurs,\n\nBien cordialement.\n",
  "_actualites/2026-10-05-ronde.md": "---\ntitle: \"Ronde classique\"\ndate: 2026-10-05\n---\nLa ronde passe par le bourg.\n",
  "_actualites/2026-09-11-messe.md": "---\ntitle: \"Messe annuelle\"\ndate: 2026-09-11\n---\nChaque année a lieu une messe.\n",
  "_talents/habitants.md": "---\ntitle: \"Habitants de Gâprée\"\n---\nFaites-vous connaître.\n"
};

/* ------------------------------------------------------------------ banc */

/* options :
   - maintenant : instant figé (nombre ou Date) pour new Date() et Date.now()
   - sessionReprise : false pour passer par l'écran de connexion (vrai par défaut)
   - contenu, textes : données servies à la place de celles de test
   - reponseConfirm : valeur rendue par confirm (vrai par défaut)
   - brouillon : brouillon déjà enregistré dans le navigateur             */
export async function ouvreBanc(options = {}) {
  const compteur = { n: 0 };
  const html = lit("admin/index.html");
  const corps = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script"));
  const document = fauxDocument(corps, compteur);
  const stock = new Map();
  /* Brouillon laissé par une session précédente (format de la réserve du navigateur). */
  if (options.brouillon) stock.set("gapree-demo-admin", JSON.stringify(options.brouillon));
  const publications = [], televersements = [], toasts = [], confirmations = [], minuteries = [], erreurs = [];
  const raw = { delai: 0, delais: {}, echec: false, appels: 0, textes: Object.assign({}, options.textes || TEXTES_DE_TEST) };
  const contenu = options.contenu || contenuDeTest();
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  const toast = document.getElementById("toast");
  let texteToast = "";
  Object.defineProperty(toast, "textContent", {
    get() { return texteToast; },
    set(v) { texteToast = String(v); toasts.push(texteToast); }
  });

  let DateDuBanc = Date;
  if (options.maintenant !== undefined) {
    const fige = +options.maintenant;
    DateDuBanc = class extends Date {
      constructor(...a) { if (a.length === 0) super(fige); else super(...a); }
      static now() { return fige; }
    };
  }

  let connecte = options.sessionReprise !== false;
  const fenetre = {
    document, console, Date: DateDuBanc, Buffer,
    navigator: { userAgent: "banc", clipboard: null },
    location: { reload() { minuteries.push("rechargement"); } },
    localStorage: {
      getItem: (k) => (stock.has(k) ? stock.get(k) : null),
      setItem: (k, v) => stock.set(k, String(v)),
      removeItem: (k) => stock.delete(k)
    },
    confirm: (q) => { confirmations.push(String(q)); return options.reponseConfirm !== undefined ? options.reponseConfirm : true; },
    alert() {},
    setTimeout: (f, ms) => {
      if (ms >= 5000) { minuteries.push("minuterie " + ms + " ms"); return 0; }
      return setTimeout(f, ms);
    },
    clearTimeout,
    addEventListener() {},
    URL: { createObjectURL: () => "blob:banc", revokeObjectURL() {} },
    /* Une photo « décodée » : 4000 x 3000 points par défaut, après un délai réglable. */
    createImageBitmap: (f) => pause(f.delai || 5).then(() => {
      if (f.illisible) throw new Error("illisible");
      return { width: f.largeur || 4000, height: f.hauteur || 3000, close() {} };
    }),
    /* Lecture d'un fichier entier (les documents PDF). */
    FileReader: class {
      readAsDataURL(f) {
        pause(f.delai || 5).then(() => {
          if (f.illisible) { this.error = new Error("illisible"); if (this.onerror) this.onerror(); return; }
          this.result = "data:" + (f.type || "application/octet-stream") + ";base64,"
            + Buffer.from(f.contenu || "%PDF-1.4 banc").toString("base64");
          if (this.onload) this.onload();
        });
      }
    },
    fetch: async (url) => {
      url = String(url);
      if (/^contenu\.json(\?|$)/.test(url)) {
        return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(contenu)) };
      }
      const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
      if (m) {
        raw.appels++;
        await pause(raw.delais[m[1]] !== undefined ? raw.delais[m[1]] : raw.delai);
        if (raw.echec) throw new TypeError("Failed to fetch");
        const texte = raw.textes[m[1]];
        if (texte === undefined) return { ok: false, status: 404, text: async () => "" };
        return { ok: true, status: 200, text: async () => texte };
      }
      throw new Error("adresse non prévue au banc : " + url);
    },
    GapreePublication: {
      estArme: () => true,
      estConnecte: () => connecte,
      reprendSession: () => Promise.resolve(connecte),
      connecte: () => { connecte = true; return Promise.resolve({ email: "COMPTE_DE_TEST", admin: true }); },
      utilisateur: () => ({ email: "COMPTE_DE_TEST", admin: true, doitChangerMotDePasse: false }),
      journal: () => Promise.resolve(),
      televerse: (f) => {
        televersements.push(JSON.parse(JSON.stringify(f)));
        return Promise.resolve(f.map((x) => ({ chemin: x.chemin, sha: "sha-" + x.chemin })));
      },
      publie: (c) => {
        publications.push(JSON.parse(JSON.stringify(c)));
        return Promise.resolve({ ok: true, commit: "commit-" + publications.length });
      },
      listeUtilisateurs: () => Promise.resolve([]),
      deconnecte: () => Promise.resolve()
    }
  };
  fenetre.window = fenetre;
  vm.createContext(fenetre);
  const surErreur = (e) => erreurs.push(String(e && e.message || e));
  process.on("unhandledRejection", surErreur);
  vm.runInContext(lit("admin/app.js"), fenetre, { filename: "admin/app.js" });

  const el = (id) => document.getElementById(id);
  const banc = {
    fenetre, document, publications, televersements, toasts, confirmations, minuteries, erreurs, raw, pause, el,
    contenu,
    /* Un clic sur un bouton désactivé ne fait rien, comme dans un navigateur. */
    clic(cible) {
      const e = typeof cible === "string" ? el(cible) : cible;
      if (!e) throw new Error("élément introuvable : " + cible);
      if (e.disabled) return false;
      e.tire("click");
      return true;
    },
    saisit(id, v) { const e = el(id); e.value = v; e.tire("input"); e.tire("change"); },
    choisit(id, fichiers) { const e = el(id); e.files = fichiers; e.tire("change"); },
    onglet(r) { return banc.clic(document.querySelectorAll(".onglets button").find((b) => b.dataset.rubrique === r)); },
    ouvre(chemin) {
      const l = document.querySelectorAll(".ligne").concat(document.querySelectorAll(".fiche-elu"))
        .find((x) => x.dataset.chemin === chemin);
      if (!l) throw new Error("ligne introuvable : " + chemin);
      return banc.clic(l);
    },
    brouillon: () => JSON.parse(stock.get("gapree-demo-admin") || "null"),
    dernierToast: () => toasts[toasts.length - 1] || "",
    /* Publie le brouillon et rend les fichiers envoyés au serveur. */
    async publie() {
      banc.clic("btn-publier");
      await pause(60);
      const p = publications[publications.length - 1];
      return p || null;
    },
    fichierPublie(publication, chemin) {
      const f = publication && publication.fichiers.find((x) => x.chemin === chemin);
      return f ? f.texte : null;
    },
    ferme() { process.off("unhandledRejection", surErreur); }
  };
  await pause(20);
  return banc;
}

/* Photo ou document choisi dans un sélecteur de fichiers. */
export function photo(nom, extra) {
  return Object.assign({ name: nom || "IMG_0001.jpg", type: "image/jpeg", size: 3e6 }, extra || {});
}

export function photos(n, extra) {
  return Array.from({ length: n }, (_, i) => photo("IMG_" + (i + 1) + ".jpg", extra));
}

/* Rend un objet du contexte du banc comparable par assert.deepStrictEqual. */
export const brut = (x) => JSON.parse(JSON.stringify(x));
