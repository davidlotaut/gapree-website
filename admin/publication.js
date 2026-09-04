/* Publication réelle du site depuis l'espace d'administration.

   Le mot de passe saisi par la mairie déchiffre un jeton d'écriture embarqué
   (AES-256-GCM, clé dérivée par PBKDF2-SHA256, miroir exact de
   scripts/chiffre_jeton.py). Les modifications sont ensuite écrites dans le
   dépôt en UN SEUL enregistrement, ce qui ne déclenche qu'une reconstruction
   du site.

   Tant que jeton.js ne contient aucun jeton, l'espace reste en mode
   démonstration : rien ici n'est activé. */

(function () {
  "use strict";

  var DEPOT = "davidlotaut/gapree-website";
  var BRANCHE = "main";
  var API = "https://api.github.com";
  var ITERATIONS = 310000;

  var jeton = null;

  /* ------------------------------------------------------------ chiffrement */

  function base64Vers(octets) {
    var brut = atob(String(octets).replace(/\s+/g, ""));
    var out = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
    return out;
  }

  function blobChiffre() {
    return (window.GAPREE_JETON_CHIFFRE || "").trim();
  }

  /* Un blob présent signifie que la publication réelle est installée. */
  function estArme() { return blobChiffre().length > 0; }
  function estConnecte() { return jeton !== null; }

  function deverrouille(motDePasse) {
    var mdp = String(motDePasse || "").trim().toLowerCase();
    if (!mdp) return Promise.reject(new Error("mot de passe vide"));
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error("navigateur trop ancien"));
    }
    var brut;
    try {
      brut = base64Vers(blobChiffre());
    } catch (e) {
      return Promise.reject(new Error("jeton illisible"));
    }
    if (brut.length < 45) return Promise.reject(new Error("jeton illisible"));

    var sel = brut.slice(0, 16);
    var iv = brut.slice(16, 28);
    var charge = brut.slice(28);

    return window.crypto.subtle
      .importKey("raw", new TextEncoder().encode(mdp), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: sel, iterations: ITERATIONS, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      })
      .then(function (cle) {
        return window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cle, charge);
      })
      .then(function (clair) {
        jeton = new TextDecoder().decode(clair).trim();
        return true;
      });
  }

  function oublie() { jeton = null; }

  /* ------------------------------------------------------------------- API */

  function appel(chemin, options) {
    var o = options || {};
    return fetch(API + "/repos/" + DEPOT + chemin, {
      method: o.method || "GET",
      headers: {
        Authorization: "Bearer " + jeton,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: o.corps ? JSON.stringify(o.corps) : undefined
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var message = "Erreur " + r.status;
          if (r.status === 401 || r.status === 403) message = "Accès refusé : le mot de passe ou l'autorisation d'écriture n'est plus valable.";
          else if (r.status === 409 || r.status === 422) message = "Le site a été modifié entre-temps. Rechargez la page, puis publiez à nouveau.";
          var e = new Error(message);
          e.detail = t;
          throw e;
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }

  /* Vérifie que le jeton ouvre bien le dépôt en écriture. */
  function verifieAcces() {
    return appel("").then(function (info) {
      if (!info.permissions || !info.permissions.push) {
        throw new Error("Ce mot de passe n'autorise pas la publication.");
      }
      return true;
    });
  }

  /* --------------------------------------------------------------- écriture

     changements = {
       message: "…",
       fichiers: [ { chemin: "_actualites/x.md", texte: "…" },
                   { chemin: "assets/img/x.jpg", base64: "…" } ],
       suppressions: [ "_actualites/y.md" ]
     }                                                                      */

  function publie(changements) {
    if (!jeton) return Promise.reject(new Error("Publication non déverrouillée."));
    var fichiers = changements.fichiers || [];
    var suppressions = changements.suppressions || [];
    if (!fichiers.length && !suppressions.length) {
      return Promise.reject(new Error("Rien à publier."));
    }

    var shaCommit = null;
    var shaArbre = null;

    return appel("/git/ref/heads/" + BRANCHE)
      .then(function (ref) {
        shaCommit = ref.object.sha;
        return appel("/git/commits/" + shaCommit);
      })
      .then(function (commit) {
        shaArbre = commit.tree.sha;
        /* Les fichiers binaires passent par un blob base64 ; le texte part directement. */
        var binaires = fichiers.filter(function (f) { return f.base64; });
        return sequence(binaires.map(function (f) {
          return function () {
            return appel("/git/blobs", { method: "POST", corps: { content: f.base64, encoding: "base64" } })
              .then(function (blob) { f.sha = blob.sha; });
          };
        }));
      })
      .then(function () {
        var arbre = fichiers.map(function (f) {
          var entree = { path: f.chemin, mode: "100644", type: "blob" };
          if (f.sha) entree.sha = f.sha; else entree.content = f.texte;
          return entree;
        }).concat(suppressions.map(function (chemin) {
          return { path: chemin, mode: "100644", type: "blob", sha: null };
        }));
        return appel("/git/trees", { method: "POST", corps: { base_tree: shaArbre, tree: arbre } });
      })
      .then(function (arbre) {
        return appel("/git/commits", {
          method: "POST",
          corps: {
            message: changements.message || "Mise à jour du site depuis l'espace d'administration",
            tree: arbre.sha,
            parents: [shaCommit]
          }
        });
      })
      .then(function (commit) {
        return appel("/git/refs/heads/" + BRANCHE, { method: "PATCH", corps: { sha: commit.sha } });
      });
  }

  /* Enchaîne des promesses une par une (les appels d'écriture n'aiment pas le parallèle). */
  function sequence(taches) {
    return taches.reduce(function (chaine, tache) {
      return chaine.then(tache);
    }, Promise.resolve());
  }

  window.GapreePublication = {
    estArme: estArme,
    estConnecte: estConnecte,
    deverrouille: deverrouille,
    verifieAcces: verifieAcces,
    oublie: oublie,
    publie: publie,
    depot: DEPOT
  };
})();
