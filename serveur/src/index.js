/* Serveur d'administration du site de Gâprée.

   Il rend possible ce qu'un site statique ne peut pas faire seul :
   - des comptes nominatifs (adresse électronique + mot de passe) que la mairie
     crée et retire elle-même,
   - une clé d'écriture qui ne quitte jamais ce serveur.

   Rien de personnel n'y est stocké : les comptes de la mairie, leurs sessions,
   et une clé qui ne sait faire qu'une chose, écrire dans le dépôt du site.   */

const ITERATIONS = 310000;
const DUREE_SESSION = 12 * 3600;        // secondes
const ESSAIS_MAX = 10;                  // par quart d'heure et par compte
const FENETRE_ESSAIS = 900;

/* ------------------------------------------------------------------ outils */

function base64(octets) {
  let s = "";
  const v = new Uint8Array(octets);
  for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
  return btoa(s);
}

function octets(b64) {
  const brut = atob(b64);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

async function empreinte(motDePasse, sel) {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(motDePasse), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sel, iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
  return base64(bits);
}

/* Comparaison à durée constante : le temps de réponse ne dit rien du secret. */
function memeChaine(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function alea(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

/* Mot de passe lisible au téléphone : ni 0/O ni 1/l/I. */
function motDePasseGenere() {
  const lettres = "abcdefghjkmnpqrstuvwxyz23456789";
  const tirage = alea(12);
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += lettres[tirage[i] % lettres.length];
    if (i === 3 || i === 7) s += "-";
  }
  return s;
}

function normaliseEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/* --------------------------------------------------------------------- KV */

const cleCompte = (email) => "compte:" + email;
const cleSession = (jeton) => "session:" + jeton;
const cleEssais = (email) => "essais:" + email;

async function litCompte(env, email) {
  return await env.COMPTES.get(cleCompte(email), "json");
}

async function ecritCompte(env, compte) {
  await env.COMPTES.put(cleCompte(compte.email), JSON.stringify(compte));
}

async function creeCompte(env, email, admin) {
  const motDePasse = motDePasseGenere();
  const sel = alea(16);
  const compte = {
    email,
    sel: base64(sel),
    empreinte: await empreinte(motDePasse, sel),
    admin: !!admin,
    cree: new Date().toISOString(),
    aChange: false
  };
  await ecritCompte(env, compte);
  return motDePasse;
}

/* ------------------------------------------------------------- réponses */

function origineAutorisee(requete, env) {
  const origine = requete.headers.get("Origin") || "";
  const permises = (env.ORIGINES || "").split(",").map((o) => o.trim()).filter(Boolean);
  return permises.includes(origine) ? origine : permises[0] || "";
}

function reponse(donnees, statut, requete, env) {
  return new Response(donnees === null ? null : JSON.stringify(donnees), {
    status: statut || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origineAutorisee(requete, env),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

const erreur = (message, statut, requete, env) => reponse({ erreur: message }, statut, requete, env);

/* ------------------------------------------------------------- sessions */

async function sessionDe(requete, env) {
  const entete = requete.headers.get("Authorization") || "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : "";
  if (!jeton) return null;
  const session = await env.COMPTES.get(cleSession(jeton), "json");
  if (!session) return null;
  const compte = await litCompte(env, session.email);
  if (!compte) return null;
  return { jeton, compte };
}

/* --------------------------------------------------------------- GitHub */

async function appelGitHub(env, chemin, options) {
  const o = options || {};
  const r = await fetch("https://api.github.com/repos/" + env.DEPOT + chemin, {
    method: o.method || "GET",
    headers: {
      Authorization: "Bearer " + env.JETON_GITHUB,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "gapree-admin"
    },
    body: o.corps ? JSON.stringify(o.corps) : undefined
  });
  if (!r.ok) {
    const detail = await r.text();
    /* Messages compréhensibles par la mairie ; le détail technique reste dans les journaux. */
    console.log("GitHub " + r.status + " : " + detail.slice(0, 300));
    if (r.status === 401 || r.status === 403) {
      throw new Error("La clé d'écriture du site n'est plus valable. Prévenez la personne qui a installé le site.");
    }
    if (r.status === 409 || r.status === 422) {
      throw new Error("Le site a été modifié entre-temps. Rechargez la page, puis publiez à nouveau.");
    }
    throw new Error("Le site n'a pas pu être mis à jour (erreur " + r.status + "). Réessayez dans un instant.");
  }
  return await r.json();
}

/* Écrit tous les changements en un seul enregistrement. */
async function publie(env, changements) {
  const branche = env.BRANCHE || "main";
  const fichiers = changements.fichiers || [];
  const suppressions = changements.suppressions || [];
  if (!fichiers.length && !suppressions.length) throw new Error("Rien à publier.");

  const ref = await appelGitHub(env, "/git/ref/heads/" + branche);
  const shaCommit = ref.object.sha;
  const commit = await appelGitHub(env, "/git/commits/" + shaCommit);

  const arbre = [];
  for (const f of fichiers) {
    if (f.base64) {
      const blob = await appelGitHub(env, "/git/blobs", {
        method: "POST", corps: { content: f.base64, encoding: "base64" }
      });
      arbre.push({ path: f.chemin, mode: "100644", type: "blob", sha: blob.sha });
    } else {
      arbre.push({ path: f.chemin, mode: "100644", type: "blob", content: f.texte });
    }
  }
  for (const chemin of suppressions) {
    arbre.push({ path: chemin, mode: "100644", type: "blob", sha: null });
  }

  const nouvelArbre = await appelGitHub(env, "/git/trees", {
    method: "POST", corps: { base_tree: commit.tree.sha, tree: arbre }
  });
  const nouveauCommit = await appelGitHub(env, "/git/commits", {
    method: "POST",
    corps: { message: changements.message || "Mise à jour du site", tree: nouvelArbre.sha, parents: [shaCommit] }
  });
  await appelGitHub(env, "/git/refs/heads/" + branche, {
    method: "PATCH", corps: { sha: nouveauCommit.sha }
  });
  return nouveauCommit.sha;
}

/* ----------------------------------------------------------------- routes */

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const chemin = url.pathname.replace(/\/+$/, "") || "/";

    if (requete.method === "OPTIONS") return reponse(null, 204, requete, env);

    try {
      /* --- connexion ---------------------------------------------------- */
      if (chemin === "/connexion" && requete.method === "POST") {
        const corps = await requete.json();
        const email = normaliseEmail(corps.email);
        const motDePasse = String(corps.motDePasse || "");
        if (!email || !motDePasse) return erreur("Adresse et mot de passe requis.", 400, requete, env);

        const essais = parseInt(await env.COMPTES.get(cleEssais(email)) || "0", 10);
        if (essais >= ESSAIS_MAX) {
          return erreur("Trop de tentatives. Réessayez dans un quart d'heure.", 429, requete, env);
        }

        const compte = await litCompte(env, email);
        const attendue = compte ? compte.empreinte : "";
        const calculee = await empreinte(motDePasse, compte ? octets(compte.sel) : alea(16));

        if (!compte || !memeChaine(attendue, calculee)) {
          await env.COMPTES.put(cleEssais(email), String(essais + 1), { expirationTtl: FENETRE_ESSAIS });
          return erreur("Adresse ou mot de passe incorrect.", 401, requete, env);
        }

        await env.COMPTES.delete(cleEssais(email));
        const jeton = base64(alea(32)).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
        await env.COMPTES.put(cleSession(jeton), JSON.stringify({ email }), { expirationTtl: DUREE_SESSION });
        return reponse({
          jeton, email, admin: compte.admin, doitChangerMotDePasse: !compte.aChange
        }, 200, requete, env);
      }

      /* --- tout ce qui suit demande une session ------------------------- */
      const session = await sessionDe(requete, env);

      if (chemin === "/moi" && requete.method === "GET") {
        if (!session) return erreur("Session expirée.", 401, requete, env);
        return reponse({
          email: session.compte.email, admin: session.compte.admin,
          doitChangerMotDePasse: !session.compte.aChange
        }, 200, requete, env);
      }

      if (!session) return erreur("Session expirée. Reconnectez-vous.", 401, requete, env);

      if (chemin === "/deconnexion" && requete.method === "POST") {
        await env.COMPTES.delete(cleSession(session.jeton));
        return reponse({ ok: true }, 200, requete, env);
      }

      /* --- son propre mot de passe -------------------------------------- */
      if (chemin === "/motdepasse" && requete.method === "POST") {
        const corps = await requete.json();
        const nouveau = String(corps.nouveau || "");
        if (nouveau.length < 8) return erreur("Le mot de passe doit faire au moins 8 caractères.", 400, requete, env);
        const sel = alea(16);
        const compte = session.compte;
        compte.sel = base64(sel);
        compte.empreinte = await empreinte(nouveau, sel);
        compte.aChange = true;
        await ecritCompte(env, compte);
        return reponse({ ok: true }, 200, requete, env);
      }

      /* --- gestion des comptes (réservée aux administrateurs) ----------- */
      if (chemin === "/utilisateurs") {
        if (!session.compte.admin) return erreur("Vous n'avez pas le droit de gérer les accès.", 403, requete, env);

        if (requete.method === "GET") {
          const liste = await env.COMPTES.list({ prefix: "compte:" });
          const comptes = [];
          for (const c of liste.keys) {
            const compte = await env.COMPTES.get(c.name, "json");
            if (compte) comptes.push({ email: compte.email, admin: compte.admin, cree: compte.cree, aChange: compte.aChange });
          }
          comptes.sort((a, b) => a.email.localeCompare(b.email));
          return reponse({ comptes }, 200, requete, env);
        }

        if (requete.method === "POST") {
          const corps = await requete.json();
          const email = normaliseEmail(corps.email);
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erreur("Adresse électronique invalide.", 400, requete, env);
          const existant = await litCompte(env, email);
          if (existant && !corps.reinitialiser) return erreur("Ce compte existe déjà.", 409, requete, env);
          const motDePasse = existant
            ? await creeCompte(env, email, existant.admin)
            : await creeCompte(env, email, corps.admin);
          return reponse({ email, motDePasse }, 200, requete, env);
        }

        if (requete.method === "DELETE") {
          const email = normaliseEmail(url.searchParams.get("email"));
          if (email === session.compte.email) return erreur("Vous ne pouvez pas retirer votre propre accès.", 400, requete, env);
          const compte = await litCompte(env, email);
          if (!compte) return erreur("Ce compte n'existe pas.", 404, requete, env);
          await env.COMPTES.delete(cleCompte(email));
          return reponse({ ok: true }, 200, requete, env);
        }
      }

      /* --- publication --------------------------------------------------- */
      if (chemin === "/publier" && requete.method === "POST") {
        const changements = await requete.json();
        const sha = await publie(env, {
          message: (changements.message || "Mise à jour du site") + "\n\nPublié par " + session.compte.email + "\n",
          fichiers: changements.fichiers,
          suppressions: changements.suppressions
        });
        return reponse({ ok: true, commit: sha }, 200, requete, env);
      }

      return erreur("Adresse inconnue.", 404, requete, env);
    } catch (e) {
      return erreur(String(e && e.message || e), 500, requete, env);
    }
  }
};
