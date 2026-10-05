/* Banc sans réseau de l'espace d'administration (lot admin-publication).

   Un « monde » est partagé par toutes les pages ouvertes dessus, comme un
   navigateur et un dépôt réels :
   - monde.depot : la branche main (chemin -> contenu), que /publier modifie ;
   - monde.commits : chaque révision publiée (copie de main), lue par raw ;
   - monde.deploye : le contenu.json servi par le site, qui ne change que quand
     le banc « construit » une révision (construit) ;
   - la base IndexedDB et la réserve localStorage du navigateur.
   Chaque page exécute le vrai admin/app.js (ou celui désigné par BANC_APP_JS)
   dans un faux DOM. Les minuteries d'une seconde et plus n'avancent qu'à la
   main (page.avance), les plus courtes passent tout de suite. Aucun réseau. */

import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creeDocument } from "./faux-dom.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../..");
const APP = process.env.BANC_APP_JS || path.join(RACINE, "admin/app.js");
const PUBLICATION = process.env.BANC_PUBLICATION_JS || path.join(RACINE, "admin/publication.js");
const INDEX = path.join(RACINE, "admin/index.html");
export const DEPOT_RAW = "https://raw.githubusercontent.com/davidlotaut/gapree-website/";
export const SERVEUR = "https://serveur.test";

const copie = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tour = () => new Promise((r) => setImmediate(r));

function corpsIndex() {
  const html = fs.readFileSync(INDEX, "utf8");
  const corps = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
  return corps.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
}

/* ------------------------------------------------------------ IndexedDB */

function creeIndexedDB(bases) {
  function connexion(base) {
    return {
      createObjectStore(nom) { base.magasins.set(nom, new Map()); },
      close() {},
      transaction(nomMagasin) {
        const t = { error: null };
        const magasin = base.magasins.get(nomMagasin);
        const file = [];
        let demarree = false, occupee = false, finie = false, liberer;
        const verrou = new Promise((r) => { liberer = r; });
        const avant = base.file;
        base.file = avant.then(() => verrou);
        function pompe() {
          if (!demarree || occupee || finie) return;
          if (!file.length) {
            finie = true;
            setImmediate(() => { if (t.oncomplete) t.oncomplete(); liberer(); });
            return;
          }
          const op = file.shift();
          occupee = true;
          setImmediate(() => {
            try {
              op.demande.result = op.fait();
            } catch (e) {
              t.error = e; finie = true;
              if (t.onerror) t.onerror(); liberer();
              return;
            }
            if (op.demande.onsuccess) op.demande.onsuccess({ target: op.demande });
            occupee = false;
            pompe();
          });
        }
        function ajoute(fait) { const demande = {}; file.push({ demande, fait }); pompe(); return demande; }
        t.objectStore = () => ({
          get: (k) => ajoute(() => structuredClone(magasin.get(k))),
          put: (v, k) => ajoute(() => { magasin.set(k, structuredClone(v)); return k; }),
          delete: (k) => ajoute(() => { magasin.delete(k); return undefined; })
        });
        avant.then(() => { demarree = true; pompe(); });
        return t;
      }
    };
  }
  return {
    open(nom) {
      const demande = {};
      setImmediate(() => {
        let base = bases.get(nom);
        const nouvelle = !base;
        if (nouvelle) { base = { magasins: new Map(), file: Promise.resolve() }; bases.set(nom, base); }
        demande.result = connexion(base);
        if (nouvelle && demande.onupgradeneeded) demande.onupgradeneeded();
        if (demande.onsuccess) demande.onsuccess();
      });
      return demande;
    }
  };
}

/* ------------------------------------------- lecture des fichiers publiés */

function valeurYaml(s) {
  s = s.trim();
  if (/^".*"$/.test(s)) return JSON.parse(s);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (s === "[]") return [];
  return s;
}

/* Lit l'en-tête des fichiers tels que l'espace les écrit (chaînes entre
   guillemets, listes de photos ou de créneaux, blocs littéraux). */
export function litEnTete(texte) {
  const m = String(texte).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const yaml = m ? m[1] : String(texte);
  const v = {};
  let liste = null, element = null, bloc = null;
  yaml.split("\n").forEach((l) => {
    let r;
    if (bloc) {
      if (/^ {2}/.test(l)) { v[bloc] += (v[bloc] ? "\n" : "") + l.slice(2); return; }
      bloc = null;
    }
    if ((r = l.match(/^([a-z_]+): \|-$/))) { bloc = r[1]; v[bloc] = ""; return; }
    if ((r = l.match(/^([a-z_]+):\s*$/))) { liste = v[r[1]] = []; return; }
    if ((r = l.match(/^\s+- ([a-z_]+):\s*(.*)$/))) { element = {}; element[r[1]] = valeurYaml(r[2]); liste.push(element); return; }
    if ((r = l.match(/^\s+([a-z_]+):\s*(.*)$/)) && element) { element[r[1]] = valeurYaml(r[2]); return; }
    if ((r = l.match(/^([a-z_]+):\s*(.*)$/))) { v[r[1]] = valeurYaml(r[2]); liste = null; element = null; }
  });
  return { valeurs: v, corps: m ? m[2] : "" };
}

/* ---------------------------------------------------------------- monde */

export function creeMonde(fichiers, options) {
  options = options || {};
  const monde = {
    depot: Object.assign({}, fichiers || {}),
    commits: {},
    numero: 0,
    deploye: null,
    stock: new Map(),
    bases: new Map(),
    lectures: [],
    lecturesContenu: [],
    publications: [],
    televersements: [],
    blobs: {},
    journal: [],
    connecte: true,
    n: 0,
    /* L'heure du monde, partagée par ses pages : elle n'avance qu'avec page.avance. */
    maintenant: Date.parse("2026-10-05T10:00:00Z"),
    tic: 0
  };
  monde.commits.c0 = Object.assign({}, monde.depot);

  /* Construit le contenu.json d'une révision, comme Jekyll le ferait. */
  monde.construit = function (revision, sansRevision) {
    const arbre = monde.commits[revision];
    const deploye = { actualites: [], talents: [], elus: [], reglages: { accueil: {}, mairie: {} } };
    if (!sansRevision) deploye.revision = revision;
    Object.keys(arbre).sort().reverse().forEach((chemin) => {
      const contenu = arbre[chemin];
      if (/^_(actualites|talents)\/.+\.md$/.test(chemin)) {
        const v = litEnTete(contenu).valeurs;
        const rubrique = chemin.indexOf("_talents/") === 0 ? "talents" : "actualites";
        const item = { chemin, titre: v.title, date: String(v.date || ""), image: v.image || null, alt: v.alt || null,
          photos: v.photos || null, video: v.video || null };
        if (rubrique === "talents") item.sous_titre = v.sous_titre || null;
        else item.documents = v.documents || null;
        deploye[rubrique].push(item);
      } else if (/^_elus\/.+\.md$/.test(chemin)) {
        const v = litEnTete(contenu).valeurs;
        deploye.elus.push({ chemin, nom: v.title, fonction: v.fonction || null, photo: v.photo || null, ordre: v.ordre || null });
      } else if (chemin === "_data/accueil.yml") {
        deploye.reglages.accueil = litEnTete(contenu).valeurs;
      } else if (chemin === "_data/mairie.yml") {
        deploye.reglages.mairie = litEnTete(contenu).valeurs;
      }
    });
    deploye.elus.sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
    monde.deploye = deploye;
    return deploye;
  };

  /* Ce que fait le serveur : écrire sur main, en un enregistrement. */
  monde.applique = function (corps) {
    (corps.fichiers || []).forEach((f) => {
      if (typeof f.texte === "string") monde.depot[f.chemin] = f.texte;
      else if (f.sha) monde.depot[f.chemin] = "photo " + (monde.blobs[f.sha] || f.sha);
      else if (f.base64) monde.depot[f.chemin] = "photo " + f.base64;
    });
    (corps.suppressions || []).forEach((s) => { delete monde.depot[typeof s === "string" ? s : s.chemin]; });
    const revision = "c" + (++monde.numero);
    monde.commits[revision] = Object.assign({}, monde.depot);
    return { ok: true, commit: revision };
  };

  /* Pose un brouillon dans la base du navigateur, comme une séance précédente. */
  monde.poseBrouillon = function (surcouche) {
    let base = monde.bases.get("gapree-admin");
    if (!base) { base = { magasins: new Map([["brouillon", new Map()]]), file: Promise.resolve() }; monde.bases.set("gapree-admin", base); }
    base.magasins.get("brouillon").set("etat", structuredClone(surcouche));
  };

  /* Brouillon gardé par le navigateur (base, ou réserve à défaut). */
  monde.brouillon = function () {
    const base = monde.bases.get("gapree-admin");
    const etat = base && base.magasins.get("brouillon") && base.magasins.get("brouillon").get("etat");
    if (etat !== undefined) return copie(etat);
    const reserve = monde.stock.get("gapree-demo-admin");
    return reserve ? JSON.parse(reserve) : null;
  };

  monde.construit("c0", options.sansRevision);
  return monde;
}

export const vide = () => ({ modifies: {}, nouveaux: { actualites: [], talents: [], elus: [] }, supprimes: [], reglages: {}, deposees: {} });

/* --------------------------------------------------------------- pages */

function doublurePublication(monde) {
  const utilisateur = () => ({ email: "compte-du-banc", admin: true, doitChangerMotDePasse: false });
  return {
    estArme: () => true,
    estConnecte: () => monde.connecte,
    utilisateur: () => (monde.connecte ? utilisateur() : null),
    reprendSession: () => Promise.resolve(monde.connecte),
    connecte: () => { monde.connecte = true; return Promise.resolve(utilisateur()); },
    deconnecte: () => { monde.connecte = false; return Promise.resolve(); },
    changeMotDePasse: () => Promise.resolve(),
    journal: (q) => { monde.journal.push(copie(q)); return Promise.resolve(); },
    listeUtilisateurs: () => Promise.resolve([]),
    televerse: (paquet) => {
      monde.televersements.push(paquet.map((f) => f.chemin));
      return Promise.resolve().then(() => paquet.map((f) => {
        const sha = "blob" + (++monde.n);
        monde.blobs[sha] = f.base64;
        return { chemin: f.chemin, sha };
      }));
    },
    publie: (corps) => {
      const recu = copie(corps);
      monde.publications.push(recu);
      const suite = () => (monde.repondPublie ? monde.repondPublie(recu) : monde.applique(recu));
      if (monde.suspend) {
        return new Promise((resolve, reject) => {
          monde.liberePublication = () => { try { resolve(suite()); } catch (e) { reject(e); } };
        });
      }
      return Promise.resolve().then(suite);
    }
  };
}

function fauxFetch(monde, url, init) {
  url = String(url);
  const repond = (statut, corps) => Promise.resolve({
    ok: statut >= 200 && statut < 300, status: statut,
    json: () => Promise.resolve(typeof corps === "string" ? JSON.parse(corps) : copie(corps)),
    text: () => Promise.resolve(typeof corps === "string" ? corps : JSON.stringify(corps))
  });
  if (url === "contenu.json" || url.indexOf("contenu.json?") === 0) {
    monde.lecturesContenu.push({ url, cache: init && init.cache });
    if (monde.contenuEnPanne) return Promise.reject(new TypeError("Failed to fetch"));
    return repond(200, monde.deploye);
  }
  if (url.indexOf(DEPOT_RAW) === 0) {
    const reste = url.slice(DEPOT_RAW.length);
    const i = reste.indexOf("/");
    const ref = reste.slice(0, i), chemin = reste.slice(i + 1);
    monde.lectures.push({ ref, chemin });
    /* Un cache du navigateur peut resservir une lecture ancienne de main
       (hypothèse retenue pour c268939) ; une révision, elle, ne change jamais. */
    if (ref === "main" && monde.cacheMain && monde.cacheMain[chemin] !== undefined) return repond(200, monde.cacheMain[chemin]);
    const arbre = ref === "main" ? monde.depot : monde.commits[ref];
    if (!arbre || arbre[chemin] === undefined) return repond(404, "404: Not Found");
    return repond(200, arbre[chemin]);
  }
  if (url.indexOf(SERVEUR) === 0 && monde.serveur) {
    const corps = init && init.body ? JSON.parse(init.body) : null;
    const entetes = (init && init.headers) || {};
    return Promise.resolve(monde.serveur(url.slice(SERVEUR.length), (init && init.method) || "GET", corps, entetes))
      .then((r) => repond(r.statut, r.corps));
  }
  return Promise.reject(new Error("adresse non prévue au banc : " + url));
}

export function ouvrePage(monde, options) {
  options = options || {};
  const toasts = [];
  const document = creeDocument(corpsIndex(), {
    texte: (el, t) => { if (el.id === "toast") toasts.push(t); },
    toile: () => ({
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {}, fillStyle: "" }),
      toDataURL() {
        monde.n++;
        return "data:image/jpeg;base64," + Buffer.from("photo-" + monde.n + "-" + this.width + "x" + this.height).toString("base64");
      }
    })
  });
  const fermeture = [];
  let compteur = 0;
  const minuteries = [];
  const immediats = new Map();

  const page = {
    document, toasts, minuteries,
    questions: [], reponses: [], rechargements: 0,
    el: (id) => document.getElementById(id)
  };

  /* L'heure de la page suit celle du monde ; deux appels de Date.now() ne
     rendent jamais la même valeur, comme deux gestes réels. */
  class FauxDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(monde.maintenant); }
    static now() { return monde.maintenant + (++monde.tic); }
  }

  const ctx = {
    document, console,
    navigator: { userAgent: "banc", clipboard: null },
    localStorage: {
      getItem: (k) => (monde.stock.has(k) ? monde.stock.get(k) : null),
      setItem: (k, v) => { if (monde.reserveAPlafond && String(v).length > monde.reserveAPlafond) throw new Error("QuotaExceededError"); monde.stock.set(k, String(v)); },
      removeItem: (k) => { monde.stock.delete(k); }
    },
    indexedDB: options.sansBase ? undefined : creeIndexedDB(monde.bases),
    location: { reload() { page.rechargements++; } },
    confirm: (q) => { page.questions.push(q); return page.reponses.length ? page.reponses.shift() : true; },
    alert() {},
    setTimeout: (f, ms) => {
      ms = ms || 0;
      if (ms >= 1000) { const id = ++compteur; minuteries.push({ id, quand: monde.maintenant + ms, ms, f }); return id; }
      const id = ++compteur;
      immediats.set(id, setImmediate(() => { immediats.delete(id); f(); }));
      return id;
    },
    clearTimeout: (id) => {
      const i = minuteries.findIndex((m) => m.id === id);
      if (i !== -1) minuteries.splice(i, 1);
      if (immediats.has(id)) { clearImmediate(immediats.get(id)); immediats.delete(id); }
    },
    createImageBitmap: (f) => Promise.resolve({ width: f.largeur || 4000, height: f.hauteur || 3000, close() {} }),
    fetch: (url, init) => fauxFetch(monde, url, init),
    URL: { createObjectURL: () => "blob:banc", revokeObjectURL() {} },
    Date: FauxDate,
    structuredClone,
    addEventListener(type, f) { if (type === "beforeunload") fermeture.push(f); }
  };
  if (options.vraiePublication) ctx.GAPREE_SERVEUR = SERVEUR;
  else ctx.GapreePublication = doublurePublication(monde);
  ctx.window = ctx;
  vm.createContext(ctx);
  page.ctx = ctx;
  if (options.vraiePublication) vm.runInContext(fs.readFileSync(PUBLICATION, "utf8"), ctx, { filename: "publication.js" });
  vm.runInContext(fs.readFileSync(APP, "utf8"), ctx, { filename: "app.js" });

  page.attends = async function () { for (let i = 0; i < 400; i++) await tour(); };
  /* Fait passer le temps : les minuteries échues partent dans l'ordre. */
  page.avance = async function (ms) {
    const fin = monde.maintenant + ms;
    for (;;) {
      minuteries.sort((a, b) => a.quand - b.quand);
      const m = minuteries[0];
      if (!m || m.quand > fin) break;
      minuteries.shift();
      monde.maintenant = Math.max(monde.maintenant, m.quand);
      m.f();
      await page.attends();
    }
    monde.maintenant = Math.max(monde.maintenant, fin);
    await page.attends();
  };
  page.minuteriesDe = (ms) => minuteries.filter((m) => m.ms === ms).length;
  page.clic = (id) => { const e = page.el(id); if (!e) throw new Error("élément absent : " + id); return e.tire("click"); };
  page.saisit = (id, valeur) => { const e = page.el(id); e.value = valeur; e.tire("input"); };
  page.onglet = (rubrique) => document.querySelectorAll(".onglets button").find((b) => b.dataset.rubrique === rubrique).tire("click");
  page.ouvre = (chemin) => {
    const l = document.querySelectorAll(".ligne, .fiche-elu").find((x) => x.dataset.chemin === chemin);
    if (!l) throw new Error("élément absent de la liste : " + chemin);
    return l.tire("click");
  };
  page.etat = () => page.el("etat-publication").textContent;
  page.app = () => page.el("app").innerHTML;
  page.dernierToast = () => toasts[toasts.length - 1];
  /* Ce que ferait le navigateur à la fermeture : true = il demanderait confirmation. */
  page.retiendrait = () => fermeture.some((f) => {
    let retenu = false;
    f({ preventDefault() { retenu = true; }, set returnValue(v) { retenu = true; } });
    return retenu;
  });
  return page;
}

/* Un article tel que l'espace l'écrit. */
export function article(titre, date, corps, extra) {
  const l = ["---", "title: " + JSON.stringify(titre), "date: " + date];
  Object.keys(extra || {}).forEach((k) => {
    const v = extra[k];
    if (Array.isArray(v)) {
      l.push(k + ":");
      v.forEach((ph) => { l.push("  - src: " + JSON.stringify(ph.src)); if (ph.alt) l.push("    alt: " + JSON.stringify(ph.alt)); });
    } else l.push(k + ": " + JSON.stringify(v));
  });
  l.push("---");
  return l.join("\n") + "\n" + corps + "\n";
}

export function elu(nom, fonction, ordre, photo) {
  const l = ["---", "title: " + JSON.stringify(nom), "fonction: " + JSON.stringify(fonction), "ordre: " + ordre];
  if (photo) l.push("photo: " + JSON.stringify(photo));
  l.push("---");
  return l.join("\n") + "\n";
}

export const MAIRIE = 'adresse: |-\n  Mairie\n  Le bourg\ntelephone: "02 33 00 00 00"\nemail: "mairie@exemple.fr"\nhoraires:\n  - jours: "Jeudi"\n    heures: "9h30 à 12h30"\nnote_horaires: ""\ncarte: ""\n';
export const ACCUEIL = 'photo: "/assets/img/accueil-mto4xq8j.jpg"\nalt_photo: "Repas communal"\nsous_titre: "Commune de l\'Orne"\ntexte: |-\n  Bienvenue.\n';

/* Le petit site de départ commun à la plupart des essais. */
export function siteDeDepart() {
  return {
    "_actualites/2026-10-01-halloween.md": article("Halloween", "2026-10-01", "Rendez-vous le 17 octobre.",
      { image: "/assets/img/halloween-a1b2c3d4-aaaaa.jpg" }),
    "_actualites/2026-09-11-archives.md": article("Archives", "2026-09-11", "Les archives sont ouvertes."),
    "_elus/pierre-breton.md": elu("Pierre Breton", "Conseiller municipal", 4, "/assets/img/pierre-breton-muvmlze2-6sxz4.jpg"),
    "_data/mairie.yml": MAIRIE,
    "_data/accueil.yml": ACCUEIL,
    "assets/img/halloween-a1b2c3d4-aaaaa.jpg": "photo halloween",
    "assets/img/pierre-breton-muvmlze2-6sxz4.jpg": "photo pierre",
    "assets/img/accueil-mto4xq8j.jpg": "photo accueil"
  };
}

export { copie };
