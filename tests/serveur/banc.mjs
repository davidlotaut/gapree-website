/* Banc sans réseau du serveur d'administration (serveur/src/index.js).

   Le module réel est importé tel quel. GitHub est simulé par un petit dépôt
   Git en mémoire, dont les empreintes de fichiers sont celles de Git ; le
   stockage COMPTES par un faux stockage clé-valeur à durée de vie. Tout appel
   réseau autre que l'API GitHub simulée est refusé. Les comptes sont fictifs
   (domaine réservé .invalid) et ne désignent personne. */

import { createHash, webcrypto } from "node:crypto";

/* ------------------------------------------------------------ horloge */

const heureReelle = Date.now;
let decalage = 0;
Date.now = () => heureReelle() + decalage;
export const avance = (secondes) => { decalage += secondes * 1000; };
const maintenant = () => Math.floor(Date.now() / 1000);

/* ------------------------------------------------- faux stockage COMPTES */

export class FauxKV {
  constructor() {
    this.m = new Map();
    this.ecritures = [];
  }
  async get(cle, type) {
    const e = this.m.get(cle);
    if (!e) return null;
    if (e.fin !== null && e.fin <= maintenant()) { this.m.delete(cle); return null; }
    return type === "json" ? JSON.parse(e.valeur) : e.valeur;
  }
  async put(cle, valeur, options) {
    const o = options || {};
    if (o.expirationTtl !== undefined && o.expirationTtl < 60) {
      throw new Error("durée de vie inférieure à 60 s");
    }
    this.ecritures.push({ cle, options: o });
    this.m.set(cle, { valeur: String(valeur), fin: o.expirationTtl ? maintenant() + o.expirationTtl : null });
  }
  async delete(cle) { this.m.delete(cle); }
  async list({ prefix }) {
    const noms = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
    return { keys: noms.map((name) => ({ name })), list_complete: true };
  }
  cles(prefixe) { return [...this.m.keys()].filter((k) => k.startsWith(prefixe)).sort(); }
  brut(cle) { const e = this.m.get(cle); return e ? e.valeur : null; }
}

/* ------------------------------------------------------- faux GitHub */

const sha1 = (donnees) => createHash("sha1").update(donnees).digest("hex");
export const shaBlobGit = (octets) =>
  sha1(Buffer.concat([Buffer.from("blob " + octets.length + "\0"), Buffer.from(octets)]));

const repondJson = (statut, objet) => new Response(JSON.stringify(objet), {
  status: statut, headers: { "content-type": "application/json" }
});

export class FauxGitHub {
  /* fichiers : { chemin: texte } du commit de départ, sur main. */
  constructor(fichiers) {
    this.blobs = new Map();
    this.arbres = new Map();
    this.commits = new Map();
    this.refs = new Map();
    this.appels = [];
    this.pannes = [];
    this.avantMiseAJour = null;
    const arbre = new Map();
    for (const [chemin, texte] of Object.entries(fichiers || {})) arbre.set(chemin, this.blob(Buffer.from(texte, "utf8")));
    this.refs.set("main", this.commit(this.arbre(arbre), [], "départ"));
  }

  blob(octets) { const s = shaBlobGit(octets); this.blobs.set(s, Buffer.from(octets)); return s; }
  arbre(contenu) {
    const s = sha1("arbre\0" + JSON.stringify([...contenu.entries()].sort()));
    if (!this.arbres.has(s)) this.arbres.set(s, new Map(contenu));
    return s;
  }
  commit(arbre, parents, message) {
    const s = sha1("commit\0" + arbre + "\0" + parents.join(",") + "\0" + message + "\0" + this.commits.size);
    this.commits.set(s, { arbre, parents, message });
    return s;
  }
  tete() { return this.refs.get("main"); }
  nombreCommits() { return this.commits.size; }
  lit(chemin, commit) {
    const c = this.commits.get(commit || this.tete());
    const s = this.arbres.get(c.arbre).get(chemin);
    return s ? this.blobs.get(s).toString("utf8") : undefined;
  }
  message(commit) { return this.commits.get(commit || this.tete()).message; }
  ancetre(a, b) {
    const pile = [b];
    while (pile.length) {
      const x = pile.pop();
      if (x === a) return true;
      pile.push(...this.commits.get(x).parents);
    }
    return false;
  }
  /* Une publication faite par quelqu'un d'autre : { chemin: texte, ou null pour retirer }. */
  publieDirect(changements, message) {
    const parent = this.tete();
    const contenu = new Map(this.arbres.get(this.commits.get(parent).arbre));
    for (const [chemin, texte] of Object.entries(changements)) {
      if (texte === null) contenu.delete(chemin);
      else contenu.set(chemin, this.blob(Buffer.from(texte, "utf8")));
    }
    const c = this.commit(this.arbre(contenu), [parent], message || "autre publication");
    this.refs.set("main", c);
    return c;
  }
  ecritures() { return this.appels.filter((a) => a.methode !== "GET"); }

  async repond(url, init) {
    const u = new URL(String(url));
    if (u.hostname !== "api.github.com") throw new Error("réseau interdit : " + u.hostname);
    const m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)$/);
    const p = m ? m[1] : u.pathname;
    const methode = (init && init.method) || "GET";
    const entetes = new Headers((init && init.headers) || {});
    const corps = init && init.body ? JSON.parse(init.body) : null;
    this.appels.push({ methode, p, corps, version: entetes.get("X-GitHub-Api-Version") });
    for (const panne of this.pannes) {
      if (panne.quand(methode, p)) return repondJson(panne.statut, panne.corps || { message: "panne simulée" });
    }
    let r;
    if (methode === "GET" && (r = p.match(/^\/git\/ref\/heads\/(.+)$/))) {
      if (!this.refs.has(r[1])) return repondJson(404, { message: "Not Found" });
      return repondJson(200, { ref: "refs/heads/" + r[1], object: { sha: this.refs.get(r[1]), type: "commit" } });
    }
    if (methode === "GET" && (r = p.match(/^\/git\/commits\/(.+)$/))) {
      if (!/^[0-9a-f]{40}$/.test(r[1])) return repondJson(422, { message: "No commit found for SHA: " + r[1] });
      const c = this.commits.get(r[1]);
      if (!c) return repondJson(404, { message: "Not Found" });
      return repondJson(200, { sha: r[1], tree: { sha: c.arbre }, parents: c.parents.map((sha) => ({ sha })), message: c.message });
    }
    if (methode === "GET" && (r = p.match(/^\/git\/trees\/(.+)$/))) {
      const contenu = this.arbres.get(r[1]);
      if (!contenu) return repondJson(404, { message: "Not Found" });
      const dossiers = new Set();
      const tree = [];
      for (const [chemin, sha] of [...contenu.entries()].sort()) {
        const morceaux = chemin.split("/");
        for (let i = 1; i < morceaux.length; i++) {
          const d = morceaux.slice(0, i).join("/");
          if (!dossiers.has(d)) { dossiers.add(d); tree.push({ path: d, mode: "040000", type: "tree", sha: sha1("dossier\0" + d) }); }
        }
        tree.push({ path: chemin, mode: "100644", type: "blob", sha, size: this.blobs.get(sha).length });
      }
      return repondJson(200, { sha: r[1], tree, truncated: false });
    }
    if (methode === "POST" && p === "/git/blobs") {
      if (typeof corps.content !== "string") return repondJson(422, { message: "content manquant" });
      const octets = corps.encoding === "base64" ? Buffer.from(corps.content, "base64") : Buffer.from(corps.content, "utf8");
      return repondJson(201, { sha: this.blob(octets) });
    }
    if (methode === "POST" && p === "/git/trees") {
      if (!this.arbres.has(corps.base_tree)) return repondJson(422, { message: "base_tree inconnu" });
      const contenu = new Map(this.arbres.get(corps.base_tree));
      const vus = new Set();
      for (const e of corps.tree) {
        if (vus.has(e.path)) return repondJson(422, { message: "GitRPC::BadObjectState (chemin en double)" });
        vus.add(e.path);
        if (e.sha === null) {
          if (!contenu.has(e.path)) return repondJson(422, { message: "GitRPC::BadObjectState (fichier absent)" });
          contenu.delete(e.path);
        } else if (typeof e.content === "string") {
          contenu.set(e.path, this.blob(Buffer.from(e.content, "utf8")));
        } else if (this.blobs.has(e.sha)) {
          contenu.set(e.path, e.sha);
        } else {
          return repondJson(422, { message: "tree.sha " + e.sha + " is not a valid blob" });
        }
      }
      return repondJson(201, { sha: this.arbre(contenu) });
    }
    if (methode === "POST" && p === "/git/commits") {
      if (!this.arbres.has(corps.tree)) return repondJson(422, { message: "tree inconnu" });
      const s = this.commit(corps.tree, corps.parents, corps.message);
      return repondJson(201, { sha: s, tree: { sha: corps.tree }, message: corps.message });
    }
    if (methode === "PATCH" && (r = p.match(/^\/git\/refs\/heads\/(.+)$/))) {
      if (this.avantMiseAJour) { const f = this.avantMiseAJour; this.avantMiseAJour = null; f(); }
      const actuel = this.refs.get(r[1]);
      if (!corps.force && !this.ancetre(actuel, corps.sha)) return repondJson(422, { message: "Update is not a fast forward" });
      this.refs.set(r[1], corps.sha);
      return repondJson(200, { ref: "refs/heads/" + r[1], object: { sha: corps.sha } });
    }
    return repondJson(404, { message: "Not Found" });
  }
}

/* --------------------------------------------------- serveur et requêtes */

export const serveur = (await import(new URL("../../serveur/src/index.js", import.meta.url))).default;

export function nouveauBanc(fichiers) {
  const github = new FauxGitHub(fichiers);
  globalThis.fetch = (url, init) => github.repond(url, init);
  const kv = new FauxKV();
  const env = {
    COMPTES: kv, DEPOT: "proprietaire/depot", BRANCHE: "main",
    ORIGINES: "https://gapree.com", JETON_GITHUB: "faux-jeton-de-banc"
  };
  return { github, kv, env };
}

/* Adresse fictive d'un compte du banc, sur un domaine réservé. */
export const adresse = (nom) => nom + "@" + "banc.invalid";

export async function empreinteMotDePasse(motDePasse, sel) {
  const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(motDePasse), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", salt: sel, iterations: 100000, hash: "SHA-256" }, base, 256);
  return Buffer.from(bits).toString("base64");
}

/* Compte écrit directement dans le stockage, comme le fait amorcer.mjs
   (format d'avant la mise à jour : sans numéro de version). */
export async function poseCompte(kv, nom, motDePasse, admin) {
  const sel = webcrypto.getRandomValues(new Uint8Array(16));
  await kv.put("compte:" + adresse(nom), JSON.stringify({
    email: adresse(nom), sel: Buffer.from(sel).toString("base64"),
    empreinte: await empreinteMotDePasse(motDePasse, sel),
    admin: !!admin, cree: "2026-10-05T00:00:00.000Z", aChange: true
  }));
}

export async function appel(env, methode, chemin, corps, options) {
  const o = options || {};
  const entetes = { "Content-Type": "application/json", Origin: "https://gapree.com" };
  if (o.jeton) entetes.Authorization = "Bearer " + o.jeton;
  if (o.ip) entetes["CF-Connecting-IP"] = o.ip;
  const r = await serveur.fetch(new Request("https://banc.invalid" + chemin, {
    method: methode, headers: entetes, body: corps ? JSON.stringify(corps) : undefined
  }), env);
  const texte = await r.text();
  let d = {};
  try { d = JSON.parse(texte); } catch (e) { d = {}; }
  return { statut: r.status, d };
}

export const connexion = (env, nom, motDePasse, ip) =>
  appel(env, "POST", "/connexion", { email: adresse(nom), motDePasse }, { ip });

/* Crée un compte et ouvre une session ; rend le jeton. */
export async function ouvreSession(banc, nom, admin) {
  await poseCompte(banc.kv, nom, "mot-de-passe-" + nom, admin);
  const r = await connexion(banc.env, nom, "mot-de-passe-" + nom);
  if (r.statut !== 200) throw new Error("connexion du banc refusée : " + r.statut);
  return r.d.jeton;
}

export const empreinteSha256 = (texte) => createHash("sha256").update(texte).digest("hex");
