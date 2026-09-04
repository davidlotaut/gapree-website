/* Lien entre l'espace d'administration et le serveur de la mairie.

   Sans serveur configuré (config.js vide), l'espace reste en démonstration :
   on peut tout essayer, rien n'est publié.

   Avec un serveur, chaque personne a son adresse électronique et son mot de
   passe. La clé qui autorise à écrire sur le site ne descend jamais dans le
   navigateur : elle reste sur le serveur.                                    */

(function () {
  "use strict";

  var CLE_JETON = "gapree-session";
  var jeton = null;
  var moi = null;

  function serveur() {
    return (window.GAPREE_SERVEUR || "").replace(/\/+$/, "");
  }

  function estArme() { return serveur().length > 0; }
  function estConnecte() { return jeton !== null && moi !== null; }
  function utilisateur() { return moi; }

  function appel(chemin, options) {
    var o = options || {};
    var entetes = { "Content-Type": "application/json" };
    if (jeton) entetes.Authorization = "Bearer " + jeton;
    return fetch(serveur() + chemin, {
      method: o.method || "GET",
      headers: entetes,
      body: o.corps ? JSON.stringify(o.corps) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (donnees) {
        if (!r.ok) {
          if (r.status === 401 && jeton) oublie();
          throw new Error(donnees.erreur || "Le serveur n'a pas répondu correctement.");
        }
        return donnees;
      });
    }, function () {
      throw new Error("Le serveur est injoignable. Vérifiez la connexion internet.");
    });
  }

  function memorise(nouveauJeton) {
    jeton = nouveauJeton;
    try { localStorage.setItem(CLE_JETON, nouveauJeton); } catch (e) { /* navigation privée */ }
  }

  function oublie() {
    jeton = null;
    moi = null;
    try { localStorage.removeItem(CLE_JETON); } catch (e) { /* rien à faire */ }
  }

  /* Reprend la session laissée ouverte sur ce navigateur, si elle vit encore. */
  function reprendSession() {
    var garde = null;
    try { garde = localStorage.getItem(CLE_JETON); } catch (e) { garde = null; }
    if (!garde) return Promise.resolve(false);
    jeton = garde;
    return appel("/moi").then(function (info) {
      moi = info;
      return true;
    }).catch(function () {
      oublie();
      return false;
    });
  }

  function connecte(email, motDePasse) {
    return appel("/connexion", { method: "POST", corps: { email: email, motDePasse: motDePasse } })
      .then(function (r) {
        memorise(r.jeton);
        moi = { email: r.email, admin: r.admin, doitChangerMotDePasse: r.doitChangerMotDePasse };
        return moi;
      });
  }

  function deconnecte() {
    return appel("/deconnexion", { method: "POST" }).catch(function () { /* la session part quand même */ })
      .then(oublie);
  }

  function changeMotDePasse(nouveau) {
    return appel("/motdepasse", { method: "POST", corps: { nouveau: nouveau } })
      .then(function () { if (moi) moi.doitChangerMotDePasse = false; });
  }

  function listeUtilisateurs() {
    return appel("/utilisateurs").then(function (r) { return r.comptes || []; });
  }

  function ajouteUtilisateur(email, admin) {
    return appel("/utilisateurs", { method: "POST", corps: { email: email, admin: !!admin } });
  }

  function reinitialiseUtilisateur(email) {
    return appel("/utilisateurs", { method: "POST", corps: { email: email, reinitialiser: true } });
  }

  function changeDroits(email, admin) {
    return appel("/utilisateurs", { method: "PATCH", corps: { email: email, admin: !!admin } });
  }

  function retireUtilisateur(email) {
    return appel("/utilisateurs?email=" + encodeURIComponent(email), { method: "DELETE" });
  }

  function publie(changements) {
    return appel("/publier", {
      method: "POST",
      corps: {
        message: changements.message,
        fichiers: changements.fichiers,
        suppressions: changements.suppressions
      }
    });
  }

  window.GapreePublication = {
    estArme: estArme,
    estConnecte: estConnecte,
    utilisateur: utilisateur,
    reprendSession: reprendSession,
    connecte: connecte,
    deconnecte: deconnecte,
    changeMotDePasse: changeMotDePasse,
    listeUtilisateurs: listeUtilisateurs,
    ajouteUtilisateur: ajouteUtilisateur,
    reinitialiseUtilisateur: reinitialiseUtilisateur,
    changeDroits: changeDroits,
    retireUtilisateur: retireUtilisateur,
    publie: publie
  };
})();
