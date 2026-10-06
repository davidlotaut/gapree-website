/* Serveur d'administration du site de Gâprée.

   Il rend possible ce qu'un site statique ne peut pas faire seul :
   - des comptes nominatifs (adresse électronique + mot de passe) que la mairie
     crée et retire elle-même,
   - une clé d'écriture qui ne quitte jamais ce serveur.

   Rien de personnel n'y est stocké : les comptes de la mairie, leurs sessions,
   30 jours de comptes rendus d'échec (sans adresse), et une clé qui ne sait
   faire qu'une chose, écrire dans le dépôt du site.                          */

const ITERATIONS = 100000;   // maximum accepté par le runtime Cloudflare
const DUREE_SESSION = 12 * 3600;        // secondes
const ESSAIS_MAX = 10;                  // par quart d'heure, par compte et par connexion d'origine
const FENETRE_ESSAIS = 900;

/* Un reportage peut compter cent photos, et tout envoyer d'un coup dépasse la
   mémoire dont dispose ce serveur (128 Mo pour lire la requête ET l'objet qui
   en sort). L'espace d'administration découpe donc l'envoi en paquets ; ce
   plafond refuse proprement un paquet hors norme au lieu de mourir en silence,
   comme le 08/09/2026 où deux publications de 55 photos ont été perdues. */
const LOT_MAX = 24 * 1024 * 1024;

/* GitHub compte cinq points par écriture et n'en accepte que 900 par minute sur
   un même point d'entrée, soit 180 photos par minute au plus. Sans ce rythme,
   un reportage de cent photos se ferait refuser en cours de route, avec un
   message parlant à tort d'une clé devenue invalide. */
const BLOBS_EN_PARALLELE = 3;
const PAUSE_ENTRE_GROUPES = 1200;       // millisecondes, soit 150 photos par minute

function patiente(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/* Désigne un compte sans le nommer : « compte » suivi des 8 premiers
   caractères de l'empreinte SHA-256 de son adresse. Les enregistrements du
   dépôt sont publics : l'adresse de la personne qui publie n'y figure plus,
   elle reste dans le journal du serveur. */
async function libelleCompte(email) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email)));
  return "compte " + Array.from(h.slice(0, 4), (o) => o.toString(16).padStart(2, "0")).join("");
}

/* --------------------------------------------------------------------- KV */

const cleCompte = (email) => "compte:" + email;
const cleSession = (jeton) => "session:" + jeton;
/* Les essais faux se comptent par adresse ET par connexion d'origine : les
   identifiants sont publics, et un compteur par adresse seule laissait
   n'importe qui bloquer un compte pour tout le monde. Un seul compteur, donc
   pas plus d'écritures qu'avant. */
const cleEssais = (email, ip) => "essais:" + email + ":" + ip;

/* Plafond compté chez Cloudflare, sans rien écrire dans le stockage (décision David du 06/10/2026),
   par connexion d'origine seulement : un flot d'essais venu d'un même endroit est arrêté avant de
   toucher au stockage. Pas de plafond par compte : la contre-vérification du 06/10 a montré qu'il
   rouvrait le défaut 51, n'importe qui pouvant alors bloquer la mairie avec son adresse publique.
   Le compteur du stockage garde la règle des dix essais faux par quart d'heure. Sans la liaison
   (tests, ancien déploiement), pas de plafond. */
async function sousLePlafond(env, ip) {
  if (!env.LIMITE_CONNEXIONS) return true;
  return (await env.LIMITE_CONNEXIONS.limit({ key: "ip:" + ip })).success;
}

async function litCompte(env, email) {
  return await env.COMPTES.get(cleCompte(email), "json");
}

async function ecritCompte(env, compte) {
  await env.COMPTES.put(cleCompte(compte.email), JSON.stringify(compte));
}

/* Numéro de version des sessions d'un compte, copié dans chaque session à la
   connexion. Il change avec le mot de passe, à la réinitialisation et à la
   création (au hasard : un compte retiré puis recréé ne ranime aucune
   ancienne session) ; une session qui porte un autre numéro est refusée.
   Les comptes et sessions d'avant cette règle n'en ont pas, et restent
   valables entre eux jusqu'au premier changement. */
const nouvelleVersion = () => base64(alea(9));

async function creeCompte(env, email, admin) {
  const motDePasse = motDePasseGenere();
  const sel = alea(16);
  const compte = {
    email,
    sel: base64(sel),
    empreinte: await empreinte(motDePasse, sel),
    admin: !!admin,
    cree: new Date().toISOString(),
    aChange: false,
    version: nouvelleVersion()
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
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

const erreur = (message, statut, requete, env) => reponse({ erreur: message }, statut, requete, env);

/* Refuser un envoi hors norme AVANT de le lire : passé la mémoire disponible,
   le serveur est arrêté net et la personne ne reçoit aucune explication. */
function tropLourd(requete) {
  return parseInt(requete.headers.get("Content-Length") || "0", 10) > LOT_MAX;
}

/* Erreur dont le statut et les détails partent tels quels vers l'espace. */
function refus(message, statut, details) {
  const e = new Error(message);
  e.statut = statut;
  if (details) Object.assign(e, details);
  return e;
}

/* ---------------------------------------------------------- emplacements */

/* Ce que l'espace d'administration a le droit d'écrire ou de retirer : les
   contenus, les deux réglages, les photos et les documents PDF. Le jeton du
   serveur peut écrire PARTOUT dans le dépôt, code de l'administration et nom
   de domaine compris : sans ce filtre, n'importe quelle session (même volée)
   pouvait réécrire admin/config.js et capter les mots de passe des autres. */
const CONTENUS = /^_(actualites|talents|elus)\/[a-z0-9][a-z0-9-]*\.md$/;
const REGLAGES = /^_data\/(accueil|mairie)\.yml$/;
const PHOTOS = /^assets\/img\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp|gif)$/;
const DOCUMENTS = /^assets\/docs\/[a-z0-9][a-z0-9-]*\.pdf$/;
const ECRITURES_PERMISES = [CONTENUS, REGLAGES, PHOTOS, DOCUMENTS];
const RETRAITS_PERMIS = [CONTENUS, PHOTOS, DOCUMENTS];

const permis = (chemin, liste) => typeof chemin === "string" && liste.some((r) => r.test(chemin));

/* Refuse tout l'envoi, avant le moindre appel à GitHub, dès qu'un seul
   emplacement sort de la liste. */
function verifieEmplacements(fichiers, retraits) {
  for (const f of fichiers) {
    const chemin = f && f.chemin;
    if (!permis(chemin, ECRITURES_PERMISES)) {
      throw refus("Emplacement refusé : " + String(chemin).slice(0, 200) + ". Le site n'accepte que des "
        + "actualités, des talents, des élus, les réglages de l'accueil et de la mairie, des photos "
        + "et des documents PDF.", 403);
    }
  }
  for (const s of retraits) {
    const chemin = s && s.chemin;
    if (!permis(chemin, RETRAITS_PERMIS)) {
      throw refus("Suppression refusée : " + String(chemin).slice(0, 200) + ". Seuls des actualités, des "
        + "talents, des élus, des photos et des documents PDF peuvent être retirés du site.", 403);
    }
  }
}

/* ------------------------------------------------------------- sessions */

async function sessionDe(requete, env) {
  const entete = requete.headers.get("Authorization") || "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : "";
  if (!jeton) return null;
  const session = await env.COMPTES.get(cleSession(jeton), "json");
  if (!session) return null;
  const compte = await litCompte(env, session.email);
  if (!compte || compte.version !== session.version) return null;
  return { jeton, compte, fin: session.fin };
}

/* --------------------------------------------------------------- GitHub */

/* Version de l'API GitHub demandée à chaque appel. GitHub garde une version
   24 mois après la sortie de la suivante, puis répond 410 à tout appel qui la
   demande : 2022-11-28 cesse le 10/03/2028 (docs.github.com, lu le
   05/10/2026). La prochaine version se vérifie sur la page « Breaking
   changes » pour les seuls appels /git/ utilisés ici. */
const VERSION_API = "2026-03-10";

async function appelGitHub(env, chemin, options, secondEssai) {
  const o = options || {};
  const r = await fetch("https://api.github.com/repos/" + env.DEPOT + chemin, {
    method: o.method || "GET",
    headers: {
      Authorization: "Bearer " + env.JETON_GITHUB,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": VERSION_API,
      "Content-Type": "application/json",
      "User-Agent": "gapree-admin"
    },
    body: o.corps ? JSON.stringify(o.corps) : undefined
  });
  if (!r.ok) {
    const detail = await r.text();
    /* Messages compréhensibles par la mairie ; le détail technique reste dans les journaux. */
    console.log("GitHub " + r.status + " : " + detail.slice(0, 300));
    /* Chaque erreur emporte le statut et le détail de GitHub : le contrôle de
       version les lit, et le compte rendu d'échec les garde. */
    const echec = (message) => Object.assign(new Error(message), {
      github: { statut: r.status, detail: detail.slice(0, 300) }
    });
    /* Freinage passager : GitHub demande d'attendre, la clé n'est pas en cause. */
    const attenteDemandee = r.headers.get("retry-after");
    if ((r.status === 403 || r.status === 429)
      && (attenteDemandee || /secondary rate limit|abuse detection/i.test(detail))) {
      if (secondEssai) throw echec("Le site reçoit trop de photos à la fois. Réessayez dans une minute.");
      await patiente(Math.min(parseInt(attenteDemandee || "60", 10), 90) * 1000);
      return await appelGitHub(env, chemin, options, true);
    }
    if (r.status === 401 || r.status === 403) {
      throw echec("La clé d'écriture du site n'est plus valable. Prévenez la personne qui a installé le site.");
    }
    /* Version d'API arrêtée (410) ou demande que GitHub ne comprend plus
       (400) : réessayer n'y changera rien, seul le serveur peut être corrigé. */
    if (r.status === 400 || r.status === 410) {
      throw echec("Le site doit être mis à jour par la personne qui l'a installé (erreur "
        + r.status + " de GitHub). Prévenez-la.");
    }
    if (r.status === 409 || r.status === 422) {
      throw echec("Le site a été modifié entre-temps. Rechargez la page, puis publiez à nouveau.");
    }
    throw echec("Le site n'a pas pu être mis à jour (erreur " + r.status + "). Réessayez dans un instant.");
  }
  return await r.json();
}

/* Dépose des photos dans le dépôt sans rien publier. Elles n'apparaissent
   nulle part tant que l'enregistrement final n'a pas eu lieu : c'est ce qui
   permet d'envoyer un gros reportage en plusieurs fois, puis de tout publier
   d'un seul geste, donc en une seule mise à jour du site. */
async function televerse(env, fichiers) {
  verifieEmplacements(fichiers, []);
  const deposes = [];
  for (let i = 0; i < fichiers.length; i += BLOBS_EN_PARALLELE) {
    const paquet = fichiers.slice(i, i + BLOBS_EN_PARALLELE);
    const debut = Date.now();
    const blobs = await Promise.all(paquet.map((f) => appelGitHub(env, "/git/blobs", {
      method: "POST", corps: { content: f.base64, encoding: "base64" }
    })));
    paquet.forEach((f, j) => {
      /* Une référence vide passerait inaperçue ici et ferait échouer la
         publication entière plus tard, sans rien désigner. */
      if (!blobs[j] || !blobs[j].sha) {
        console.log("dépôt sans référence pour " + f.chemin);
        throw new Error("Une photo n'a pas pu être déposée. Réessayez dans un instant.");
      }
      deposes.push({ chemin: f.chemin, sha: blobs[j].sha });
    });
    const reste = PAUSE_ENTRE_GROUPES - (Date.now() - debut);
    if (i + BLOBS_EN_PARALLELE < fichiers.length && reste > 0) await patiente(reste);
  }
  return deposes;
}

/* ------------------------------------------------- contrôle de version */

/* Chaque entrée peut porter la révision du site (un commit de main) sur
   laquelle l'élément a été ouvert : « base ». Elle part dans une adresse de
   l'API GitHub, d'où un format strict, vérifié avant tout appel. */
const REVISION = /^[0-9a-f]{40}$/;

function verifieBases(entrees) {
  for (const e of entrees) {
    const base = e.base;
    if (base === undefined || base === null || base === "") continue;
    if (typeof base !== "string" || !REVISION.test(base)) {
      throw refus("Version de base illisible pour " + String(e.chemin).slice(0, 200)
        + ". Rechargez la page, puis refaites la modification.", 400);
    }
  }
}

/* Empreinte que Git donne à un contenu (SHA-1 de « blob <taille>\0 » suivi
   des octets) : celle que GitHub calculera en l'écrivant. */
async function empreinteBlob(contenu) {
  const entete = new TextEncoder().encode("blob " + contenu.length + "\0");
  const tout = new Uint8Array(entete.length + contenu.length);
  tout.set(entete);
  tout.set(contenu, entete.length);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-1", tout));
  return Array.from(h, (o) => o.toString(16).padStart(2, "0")).join("");
}

async function empreinteEnvoyee(f) {
  try {
    if (f.sha) return String(f.sha);
    if (f.base64) return await empreinteBlob(octets(f.base64));
    if (typeof f.texte === "string") return await empreinteBlob(new TextEncoder().encode(f.texte));
  } catch (e) { /* contenu illisible : il sera refusé plus loin */ }
  return null;
}

/* Chemin -> empreinte de chaque fichier d'un arbre. */
async function empreintesArbre(env, shaArbre) {
  const arbre = await appelGitHub(env, "/git/trees/" + shaArbre + "?recursive=1");
  return new Map((arbre.tree || []).filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
}

/* Rend les chemins qui ont changé sur main depuis que la personne les a
   ouverts : écrire ou retirer par-dessus effacerait sans le dire le travail
   de quelqu'un d'autre (texte perdu le 05/09/2026). Une entrée sans base ni
   « nouveau » vient d'une page ouverte avant cette règle : aucun contrôle. */
async function chercheConflits(env, ecrits, retraits, shaCommit, surMain) {
  const versions = new Map([[shaCommit, surMain]]);
  async function contenuA(revision) {
    if (!versions.has(revision)) {
      let contenu = null;
      try {
        const c = await appelGitHub(env, "/git/commits/" + revision);
        contenu = await empreintesArbre(env, c.tree.sha);
      } catch (e) {
        /* Révision inconnue de GitHub : rien ne permet de vérifier, l'entrée
           est refusée comme un conflit plutôt qu'écrite à l'aveugle. */
        if (!e.github || (e.github.statut !== 404 && e.github.statut !== 422)) throw e;
        console.log("révision de base introuvable : " + revision);
      }
      versions.set(revision, contenu);
    }
    return versions.get(revision);
  }

  const conflits = [];
  for (const f of ecrits) {
    if (!f.base && f.nouveau !== true) continue;
    const actuel = surMain.get(f.chemin);
    /* main porte déjà exactement ce contenu : réessai d'une publication
       réussie dont la réponse s'est perdue. */
    if (actuel !== undefined && actuel === await empreinteEnvoyee(f)) continue;
    if (f.nouveau === true && actuel !== undefined) {
      conflits.push(f.chemin);
      continue;
    }
    if (f.base) {
      const aLaBase = await contenuA(f.base);
      if (!aLaBase || aLaBase.get(f.chemin) !== actuel) conflits.push(f.chemin);
    }
  }
  for (const s of retraits) {
    if (!s.base) continue;
    const actuel = surMain.get(s.chemin);
    if (actuel === undefined) continue;     // déjà retiré : le résultat voulu
    const aLaBase = await contenuA(s.base);
    if (!aLaBase || aLaBase.get(s.chemin) !== actuel) conflits.push(s.chemin);
  }
  return conflits;
}

/* Écrit tous les changements en un seul enregistrement. */
async function publie(env, changements) {
  const branche = env.BRANCHE || "main";
  const fichiers = Array.isArray(changements.fichiers) ? changements.fichiers : [];
  /* Un retrait s'écrit « chemin » ou { chemin, base }. */
  const retraits = (Array.isArray(changements.suppressions) ? changements.suppressions : [])
    .map((s) => (typeof s === "string" ? { chemin: s } : s));
  if (!fichiers.length && !retraits.length) throw new Error("Rien à publier.");
  verifieEmplacements(fichiers, retraits);
  verifieBases(fichiers.concat(retraits));

  /* Un même fichier cité deux fois fait rejeter l'enregistrement entier :
     le premier fait foi. */
  const ecrits = [];
  const dejaVus = new Set();
  for (const f of fichiers) {
    if (dejaVus.has(f.chemin)) {
      console.log("chemin en double, ignoré : " + f.chemin);
      continue;
    }
    dejaVus.add(f.chemin);
    ecrits.push(f);
  }
  /* Même rejet pour un chemin à la fois écrit et retiré (un élément retiré
     puis recréé sous le même nom) : l'écriture l'emporte, le retrait est
     ignoré. Un retrait cité deux fois ne compte qu'une fois. */
  const retires = [];
  for (const s of retraits) {
    if (dejaVus.has(s.chemin)) {
      if (ecrits.some((f) => f.chemin === s.chemin)) {
        console.log("chemin écrit et retiré dans le même envoi, retrait ignoré : " + s.chemin);
      }
      continue;
    }
    dejaVus.add(s.chemin);
    retires.push(s);
  }

  const ref = await appelGitHub(env, "/git/ref/heads/" + branche);
  const shaCommit = ref.object.sha;
  const commit = await appelGitHub(env, "/git/commits/" + shaCommit);

  /* Ce que porte main, fichier par fichier : sert aux retraits et au contrôle
     de version, lu seulement s'il y en a besoin. */
  const aControler = retires.length || ecrits.some((f) => f.base || f.nouveau === true);
  const surMain = aControler ? await empreintesArbre(env, commit.tree.sha) : null;

  const conflits = await chercheConflits(env, ecrits, retires, shaCommit, surMain);
  if (conflits.length) {
    throw refus("Rien n'a été publié : entre-temps, quelqu'un d'autre a changé " + conflits.join(", ")
      + ". Reprenez ces modifications à partir de la version en ligne.", 409, { conflits });
  }

  const arbre = [];
  for (const f of ecrits) {
    if (f.sha) {
      /* Photo déjà déposée par /televerser : il ne reste qu'à lui donner sa place. */
      arbre.push({ path: f.chemin, mode: "100644", type: "blob", sha: f.sha });
    } else if (f.base64) {
      const blob = await appelGitHub(env, "/git/blobs", {
        method: "POST", corps: { content: f.base64, encoding: "base64" }
      });
      arbre.push({ path: f.chemin, mode: "100644", type: "blob", sha: blob.sha });
    } else if (typeof f.texte === "string") {
      arbre.push({ path: f.chemin, mode: "100644", type: "blob", content: f.texte });
    } else {
      /* Ni référence, ni photo, ni texte. Envoyée telle quelle, cette entrée
         fait refuser TOUT l'enregistrement par GitHub, sans dire laquelle est
         en cause (erreur GitRPC::BadObjectState, rencontrée le 08/09/2026). */
      console.log("entrée inutilisable : " + JSON.stringify(f).slice(0, 200));
      throw new Error("Une photo n'est pas arrivée entière. Appuyez à nouveau sur Publier : "
        + "seules les photos manquantes repartiront.");
    }
  }
  /* Demander la suppression d'un fichier qui n'est plus là fait rejeter
     l'enregistrement ENTIER (GitRPC::BadObjectState), sans dire lequel est en
     cause. C'est ce qui a bloqué la mairie du 08 au 10/09/2026 : un article
     déjà retiré traînait dans les modifications en attente, et plus rien ne
     pouvait être publié. Un fichier déjà absent, c'est le résultat voulu. */
  for (const { chemin } of retires) {
    if (!surMain.has(chemin)) {
      console.log("suppression sans objet, ignorée : " + chemin);
      continue;
    }
    arbre.push({ path: chemin, mode: "100644", type: "blob", sha: null });
  }
  /* Rien ne change réellement (retraits déjà faits, ou fichiers identiques à
     ceux en ligne) : le résultat voulu est atteint. Un refus bloquait la
     mairie à chaque appui ; un enregistrement vide relançait la construction
     du site, quitte à annuler celle de la publication précédente. */
  if (!arbre.length) return { inchange: true };

  const nouvelArbre = await appelGitHub(env, "/git/trees", {
    method: "POST", corps: { base_tree: commit.tree.sha, tree: arbre }
  });
  if (nouvelArbre.sha === commit.tree.sha) return { inchange: true };
  const nouveauCommit = await appelGitHub(env, "/git/commits", {
    method: "POST",
    corps: { message: changements.message || "Mise à jour du site", tree: nouvelArbre.sha, parents: [shaCommit] }
  });
  await appelGitHub(env, "/git/refs/heads/" + branche, {
    method: "PATCH", corps: { sha: nouveauCommit.sha }
  });
  return { commit: nouveauCommit.sha };
}

/* ------------------------------------------------- comptes rendus d'échec */

/* Les journaux de Cloudflare ne gardent que 3 jours sur l'offre gratuite :
   un échec signalé après un week-end ne laissait plus de trace. Chaque échec
   de /publier et de /televerser, et chaque compte rendu d'erreur reçu par
   /journal, est donc aussi gardé 30 jours dans COMPTES (clés « journal:… »,
   lisibles dans le tableau de bord de Cloudflare). Le compte y est désigné
   par son libellé, jamais par son adresse ; le contenu des photos n'y entre
   jamais. Quelques écritures par mois. */
const DUREE_JOURNAL = 30 * 24 * 3600;

async function garde(env, session, quoi) {
  try {
    const quand = new Date().toISOString();
    const entree = Object.assign({ quand, compte: await libelleCompte(session.compte.email) }, quoi);
    await env.COMPTES.put("journal:" + quand + ":" + base64(alea(6)).replace(/[^A-Za-z0-9]/g, ""),
      JSON.stringify(entree), { expirationTtl: DUREE_JOURNAL });
  } catch (e) {
    console.log("compte rendu non gardé : " + String(e && e.message || e));
  }
}

/* Ce qu'un envoi contenait, sans aucun contenu : nombres et emplacements. */
function resumeEnvoi(corps) {
  const liste = (x) => (Array.isArray(x) ? x : []);
  const fichiers = liste(corps && corps.fichiers);
  const retraits = liste(corps && corps.suppressions);
  const nom = (e) => String(e && typeof e === "object" ? e.chemin : e).slice(0, 200);
  return {
    fichiers: fichiers.length,
    avecTexte: fichiers.filter((f) => f && typeof f.texte === "string").length,
    avecReference: fichiers.filter((f) => f && f.sha).length,
    avecPhoto: fichiers.filter((f) => f && f.base64).length,
    chemins: fichiers.slice(0, 30).map(nom),
    retraits: retraits.slice(0, 30).map(nom)
  };
}

/* ----------------------------------------------------------------- routes */

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const chemin = url.pathname.replace(/\/+$/, "") || "/";

    if (requete.method === "OPTIONS") return reponse(null, 204, requete, env);

    let session = null;
    let envoi = null;
    try {
      /* --- connexion ---------------------------------------------------- */
      if (chemin === "/connexion" && requete.method === "POST") {
        const corps = await requete.json();
        const email = normaliseEmail(corps.email);
        const motDePasse = String(corps.motDePasse || "");
        if (!email || !motDePasse) return erreur("Adresse et mot de passe requis.", 400, requete, env);

        const ip = requete.headers.get("CF-Connecting-IP") || "";
        if (!(await sousLePlafond(env, ip))) {
          return erreur("Trop de tentatives. Réessayez dans une minute.", 429, requete, env);
        }
        const essais = parseInt(await env.COMPTES.get(cleEssais(email, ip)) || "0", 10);
        if (essais >= ESSAIS_MAX) {
          return erreur("Trop de tentatives. Réessayez dans un quart d'heure.", 429, requete, env);
        }

        const compte = await litCompte(env, email);
        const attendue = compte ? compte.empreinte : "";
        const calculee = await empreinte(motDePasse, compte ? octets(compte.sel) : alea(16));

        if (!compte || !memeChaine(attendue, calculee)) {
          await env.COMPTES.put(cleEssais(email, ip), String(essais + 1), { expirationTtl: FENETRE_ESSAIS });
          return erreur("Adresse ou mot de passe incorrect.", 401, requete, env);
        }

        await env.COMPTES.delete(cleEssais(email, ip));
        const jeton = base64(alea(32)).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
        const fin = Math.floor(Date.now() / 1000) + DUREE_SESSION;
        await env.COMPTES.put(cleSession(jeton), JSON.stringify({ email, version: compte.version, fin }),
          { expirationTtl: DUREE_SESSION });
        return reponse({
          jeton, email, admin: compte.admin, doitChangerMotDePasse: !compte.aChange
        }, 200, requete, env);
      }

      /* --- tout ce qui suit demande une session ------------------------- */
      session = await sessionDe(requete, env);

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
        compte.version = nouvelleVersion();
        await ecritCompte(env, compte);
        /* Toutes les autres sessions du compte tombent ; celle-ci reste
           ouverte, jusqu'à son échéance d'origine. */
        const maintenant = Math.floor(Date.now() / 1000);
        const fin = session.fin || maintenant + DUREE_SESSION;
        await env.COMPTES.put(cleSession(session.jeton),
          JSON.stringify({ email: compte.email, version: compte.version, fin }),
          { expirationTtl: Math.max(60, fin - maintenant) });
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

        /* Promouvoir ou rétrograder quelqu'un, sans changer son mot de passe. */
        if (requete.method === "PATCH") {
          const corps = await requete.json();
          const email = normaliseEmail(corps.email);
          const compte = await litCompte(env, email);
          if (!compte) return erreur("Ce compte n'existe pas.", 404, requete, env);
          if (email === session.compte.email && !corps.admin) {
            return erreur("Vous ne pouvez pas vous retirer le droit de gérer les accès.", 400, requete, env);
          }
          compte.admin = !!corps.admin;
          await ecritCompte(env, compte);
          return reponse({ email, admin: compte.admin }, 200, requete, env);
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

      /* --- compte rendu d'un échec vécu par la mairie --------------------- */
      if (chemin === "/journal" && requete.method === "POST") {
        /* Quand une publication échoue sur le poste de quelqu'un d'autre, c'est
           la seule façon de savoir ce qui s'est réellement passé : le détail
           technique arrive ici et va dans les journaux, sans jamais afficher
           quoi que ce soit à la personne. */
        const corps = await requete.json().catch(() => ({}));
        console.log("ÉCHEC CHEZ " + session.compte.email + " : " + JSON.stringify(corps).slice(0, 4000));
        /* Le compte rendu de départ, envoyé à chaque publication, porte une
           erreur « null » : seuls les échecs sont gardés. */
        const erreurRecue = corps && typeof corps.erreur === "string" ? corps.erreur : "";
        if (erreurRecue && erreurRecue !== "null" && erreurRecue !== "undefined") {
          await garde(env, session, { route: "/journal", compteRendu: JSON.stringify(corps).slice(0, 4000) });
        }
        return reponse({ ok: true }, 200, requete, env);
      }

      /* --- dépôt des photos, avant publication --------------------------- */
      if (chemin === "/televerser" && requete.method === "POST") {
        if (tropLourd(requete)) {
          throw refus("Ce paquet de photos est trop lourd pour être envoyé en une fois.", 413);
        }
        const corps = await requete.json();
        envoi = resumeEnvoi(corps);
        const fichiers = corps.fichiers || [];
        if (!fichiers.length) throw refus("Aucune photo à déposer.", 400);
        return reponse({ fichiers: await televerse(env, fichiers) }, 200, requete, env);
      }

      /* --- publication --------------------------------------------------- */
      if (chemin === "/publier" && requete.method === "POST") {
        if (tropLourd(requete)) {
          throw refus("Cet envoi est trop lourd pour être publié en une fois.", 413);
        }
        const changements = await requete.json();
        envoi = resumeEnvoi(changements);
        const qui = await libelleCompte(session.compte.email);
        console.log("publication demandée par " + session.compte.email + " (" + qui + ")");
        const resultat = await publie(env, {
          message: (changements.message || "Mise à jour du site") + "\n\nPublié par " + qui + "\n",
          fichiers: changements.fichiers,
          suppressions: changements.suppressions
        });
        return reponse(resultat.inchange ? { ok: true, inchange: true } : { ok: true, commit: resultat.commit },
          200, requete, env);
      }

      return erreur("Adresse inconnue.", 404, requete, env);
    } catch (e) {
      const statut = (e && e.statut) || 500;
      const donnees = { erreur: String(e && e.message || e) };
      if (e && Array.isArray(e.conflits)) donnees.conflits = e.conflits;
      if (session && (chemin === "/publier" || chemin === "/televerser")) {
        await garde(env, session, {
          route: chemin, statut, erreur: donnees.erreur, conflits: donnees.conflits,
          github: (e && e.github) || null, envoi
        });
      }
      return reponse(donnees, statut, requete, env);
    }
  }
};
