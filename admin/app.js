/* Espace d'administration Gâprée : version de démonstration.
   Le contenu réel du site est chargé depuis /admin/contenu.json (généré par Jekyll)
   et le texte des articles depuis les fichiers source du dépôt public.
   Les modifications sont enregistrées dans le navigateur (localStorage) pour
   tester l'interface ; la publication réelle sera branchée à la mise en service. */

(function () {
  "use strict";

  var VERSION = "2026-10-05-a";
  var DEPOT_RAW = "https://raw.githubusercontent.com/davidlotaut/gapree-website/";
  var CLE_DEMO = "gapree-demo-admin";

  var app = document.getElementById("app");
  var donnees = null;
  var vue = { type: "liste", rubrique: "actualites" };

  /* ------------------------------------------------------------------ outils */

  function echap(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function surcoucheVide() {
    return { modifies: {}, nouveaux: { actualites: [], talents: [], elus: [] },
      supprimes: [], reglages: {}, deposees: {}, publiees: {}, bases: {} };
  }

  function rangeSurcouche(brut) {
    if (!brut) return surcoucheVide();
    return {
      modifies: brut.modifies || {},
      nouveaux: brut.nouveaux || { actualites: [], talents: [], elus: [] },
      supprimes: brut.supprimes || [],
      reglages: brut.reglages || {},
      deposees: brut.deposees || {},
      publiees: brut.publiees || {},
      bases: brut.bases || {}
    };
  }

  /* Le brouillon vit dans la base du navigateur, et non plus dans sa petite
     réserve de 5 Mo : celle-ci débordait dès la deuxième photo, et le débordement
     était muet, si bien que le travail semblait enregistré alors qu'il était
     perdu (constaté le 08/09/2026). La réserve reste le filet de secours quand
     la base n'est pas disponible, en navigation privée par exemple. */
  var BASE = "gapree-admin";
  var MAGASIN = "brouillon";

  function ouvreBase() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("pas de base"));
      var demande = indexedDB.open(BASE, 1);
      demande.onupgradeneeded = function () { demande.result.createObjectStore(MAGASIN); };
      demande.onsuccess = function () { resolve(demande.result); };
      demande.onerror = function () { reject(demande.error || new Error("base inaccessible")); };
    });
  }

  function dansLaBase(mode, action) {
    return ouvreBase().then(function (base) {
      return new Promise(function (resolve, reject) {
        var t = base.transaction(MAGASIN, mode);
        var demande = action(t.objectStore(MAGASIN));
        t.oncomplete = function () { base.close(); resolve(demande ? demande.result : undefined); };
        t.onerror = t.onabort = function () { base.close(); reject(t.error || new Error("écriture refusée")); };
      });
    });
  }

  function litReserve() {
    try { return JSON.parse(localStorage.getItem(CLE_DEMO) || "null"); } catch (e) { return null; }
  }

  /* Un seul brouillon par navigateur, que plusieurs onglets peuvent écrire.
     Chaque écriture relit donc le brouillon gardé et n'y applique que les
     gestes faits dans cette page depuis sa dernière lecture : réécrit en
     entier, il effaçait ce qu'un autre onglet venait d'enregistrer (revue du
     05/10/2026). Pour comparer, le brouillon est vu « à plat », une clé par
     entrée : m:chemin (modification), n:rubrique:repère (nouveau),
     s:chemin (suppression), r:nom (réglages), d:repère (photo déposée),
     p:commit (publication pas encore en ligne), b:chemin (révision sur
     laquelle l'élément a été ouvert, envoyée comme base : contrat 2).        */
  var RUBRIQUES = ["actualites", "talents", "elus"];

  function aplatit(s) {
    var plat = {};
    Object.keys(s.modifies || {}).forEach(function (c) { plat["m:" + c] = s.modifies[c]; });
    RUBRIQUES.forEach(function (r) {
      ((s.nouveaux || {})[r] || []).forEach(function (x) { plat["n:" + r + ":" + x.chemin] = x; });
    });
    (s.supprimes || []).forEach(function (c) { plat["s:" + c] = true; });
    Object.keys(s.reglages || {}).forEach(function (n) { plat["r:" + n] = s.reglages[n]; });
    Object.keys(s.deposees || {}).forEach(function (k) { plat["d:" + k] = s.deposees[k]; });
    Object.keys(s.publiees || {}).forEach(function (k) { plat["p:" + k] = s.publiees[k]; });
    Object.keys(s.bases || {}).forEach(function (c) { plat["b:" + c] = s.bases[c]; });
    return plat;
  }

  function reconstruit(plat) {
    var s = surcoucheVide();
    Object.keys(plat).forEach(function (cle) {
      var i = cle.indexOf(":"), type = cle.slice(0, i), reste = cle.slice(i + 1), v = plat[cle];
      if (type === "m") s.modifies[reste] = v;
      else if (type === "s") s.supprimes.push(reste);
      else if (type === "r") s.reglages[reste] = v;
      else if (type === "d") s.deposees[reste] = v;
      else if (type === "p") s.publiees[reste] = v;
      else if (type === "b") s.bases[reste] = v;
      else if (type === "n") {
        var r = reste.slice(0, reste.indexOf(":"));
        if (s.nouveaux[r]) s.nouveaux[r].push(v);
      }
    });
    /* Une base n'a de sens qu'avec son entrée : retirée avec elle. */
    Object.keys(s.bases).forEach(function (c) { if (!aUneEntree(s, c)) delete s.bases[c]; });
    return s;
  }

  function cheminReglage(nom) { return "_data/" + nom + ".yml"; }

  function aUneEntree(s, chemin) {
    if (s.modifies[chemin] || s.supprimes.indexOf(chemin) !== -1) return true;
    var m = /^_data\/(.+)\.yml$/.exec(chemin);
    return !!(m && s.reglages[m[1]]);
  }

  /* Copie de la structure ; les textes, et les photos qu'ils portent, ne sont
     pas dupliqués. */
  function copie(v) {
    if (Array.isArray(v)) return v.map(copie);
    if (v && typeof v === "object") {
      var c = {};
      Object.keys(v).forEach(function (k) { c[k] = copie(v[k]); });
      return c;
    }
    return v;
  }

  function pareil(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && pareil(a[k], b[k]); });
  }

  /* Les gestes qui mènent de « avant » à « apres », en opérations sur les clés. */
  function differences(avant, apres) {
    var a = aplatit(avant), b = aplatit(apres), operations = [];
    Object.keys(b).forEach(function (cle) {
      if (!Object.prototype.hasOwnProperty.call(a, cle) || !pareil(a[cle], b[cle])) operations.push({ cle: cle, valeur: b[cle] });
    });
    Object.keys(a).forEach(function (cle) {
      if (!Object.prototype.hasOwnProperty.call(b, cle)) operations.push({ cle: cle, retire: true });
    });
    return operations;
  }

  /* Une opération qui porte « si » ne s'applique que si l'entrée gardée vaut
     encore cette valeur : c'est ce qui laisse en place une entrée changée
     entre-temps par un autre onglet. */
  function applique(plat, operations) {
    operations.forEach(function (op) {
      if (Object.prototype.hasOwnProperty.call(op, "si") && !pareil(plat[op.cle], op.si)) return;
      if (op.retire) delete plat[op.cle];
      else plat[op.cle] = op.valeur;
    });
    return plat;
  }

  function chargeSurcouche() {
    return dansLaBase("readonly", function (magasin) { return magasin.get("etat"); })
      .then(function (enregistre) {
        /* Un brouillon commencé avant ce changement est repris, puis la réserve
           est libérée : il n'y a aucune raison de le perdre. La base est encore
           vide : la première écriture y reportera tout. */
        var ancien = litReserve();
        if (!enregistre && ancien) {
          try { localStorage.removeItem(CLE_DEMO); } catch (e) { /* tant pis */ }
          surcoucheLue = surcoucheVide();
          return rangeSurcouche(ancien);
        }
        var s = rangeSurcouche(enregistre);
        surcoucheLue = copie(s);
        return s;
      })
      .catch(function () {
        var s = rangeSurcouche(litReserve());
        surcoucheLue = copie(s);
        return s;
      });
  }

  /* Relit le brouillon gardé et lui applique les opérations, en une seule
     transaction : un autre onglet ne peut pas écrire entre la lecture et
     l'écriture. Rend le brouillon tel qu'il est désormais gardé. */
  function relitEtApplique(operations) {
    var garde = null;
    return dansLaBase("readwrite", function (magasin) {
      var lecture = magasin.get("etat");
      lecture.onsuccess = function () {
        garde = reconstruit(applique(aplatit(rangeSurcouche(lecture.result)), operations));
        magasin.put(garde, "etat");
      };
      return lecture;
    }).then(function () { return garde; }, function () {
      /* Sans base, on retombe sur la réserve : elle suffit au texte, pas aux
         photos, donc on le dit au lieu d'échouer sans un mot. */
      try {
        garde = reconstruit(applique(aplatit(rangeSurcouche(litReserve())), operations));
        localStorage.setItem(CLE_DEMO, JSON.stringify(garde));
        return garde;
      } catch (e) {
        toast("Ce navigateur ne peut pas garder un brouillon aussi lourd : publiez sans fermer la page");
        return null;
      }
    });
  }

  var surcouche = surcoucheVide();
  var surcoucheLue = surcoucheVide();   // le brouillon tel que cette page l'a lu ou écrit en dernier
  var fileEcritures = Promise.resolve();
  var ecrituresEnCours = 0;

  /* Les écritures d'une page partent l'une après l'autre. Quand la dernière
     est faite, la page reprend le brouillon gardé, avec ce que les autres
     onglets y ont ajouté. */
  function enregistre(operations) {
    if (!operations.length) return fileEcritures;
    ecrituresEnCours++;
    fileEcritures = fileEcritures.then(function () {
      return relitEtApplique(operations);
    }).then(function (garde) {
      ecrituresEnCours--;
      if (!ecrituresEnCours && garde) adopte(garde);
    });
    return fileEcritures;
  }

  function adopte(garde) {
    var avant = nombreEnAttente();
    surcouche = garde;
    surcoucheLue = copie(garde);
    if (nombreEnAttente() !== avant) majBarrePublication();
    suisLaMiseEnLigne();
  }

  /* Révision sur laquelle chaque élément a été ouvert dans cette page. */
  var baseOuverte = {};

  /* Chaque modification ou suppression du brouillon garde la révision en
     vigueur quand l'élément a été ouvert (contrat 2) : le serveur refusera de
     l'écrire si quelqu'un d'autre a changé le fichier depuis. */
  function tientLesBases(s) {
    s.bases = s.bases || {};
    var vivantes = Object.keys(s.modifies).concat(s.supprimes, Object.keys(s.reglages).map(cheminReglage));
    vivantes.forEach(function (c) { if (!s.bases[c] && baseOuverte[c]) s.bases[c] = baseOuverte[c]; });
    Object.keys(s.bases).forEach(function (c) { if (!aUneEntree(s, c)) delete s.bases[c]; });
  }

  /* Écrit les gestes faits sur le brouillon de la page depuis sa dernière écriture. */
  function ecritSurcouche(s) {
    tientLesBases(s);
    var operations = differences(surcoucheLue, s);
    surcoucheLue = copie(s);
    return enregistre(operations);
  }

  /* Applique des opérations ici (brouillon de la page et dernière lecture),
     puis au brouillon gardé. */
  function appliqueIci(operations) {
    surcouche = reconstruit(applique(aplatit(surcouche), operations));
    surcoucheLue = reconstruit(applique(aplatit(surcoucheLue), operations));
    return enregistre(operations);
  }

  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  function dateFr(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    var j = parseInt(p[2], 10);
    return (j === 1 ? "1er" : j) + " " + (MOIS[parseInt(p[1], 10) - 1] || "") + " " + p[0];
  }

  /* Une photo enregistrée est soit une image choisie dans l'éditeur (data:),
     soit un fichier du site (/assets/…). Toute autre valeur est écartée : du
     08/09 au 05/10/2026, les portraits et la photo d'accueil partaient en
     « [object Object] », et un brouillon peut encore porter l'objet fautif. */
  function photoValide(v) {
    if (v && typeof v === "object") v = v.src;
    return typeof v === "string" && (v.indexOf("data:") === 0 || v.charAt(0) === "/") ? v : null;
  }

  function urlImage(chemin) {
    chemin = photoValide(chemin);
    if (!chemin) return "";
    if (chemin.indexOf("data:") === 0) return chemin;
    return ".." + chemin;
  }

  /* Rendu simplifié du texte (paragraphes, gras, italique, liens, sous-titres, listes) */
  function rendMarkdown(texte) {
    var blocs = String(texte || "").replace(/\r/g, "").split(/\n{2,}/);
    return blocs.map(function (bloc) {
      var b = bloc.trim();
      if (!b) return "";
      if (/^##\s+/.test(b)) return "<h2>" + enLigne(b.replace(/^##\s+/, "")) + "</h2>";
      var lignes = b.split("\n");
      var estListe = lignes.every(function (l) { return /^[-*]\s+/.test(l.trim()); });
      if (estListe) {
        return "<ul>" + lignes.map(function (l) {
          return "<li>" + enLigne(l.trim().replace(/^[-*]\s+/, "")) + "</li>";
        }).join("") + "</ul>";
      }
      return "<p>" + lignes.map(enLigne).join("<br>") + "</p>";
    }).join("");

    function enLigne(t) {
      var h = echap(t);
      h = h.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, function (_, txt, url) {
        if (/^https?:\/\//.test(url) || /^mailto:/.test(url)) {
          return '<a href="' + echap(url) + '">' + txt + "</a>";
        }
        return txt;
      });
      h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      h = h.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
      return h;
    }
  }

  /* Une photo d'appareil pèse 3 à 10 Mo, alors que le site n'en montre jamais
     plus de 620 points de large, soit 1240 sur un écran fin. Elle est donc
     ramenée à la taille d'un écran avant de partir. Mesuré le 08/09/2026 :
     une photo de 15 millions de points passe de 2,8 Mo à 500 Ko sans
     différence visible, et un reportage de 55 photos tient en 27 Mo au lieu
     de 165. Sans cette réduction, un tel reportage ne peut pas être publié du
     tout : il dépasse la mémoire du serveur comme la place réservée aux
     brouillons. */
  var COTE_MAX = 1800;
  var QUALITE = 0.85;
  var COTE_VIGNETTE = 240;     // aperçu dans l'éditeur, jamais envoyé
  var TAILLE_PHOTO_MAX = 60 * 1024 * 1024;

  function dessine(image, coteMax, qualite) {
    var reduction = Math.min(1, coteMax / Math.max(image.width, image.height));
    var largeur = Math.round(image.width * reduction);
    var hauteur = Math.round(image.height * reduction);
    var toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    var ctx = toile.getContext("2d");
    /* Un fond blanc : sans lui, une image transparente ressortirait noire. */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    return toile.toDataURL("image/jpeg", qualite);
  }

  /* Décodage par createImageBitmap quand il existe : il tient l'orientation de
     l'appareil et libère la mémoire tout de suite, ce qui compte sur cent
     photos d'affilée. Sinon, décodage classique. */
  function ouvreImage(fichier) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(fichier, { imageOrientation: "from-image" })
        .catch(function () { return ouvreImageClassique(fichier); });
    }
    return ouvreImageClassique(fichier);
  }

  function ouvreImageClassique(fichier) {
    return new Promise(function (resolve, reject) {
      var adresse = URL.createObjectURL(fichier);
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () {
        URL.revokeObjectURL(adresse);
        reject(new Error("lecture impossible"));
      };
      image.src = adresse;
    });
  }

  function litPhoto(fichier) {
    return ouvreImage(fichier).then(function (image) {
      var reduite = { src: dessine(image, COTE_MAX, QUALITE), vignette: dessine(image, COTE_VIGNETTE, 0.7) };
      if (image.close) image.close();
      if (image.src && image.src.indexOf("blob:") === 0) URL.revokeObjectURL(image.src);
      return reduite;
    });
  }

  /* Jauge d'attente : appeler avec un texte et une part faite, puis sans rien
     pour la faire disparaître. */
  function progression(texte, fait, total) {
    var bloc = document.getElementById("progression");
    if (!texte) { bloc.hidden = true; return; }
    bloc.hidden = false;
    document.getElementById("progression-texte").textContent = texte;
    var part = total > 0 ? Math.round((fait / total) * 100) : 0;
    document.getElementById("progression-jauge").style.width = part + "%";
  }

  /* Laisse le navigateur redessiner entre deux photos : sans cette respiration,
     la page se fige et la jauge n'avance qu'à la fin. */
  function respire() {
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  /* Enchaîne un traitement lent sur une liste, en tenant la jauge à jour. */
  function unParUn(liste, texte, traite) {
    var resultats = [];
    return liste.reduce(function (file, element, i) {
      return file.then(function () {
        progression(texte(i + 1, liste.length), i, liste.length);
        return respire().then(function () { return traite(element, i); });
      }).then(function (r) { resultats.push(r); });
    }, Promise.resolve()).then(function () {
      progression(null);
      return resultats;
    }, function (e) {
      progression(null);
      throw e;
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function separeFrontMatter(brut) {
    var m = String(brut).match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return (m ? brut.slice(m[0].length) : brut).trim();
  }

  /* Le texte se lit à la révision exacte qu'a construite contenu.json : cette
     adresse ne change jamais, alors que lu sur main, il pouvait être resservi
     périmé par un cache, et la retouche suivante remettait l'ancien texte en
     ligne (constaté le 05/09/2026). Sur main seulement si la révision manque. */
  var cacheTextes = {};
  function chargeTexte(item) {
    if (typeof item.texte === "string") return Promise.resolve(item.texte);
    var adresse = DEPOT_RAW + ((donnees && donnees.revision) || "main") + "/" + item.chemin;
    if (cacheTextes[adresse] !== undefined) return Promise.resolve(cacheTextes[adresse]);
    return fetch(adresse)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (brut) {
        var texte = separeFrontMatter(brut);
        cacheTextes[adresse] = texte;
        return texte;
      });
  }

  /* --------------------------------------------------------- fusion du contenu */

  function estSupprime(chemin) { return surcouche.supprimes.indexOf(chemin) !== -1; }

  /* Les publications faites depuis ce navigateur et pas encore en ligne, de
     la plus ancienne à la plus récente. */
  function publicationsEnAttente() {
    var p = surcouche.publiees || {};
    return Object.keys(p).map(function (c) { return p[c]; })
      .sort(function (a, b) { return (a.quand || 0) - (b.quand || 0); });
  }

  function rubriqueDe(chemin) {
    var m = /^_(actualites|talents|elus)\//.exec(chemin);
    return m ? m[1] : null;
  }

  /* Le contenu tel qu'il est publié : contenu.json, et par-dessus ce que ce
     navigateur a publié et que le site ne montre pas encore. Sans cela,
     l'éditeur rouvrait l'état d'avant la publication, et la retouche suivante
     le remettait en ligne (revue du 05/10/2026). */
  function elementsPublies(rubrique) {
    var liste = (donnees[rubrique] || []).slice();
    publicationsEnAttente().forEach(function (p) {
      var elements = p.elements || {};
      liste = liste.filter(function (x) {
        return !elements[x.chemin] && (p.supprimes || []).indexOf(x.chemin) === -1;
      });
      Object.keys(elements).forEach(function (chemin) {
        if (rubriqueDe(chemin) === rubrique) liste.push(Object.assign({}, elements[chemin], { chemin: chemin }));
      });
    });
    return liste;
  }

  function existe(chemin) {
    var r = rubriqueDe(chemin);
    return !r || elementsPublies(r).some(function (x) { return x.chemin === chemin; });
  }

  /* Chemins que le serveur a refusé d'écrire à la dernière publication : le
     fichier avait changé depuis l'ouverture de l'élément (contrat 2). */
  var conflitsSignales = [];

  /* Entrées du brouillon qui ne peuvent pas partir : elles visent un fichier
     qui n'est plus sur le site (supprimé par une autre personne), ou que le
     serveur a refusé d'écrire. Publiées, les premières recréaient l'article
     supprimé (revue du 05/10/2026), les secondes faisaient refuser toute la
     publication. Elles sont signalées, ne partent plus, et se retirent une à
     une. */
  function entreesBloquees() {
    if (!donnees) return [];
    var liste = [];
    var change = " a été changé par quelqu'un d'autre depuis que vous l'avez ouvert : ";
    Object.keys(surcouche.modifies).forEach(function (c) {
      if (estSupprime(c)) return;
      var v = surcouche.modifies[c], nom = "« " + (v.titre || v.nom || c.split("/").pop()) + " »";
      if (!existe(c)) liste.push({ cle: "m:" + c, chemin: c, texte: nom + " a été supprimé du site entre-temps : votre modification ne sera pas publiée." });
      else if (conflitsSignales.indexOf(c) !== -1) liste.push({ cle: "m:" + c, chemin: c, texte: nom + change + "votre version ne sera pas publiée." });
    });
    surcouche.supprimes.forEach(function (c) {
      var nom = "« " + c.split("/").pop() + " »";
      if (!existe(c)) liste.push({ cle: "s:" + c, chemin: c, texte: nom + " n'est déjà plus sur le site : sa suppression n'a plus d'objet." });
      else if (conflitsSignales.indexOf(c) !== -1) liste.push({ cle: "s:" + c, chemin: c, texte: nom + change + "sa suppression ne sera pas publiée." });
    });
    Object.keys(surcouche.reglages).forEach(function (n) {
      var c = cheminReglage(n);
      if (conflitsSignales.indexOf(c) !== -1) {
        liste.push({ cle: "r:" + n, chemin: c, texte: "« " + (n === "accueil" ? "Page d'accueil" : "Coordonnées de la mairie") + " »" + change + "votre version ne sera pas publiée." });
      }
    });
    return liste;
  }

  function clesBloquees() {
    var cles = {};
    entreesBloquees().forEach(function (e) { cles[e.cle] = true; });
    return cles;
  }

  function reglagesPublies(nom) {
    var r = Object.assign({}, donnees.reglages[nom] || {});
    publicationsEnAttente().forEach(function (p) {
      if (p.reglages && p.reglages[nom]) Object.assign(r, p.reglages[nom]);
    });
    return r;
  }

  function listeFusionnee(rubrique) {
    var base = elementsPublies(rubrique).filter(function (x) { return !estSupprime(x.chemin); })
      .map(function (x) {
        var modif = surcouche.modifies[x.chemin];
        return modif ? Object.assign({}, x, modif) : Object.assign({}, x);
      });
    var nouveaux = (surcouche.nouveaux[rubrique] || []).filter(function (x) { return !estSupprime(x.chemin); })
      .map(function (x) { return Object.assign({}, x); });
    var tout = base.concat(nouveaux);
    if (rubrique === "elus") {
      tout.sort(function (a, b) { return (a.ordre || 99) - (b.ordre || 99); });
    } else {
      tout.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    }
    return tout;
  }

  /* La révision de ce qu'on voit d'un élément : celle de sa première
     ouverture s'il attend déjà dans le brouillon (inconnue pour un brouillon
     d'avant cette règle), sinon le commit qui l'a publié depuis ce navigateur,
     sinon la révision de contenu.json. Vide : aucun contrôle. */
  function revisionDe(chemin) {
    if (!chemin || chemin.indexOf("nouveau:") === 0) return "";
    if (aUneEntree(surcouche, chemin)) return surcouche.bases[chemin] || "";
    var publiee = "", nom = /^_data\/(.+)\.yml$/.exec(chemin);
    publicationsEnAttente().forEach(function (p) {
      if ((p.elements || {})[chemin] || (p.supprimes || []).indexOf(chemin) !== -1
        || (nom && p.reglages && p.reglages[nom[1]])) publiee = p.commit;
    });
    return publiee || (donnees && donnees.revision) || "";
  }

  function trouve(rubrique, chemin) {
    var item = listeFusionnee(rubrique).filter(function (x) { return x.chemin === chemin; })[0] || null;
    if (item) baseOuverte[chemin] = revisionDe(chemin);
    return item;
  }

  function reglagesFusionnes(nom) {
    baseOuverte[cheminReglage(nom)] = revisionDe(cheminReglage(nom));
    return Object.assign({}, reglagesPublies(nom), surcouche.reglages[nom] || {});
  }

  function etatItem(chemin) {
    if (chemin.indexOf("nouveau:") === 0) return "nouveau";
    if (surcouche.modifies[chemin]) return "modifie";
    return "";
  }

  /* ------------------------------------------------------------------- rendu */

  var LIBELLES = {
    actualites: { titre: "Actualités", singulier: "actualité", bouton: "Nouvelle actualité" },
    talents: { titre: "Nos talents", singulier: "portrait", bouton: "Nouveau portrait" }
  };

  function rendre() {
    majBarrePublication();
    document.querySelectorAll(".onglets button").forEach(function (b) {
      b.classList.toggle("actif", b.dataset.rubrique === vue.rubrique);
    });
    if (!donnees) return;
    if (vue.type === "liste") {
      if (vue.rubrique === "elus") return rendListeElus();
      if (vue.rubrique === "reglages") return rendReglages();
      if (vue.rubrique === "acces") return rendAcces();
      return rendListeArticles(vue.rubrique);
    }
    if (vue.type === "article") return rendEditeurArticle(vue.rubrique, vue.chemin);
    if (vue.type === "elu") return rendEditeurElu(vue.chemin);
  }

  function rendListeArticles(rubrique) {
    var items = listeFusionnee(rubrique);
    var lib = LIBELLES[rubrique];
    var html = '<div class="barre-liste"><h2>' + lib.titre + "</h2>" +
      '<button type="button" class="btn" id="btn-nouveau">' + lib.bouton + "</button></div>";
    if (!items.length) {
      html += '<p class="chargement">Aucun contenu. Cliquez sur « ' + lib.bouton + " » pour commencer.</p>";
    } else {
      html += '<div class="lignes">' + items.map(function (it) {
        var etat = etatItem(it.chemin);
        return '<button type="button" class="ligne" data-chemin="' + echap(it.chemin) + '">' +
          (it.image ? '<img class="ligne-vignette" src="' + echap(urlImage(it.image)) + '" alt="">'
            : '<span class="ligne-vignette--vide" aria-hidden="true"></span>') +
          '<span class="ligne-texte"><span class="ligne-titre">' + echap(it.titre) + "</span>" +
          '<span class="ligne-meta">' + dateFr(it.date) + (it.sous_titre ? " · " + echap(it.sous_titre) : "") + "</span></span>" +
          (etat ? '<span class="badge badge--' + etat + '">' + (etat === "nouveau" ? "Nouveau" : "Modifié") + "</span>" : "") +
          "</button>";
      }).join("") + "</div>";
    }
    app.innerHTML = html;
    document.getElementById("btn-nouveau").addEventListener("click", function () {
      vue = { type: "article", rubrique: rubrique, chemin: null };
      rendre();
    });
    app.querySelectorAll(".ligne").forEach(function (l) {
      l.addEventListener("click", function () {
        vue = { type: "article", rubrique: rubrique, chemin: l.dataset.chemin };
        rendre();
      });
    });
  }

  function champPhoto(valeur, libelle) {
    valeur = photoValide(valeur);
    return '<div class="champ"><label for="ch-image">' + libelle + "</label>" +
      (valeur ? '<img class="photo-actuelle" id="photo-actuelle" src="' + echap(urlImage(valeur)) + '" alt="">' :
        '<img class="photo-actuelle" id="photo-actuelle" src="" alt="" hidden>') +
      '<input type="file" id="ch-image" accept="image/*">' +
      '<p class="aide">Choisissez une photo depuis votre ordinateur.' +
      (valeur ? ' <button type="button" class="lien-reinit" id="btn-retire-photo">Retirer la photo</button>' : "") + "</p></div>";
  }

  function rendEditeurArticle(rubrique, chemin) {
    var lib = LIBELLES[rubrique];
    var creation = !chemin;
    var item = creation
      ? { chemin: "nouveau:" + rubrique + ":" + Date.now(), titre: "", date: new Date().toISOString().slice(0, 10), image: null, alt: null, photos: [], video: null, texte: "" }
      : trouve(rubrique, chemin);
    if (!item) { vue = { type: "liste", rubrique: rubrique }; return rendre(); }

    /* Une seule liste de photos : la première est celle qui illustre la carte. */
    var photos = [];
    if (item.image) photos.push({ src: item.image, alt: item.alt || "" });
    (item.photos || []).forEach(function (ph) {
      if (ph && ph.src) photos.push({ src: ph.src, alt: ph.alt || "" });
    });

    app.innerHTML = '<button type="button" class="retour-liste" id="btn-retour">&larr; ' + lib.titre + "</button>" +
      '<div class="editeur"><div class="editeur-form">' +
      '<div class="champ"><label for="ch-titre">Titre</label><input type="text" id="ch-titre" value="' + echap(item.titre) + '"></div>' +
      '<div class="champ"><label for="ch-date">Date</label><input type="date" id="ch-date" value="' + echap(item.date) + '"></div>' +
      (rubrique === "talents" ? '<div class="champ"><label for="ch-soustitre">Sous-titre</label><input type="text" id="ch-soustitre" value="' + echap(item.sous_titre || "") + '"><p class="aide">Le métier ou l\'activité. Exemple : Apicultrice au bourg.</p></div>' : "") +
      '<div class="champ"><label for="ch-images">Photos</label>' +
      '<div id="liste-photos"></div>' +
      '<input type="file" id="ch-images" accept="image/*" multiple>' +
      '<p class="aide">Vous pouvez en choisir plusieurs d\'un coup, telles qu\'elles sortent de votre appareil. ' +
      'La première illustre l\'article dans les listes ; les suivantes défilent à côté d\'elle.</p></div>' +
      '<div class="champ"><label for="ch-video">Vidéo YouTube</label><input type="url" id="ch-video" value="' + echap(item.video || "") + '"><p class="aide">Facultatif. Collez le lien d\'une vidéo YouTube.</p></div>' +
      '<div class="champ"><label for="ch-texte">Texte</label><textarea id="ch-texte">Chargement du texte…</textarea>' +
      '<p class="aide">Texte simple. Une ligne vide sépare les paragraphes ; **mot** met en gras.</p></div>' +
      '<div class="actions"><button type="button" class="btn" id="btn-enregistrer">Enregistrer</button>' +
      '<button type="button" class="btn btn--secondaire" id="btn-annuler">Annuler</button>' +
      (creation ? "" : '<button type="button" class="btn btn--danger" id="btn-supprimer">Supprimer</button>') +
      "</div></div>" +
      '<div class="apercu-cadre"><p class="apercu-etiquette">Aperçu</p><div class="apercu" id="apercu"></div></div></div>';

    var refs = {
      titre: document.getElementById("ch-titre"),
      date: document.getElementById("ch-date"),
      sousTitre: document.getElementById("ch-soustitre"),
      video: document.getElementById("ch-video"),
      texte: document.getElementById("ch-texte")
    };

    function rendPhotos() {
      var zone = document.getElementById("liste-photos");
      if (!photos.length) {
        zone.innerHTML = '<p class="aide aide--vide">Aucune photo pour le moment.</p>';
      } else {
        zone.innerHTML = photos.map(function (ph, i) {
          return '<div class="photo-ligne">' +
            '<img class="photo-vignette" src="' + echap(urlImage(ph.vignette || ph.src)) + '" alt="">' +
            '<div class="photo-champs">' +
            (i === 0 ? '<p class="photo-role">Photo principale</p>' : "") +
            '<input type="text" class="photo-alt" data-i="' + i + '" placeholder="Ce que montre la photo" value="' + echap(ph.alt) + '">' +
            "</div>" +
            '<div class="photo-boutons">' +
            (i > 0 ? '<button type="button" class="lien-reinit" data-monte="' + i + '" title="Mettre avant">&uarr;</button>' : "") +
            (i < photos.length - 1 ? '<button type="button" class="lien-reinit" data-descend="' + i + '" title="Mettre après">&darr;</button>' : "") +
            '<button type="button" class="lien-reinit lien-reinit--danger" data-retire="' + i + '">Retirer</button>' +
            "</div></div>";
        }).join("");
      }

      zone.querySelectorAll(".photo-alt").forEach(function (inp) {
        inp.addEventListener("input", function () {
          photos[parseInt(inp.dataset.i, 10)].alt = inp.value;
          apercu();
        });
      });
      zone.querySelectorAll("[data-retire]").forEach(function (b) {
        b.addEventListener("click", function () {
          photos.splice(parseInt(b.dataset.retire, 10), 1);
          rendPhotos(); apercu();
        });
      });
      zone.querySelectorAll("[data-monte]").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.dataset.monte, 10);
          photos.splice(i - 1, 0, photos.splice(i, 1)[0]);
          rendPhotos(); apercu();
        });
      });
      zone.querySelectorAll("[data-descend]").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.dataset.descend, 10);
          photos.splice(i + 1, 0, photos.splice(i, 1)[0]);
          rendPhotos(); apercu();
        });
      });
    }

    function apercu() {
      var html = "<h1>" + echap(refs.titre.value || "(sans titre)") + "</h1>";
      html += '<p class="apercu-meta">' + (rubrique === "actualites"
        ? "Publié le " + dateFr(refs.date.value)
        : echap(refs.sousTitre && refs.sousTitre.value || "")) + "</p>";
      if (photos.length === 1) {
        html += '<img class="apercu-image" src="' + echap(urlImage(photos[0].src)) + '" alt="">';
        if (photos[0].alt.trim()) html += '<p class="apercu-legende">' + echap(photos[0].alt.trim()) + "</p>";
      } else if (photos.length > 1) {
        /* L'aperçu s'arrête aux douze premières : les redessiner toutes à
           chaque lettre tapée fige la page sur un gros reportage. */
        var montrees = photos.slice(0, 12);
        html += '<div class="apercu-galerie">' + montrees.map(function (ph) {
          return '<figure><img src="' + echap(urlImage(ph.vignette || ph.src)) + '" alt="">' +
            (ph.alt.trim() ? "<figcaption>" + echap(ph.alt.trim()) + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>";
        html += '<p class="apercu-legende">' + photos.length + " photos qui défilent"
          + (photos.length > montrees.length ? " (les " + montrees.length + " premières sont montrées ici)" : "") + "</p>";
      }
      html += rendMarkdown(refs.texte.value);
      document.getElementById("apercu").innerHTML = html;
    }

    ["input", "change"].forEach(function (ev) {
      [refs.titre, refs.date, refs.sousTitre, refs.video, refs.texte].forEach(function (el) {
        if (el) el.addEventListener(ev, apercu);
      });
    });

    var inputImages = document.getElementById("ch-images");
    inputImages.addEventListener("change", function () {
      var fichiersChoisis = [].slice.call(inputImages.files || []);
      inputImages.value = "";
      if (!fichiersChoisis.length) return;
      var images = fichiersChoisis.filter(function (f) { return /^image\//.test(f.type) && f.size <= TAILLE_PHOTO_MAX; });
      var ecartees = fichiersChoisis.length - images.length;
      if (ecartees > 0) toast(ecartees + (ecartees > 1 ? " fichiers écartés : " : " fichier écarté : ") + "ce ne sont pas des photos");
      if (!images.length) return;

      /* Une par une : cent photos décodées en même temps saturent la mémoire
         de la page, et la jauge doit pouvoir avancer. */
      var illisibles = 0;
      unParUn(images, function (n, total) {
        return total > 1 ? "Préparation des photos… " + n + " sur " + total : "Préparation de la photo…";
      }, function (fichier) {
        return litPhoto(fichier).catch(function () { illisibles++; return null; });
      }).then(function (reduites) {
        reduites.forEach(function (r) {
          if (r) photos.push({ src: r.src, vignette: r.vignette, alt: "" });
        });
        rendPhotos();
        apercu();
        var ajoutees = images.length - illisibles;
        toast(ajoutees > 1 ? ajoutees + " photos ajoutées" : "Photo ajoutée");
        if (illisibles > 0) toast(illisibles + (illisibles > 1 ? " photos n'ont pas pu être lues" : " photo n'a pas pu être lue"));
      });
    });

    function retourListe() { vue = { type: "liste", rubrique: rubrique }; rendre(); }
    document.getElementById("btn-retour").addEventListener("click", retourListe);
    document.getElementById("btn-annuler").addEventListener("click", retourListe);

    document.getElementById("btn-enregistrer").addEventListener("click", function () {
      if (publicationBloque()) return;
      if (!refs.titre.value.trim()) { toast("Le titre est obligatoire"); refs.titre.focus(); return; }
      var valeurs = {
        titre: refs.titre.value.trim(),
        date: refs.date.value || item.date,
        image: photos.length ? photos[0].src : null,
        alt: photos.length ? (photos[0].alt || "").trim() || null : null,
        photos: photos.slice(1).map(function (ph) { return { src: ph.src, alt: (ph.alt || "").trim() }; }),
        video: (refs.video.value || "").trim() || null,
        texte: refs.texte.value
      };
      if (rubrique === "talents") valeurs.sous_titre = (refs.sousTitre.value || "").trim() || null;
      if (creation) {
        surcouche.nouveaux[rubrique].push(Object.assign({ chemin: item.chemin }, valeurs));
      } else if (item.chemin.indexOf("nouveau:") === 0) {
        var liste = surcouche.nouveaux[rubrique];
        for (var i = 0; i < liste.length; i++) {
          if (liste[i].chemin === item.chemin) liste[i] = Object.assign({ chemin: item.chemin }, valeurs);
        }
      } else {
        surcouche.modifies[item.chemin] = valeurs;
      }
      ecritSurcouche(surcouche);
      toast("Enregistré. À publier pour que le site change.");
      retourListe();
    });

    var btnSupprimer = document.getElementById("btn-supprimer");
    if (btnSupprimer) btnSupprimer.addEventListener("click", function () {
      if (publicationBloque()) return;
      if (!confirm("Supprimer « " + item.titre + " » ?\n\nIl disparaîtra du site en ligne une fois que vous aurez appuyé sur « Publier sur le site ».")) return;
      if (item.chemin.indexOf("nouveau:") === 0) {
        surcouche.nouveaux[rubrique] = surcouche.nouveaux[rubrique].filter(function (x) { return x.chemin !== item.chemin; });
      } else {
        surcouche.supprimes.push(item.chemin);
        delete surcouche.modifies[item.chemin];
      }
      ecritSurcouche(surcouche);
      toast("Supprimé. À publier pour que le site change.");
      retourListe();
    });

    rendPhotos();

    if (creation || typeof item.texte === "string") {
      refs.texte.value = item.texte || "";
      apercu();
    } else {
      chargeTexte(item).then(function (texte) {
        refs.texte.value = texte;
        apercu();
      }).catch(function () {
        refs.texte.value = "";
        toast("Le texte n'a pas pu être chargé");
        apercu();
      });
    }
  }

  /* --------------------------------------------------------------------- élus */

  function initiales(nom) {
    return String(nom || "").split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join("");
  }

  function rendListeElus() {
    var membres = listeFusionnee("elus");
    var html = '<div class="barre-liste"><h2>Équipe municipale</h2>' +
      '<button type="button" class="btn" id="btn-nouveau">Nouveau membre</button></div>' +
      '<div class="grille-elus">' + membres.map(function (m) {
        var etat = etatItem(m.chemin);
        return '<button type="button" class="fiche-elu" data-chemin="' + echap(m.chemin) + '">' +
          (photoValide(m.photo) ? '<img class="elu-photo" src="' + echap(urlImage(m.photo)) + '" alt="">'
            : '<span class="elu-initiales" aria-hidden="true">' + echap(initiales(m.nom)) + "</span>") +
          '<span><span class="elu-nom">' + echap(m.nom) + "</span>" +
          '<span class="elu-fonction">' + echap(m.fonction || "") + (etat ? " · " + (etat === "nouveau" ? "nouveau" : "modifié") : "") + "</span></span>" +
          "</button>";
      }).join("") + "</div>";
    app.innerHTML = html;
    document.getElementById("btn-nouveau").addEventListener("click", function () {
      vue = { type: "elu", chemin: null };
      rendre();
    });
    app.querySelectorAll(".fiche-elu").forEach(function (f) {
      f.addEventListener("click", function () {
        vue = { type: "elu", chemin: f.dataset.chemin };
        rendre();
      });
    });
  }

  function rendEditeurElu(chemin) {
    var creation = !chemin;
    var membres = listeFusionnee("elus");
    var item = creation
      ? { chemin: "nouveau:elus:" + Date.now(), nom: "", fonction: "", photo: null, ordre: membres.length + 1 }
      : trouve("elus", chemin);
    if (!item) { vue = { type: "liste", rubrique: "elus" }; return rendre(); }

    app.innerHTML = '<button type="button" class="retour-liste" id="btn-retour">&larr; Équipe municipale</button>' +
      '<div class="editeur-form">' +
      '<div class="champ"><label for="ch-nom">Prénom et nom</label><input type="text" id="ch-nom" value="' + echap(item.nom) + '"></div>' +
      '<div class="champ"><label for="ch-fonction">Fonction</label><input type="text" id="ch-fonction" value="' + echap(item.fonction || "") + '"><p class="aide">Exemple : Maire, 1er adjoint au Maire, Conseillère municipale.</p></div>' +
      '<div class="champ"><label for="ch-ordre">Ordre d\'affichage</label><input type="number" id="ch-ordre" min="1" value="' + echap(item.ordre || 10) + '"><p class="aide">1 pour le maire, 2 pour le premier adjoint, et ainsi de suite.</p></div>' +
      champPhoto(item.photo, "Portrait") +
      '<div class="actions"><button type="button" class="btn" id="btn-enregistrer">Enregistrer</button>' +
      '<button type="button" class="btn btn--secondaire" id="btn-annuler">Annuler</button>' +
      (creation ? "" : '<button type="button" class="btn btn--danger" id="btn-supprimer">Supprimer</button>') +
      "</div></div>";

    var photo = item.photo || null;
    var inputImage = document.getElementById("ch-image");
    inputImage.addEventListener("change", function () {
      var f = inputImage.files[0];
      if (!f) return;
      inputImage.value = "";
      litPhoto(f).then(function (reduite) {
        photo = reduite.src;
        var img = document.getElementById("photo-actuelle");
        img.src = photo;
        img.hidden = false;
      }).catch(function () { toast("La photo n'a pas pu être lue"); });
    });
    var btnRetirePhoto = document.getElementById("btn-retire-photo");
    if (btnRetirePhoto) btnRetirePhoto.addEventListener("click", function () {
      photo = null;
      document.getElementById("photo-actuelle").hidden = true;
    });

    function retour() { vue = { type: "liste", rubrique: "elus" }; rendre(); }
    document.getElementById("btn-retour").addEventListener("click", retour);
    document.getElementById("btn-annuler").addEventListener("click", retour);

    document.getElementById("btn-enregistrer").addEventListener("click", function () {
      if (publicationBloque()) return;
      var nom = document.getElementById("ch-nom").value.trim();
      if (!nom) { toast("Le nom est obligatoire"); return; }
      var valeurs = {
        nom: nom,
        fonction: document.getElementById("ch-fonction").value.trim(),
        ordre: parseInt(document.getElementById("ch-ordre").value, 10) || 10,
        photo: photo
      };
      if (creation) {
        surcouche.nouveaux.elus.push(Object.assign({ chemin: item.chemin }, valeurs));
      } else if (item.chemin.indexOf("nouveau:") === 0) {
        var liste = surcouche.nouveaux.elus;
        for (var i = 0; i < liste.length; i++) {
          if (liste[i].chemin === item.chemin) liste[i] = Object.assign({ chemin: item.chemin }, valeurs);
        }
      } else {
        surcouche.modifies[item.chemin] = valeurs;
      }
      ecritSurcouche(surcouche);
      toast("Enregistré. À publier pour que le site change.");
      retour();
    });

    var btnSupprimer = document.getElementById("btn-supprimer");
    if (btnSupprimer) btnSupprimer.addEventListener("click", function () {
      if (publicationBloque()) return;
      if (!confirm("Retirer « " + item.nom + " » du trombinoscope ?\n\nIl disparaîtra du site en ligne une fois que vous aurez appuyé sur « Publier sur le site ».")) return;
      if (item.chemin.indexOf("nouveau:") === 0) {
        surcouche.nouveaux.elus = surcouche.nouveaux.elus.filter(function (x) { return x.chemin !== item.chemin; });
      } else {
        surcouche.supprimes.push(item.chemin);
        delete surcouche.modifies[item.chemin];
      }
      ecritSurcouche(surcouche);
      toast("Supprimé. À publier pour que le site change.");
      retour();
    });
  }

  /* ----------------------------------------------------------------- réglages */

  function rendReglages() {
    var accueil = reglagesFusionnes("accueil");
    var mairie = reglagesFusionnes("mairie");
    var horaires = (mairie.horaires || []).slice();

    app.innerHTML = '<div class="barre-liste"><h2>Réglages du site</h2></div>' +
      '<div class="panneaux">' +
      '<section class="panneau"><h3>Page d\'accueil</h3>' +
      '<div class="champ"><label>Photo d\'accueil</label>' +
      '<img class="photo-actuelle" id="photo-accueil" src="' + echap(urlImage(accueil.photo)) + '" alt="">' +
      '<input type="file" id="ch-photo-accueil" accept="image/*">' +
      '<p class="aide">La grande photo en haut de la page d\'accueil.</p></div>' +
      '<div class="champ"><label for="ch-alt-accueil">Description de la photo d\'accueil</label><input type="text" id="ch-alt-accueil" value="' + echap(accueil.alt_photo || "") + '">' +
      '<p class="aide">Ce que montre la photo, en une phrase, pour les personnes malvoyantes.</p></div>' +
      '<div class="champ"><label for="ch-sous-titre">Sous-titre</label><input type="text" id="ch-sous-titre" value="' + echap(accueil.sous_titre || "") + '"></div>' +
      '<div class="champ"><label for="ch-texte-accueil">Texte de bienvenue</label><textarea id="ch-texte-accueil" style="min-height:110px">' + echap(accueil.texte || "") + "</textarea></div>" +
      '<div class="actions"><button type="button" class="btn" id="btn-enregistre-accueil">Enregistrer</button></div>' +
      "</section>" +
      '<section class="panneau"><h3>Coordonnées de la mairie</h3>' +
      '<div class="champ"><label for="ch-adresse">Adresse</label><textarea id="ch-adresse" style="min-height:90px">' + echap(mairie.adresse || "") + "</textarea></div>" +
      '<div class="champ"><label for="ch-telephone">Téléphone</label><input type="text" id="ch-telephone" value="' + echap(mairie.telephone || "") + '"></div>' +
      '<div class="champ"><label for="ch-email">Adresse électronique</label><input type="email" id="ch-email" value="' + echap(mairie.email || "") + '"></div>' +
      '<div class="champ"><label>Horaires d\'ouverture</label><div id="liste-horaires"></div>' +
      '<button type="button" class="btn btn--secondaire" id="btn-ajout-horaire">Ajouter un créneau</button></div>' +
      '<div class="actions"><button type="button" class="btn" id="btn-enregistre-mairie">Enregistrer</button></div>' +
      "</section></div>";

    var photoAccueil = accueil.photo || null;
    var inputPhoto = document.getElementById("ch-photo-accueil");
    inputPhoto.addEventListener("change", function () {
      var f = inputPhoto.files[0];
      if (!f) return;
      inputPhoto.value = "";
      litPhoto(f).then(function (reduite) {
        photoAccueil = reduite.src;
        document.getElementById("photo-accueil").src = photoAccueil;
      }).catch(function () { toast("La photo n'a pas pu être lue"); });
    });

    function rendHoraires() {
      var zone = document.getElementById("liste-horaires");
      zone.innerHTML = horaires.map(function (h, i) {
        return '<div class="ligne-horaire" data-i="' + i + '">' +
          '<input type="text" value="' + echap(h.jours || "") + '" data-champ="jours" placeholder="Jours" aria-label="Jours">' +
          '<input type="text" value="' + echap(h.heures || "") + '" data-champ="heures" placeholder="Heures" aria-label="Heures">' +
          '<button type="button" class="btn btn--danger" data-retire="' + i + '" aria-label="Retirer ce créneau">&times;</button>' +
          "</div>";
      }).join("") || '<p class="aide">Aucun créneau.</p>';
      zone.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("input", function () {
          var i = parseInt(inp.closest(".ligne-horaire").dataset.i, 10);
          horaires[i][inp.dataset.champ] = inp.value;
        });
      });
      zone.querySelectorAll("[data-retire]").forEach(function (b) {
        b.addEventListener("click", function () {
          horaires.splice(parseInt(b.dataset.retire, 10), 1);
          rendHoraires();
        });
      });
    }
    rendHoraires();

    document.getElementById("btn-ajout-horaire").addEventListener("click", function () {
      horaires.push({ jours: "", heures: "" });
      rendHoraires();
    });

    document.getElementById("btn-enregistre-accueil").addEventListener("click", function () {
      if (publicationBloque()) return;
      surcouche.reglages.accueil = Object.assign({}, accueil, {
        photo: photoAccueil,
        alt_photo: document.getElementById("ch-alt-accueil").value.trim(),
        sous_titre: document.getElementById("ch-sous-titre").value.trim(),
        texte: document.getElementById("ch-texte-accueil").value.trim()
      });
      ecritSurcouche(surcouche);
      majBarrePublication();
      toast("Enregistré. À publier pour que le site change.");
    });

    document.getElementById("btn-enregistre-mairie").addEventListener("click", function () {
      if (publicationBloque()) return;
      surcouche.reglages.mairie = Object.assign({}, mairie, {
        adresse: document.getElementById("ch-adresse").value.trim(),
        telephone: document.getElementById("ch-telephone").value.trim(),
        email: document.getElementById("ch-email").value.trim(),
        horaires: horaires.filter(function (h) { return (h.jours || h.heures || "").trim() !== ""; })
      });
      ecritSurcouche(surcouche);
      majBarrePublication();
      toast("Enregistré. À publier pour que le site change.");
    });
  }

  /* ------------------------------------------------------------ publication

     Les modifications enregistrées dans ce navigateur (la « surcouche ») sont
     traduites en fichiers du site, puis écrites en une seule fois par
     publication.js. Sans jeton installé, rien de tout cela ne s'active.      */

  function slug(t) {
    return String(t || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 60) || "sans-titre";
  }

  /* Chaîne YAML entre guillemets : sûre quel que soit le contenu saisi. */
  function yTexte(v) {
    return '"' + String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ") + '"';
  }

  /* Bloc YAML littéral, pour les valeurs qui peuvent tenir sur plusieurs lignes. */
  function yBloc(cle, v, retrait) {
    var texte = String(v == null ? "" : v).replace(/\r/g, "").trim();
    if (!texte) return retrait + cle + ': ""';
    return retrait + cle + ": |-\n" + texte.split("\n").map(function (l) {
      return retrait + "  " + l;
    }).join("\n");
  }

  var EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

  /* Repère court d'une photo, pour la reconnaître d'une tentative à l'autre.
     Quelques caractères prélevés de loin en loin suffisent : il s'agit de
     retrouver une photo, pas de se prémunir contre une falsification. */
  function repere(dataUrl) {
    var somme = 0;
    for (var i = 0; i < dataUrl.length; i += 997) somme = (somme * 31 + dataUrl.charCodeAt(i)) | 0;
    return dataUrl.length.toString(36) + "-" + (somme >>> 0).toString(36);
  }

  /* Repère de chaque photo en partance, par chemin : sert à noter, une fois le
     dépôt confirmé, laquelle n'a plus besoin de repartir. */
  var reperesEnvoyes = {};
  /* Deux photos identiques dans un même article (un doublon, cela arrive) ont
     le même repère : leur rang les distingue, faute de quoi la seconde
     effacerait la première. */
  var occurrences = {};

  function repereUnique(valeur) {
    var base = repere(valeur);
    occurrences[base] = (occurrences[base] || 0) + 1;
    return base + "#" + occurrences[base];
  }

  /* Une photo choisie dans l'éditeur arrive en data: ; elle devient un fichier du site. */
  function extraitPhoto(valeur, base, fichiers) {
    valeur = photoValide(valeur);
    if (!valeur || valeur.indexOf("data:") !== 0) return valeur;
    var m = String(valeur).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;

    /* Photo déjà déposée lors d'une tentative précédente : sa référence est
       réutilisée au lieu de la renvoyer. C'est ce qui permet à une publication
       interrompue de reprendre là où elle s'est arrêtée, au lieu de tout
       recommencer (constaté le 08/09/2026 : trente mégaoctets envoyés pour
       rien, deux fois de suite). */
    var marqueur = repereUnique(valeur);
    var deja = (surcouche.deposees || {})[marqueur];
    if (deja && deja.sha) {
      fichiers.push({ chemin: deja.chemin, sha: deja.sha });
      return "/" + deja.chemin;
    }

    /* L'horodatage seul ne suffit pas : plusieurs photos d'un même article
       partent dans la même milliseconde et s'écraseraient l'une l'autre. */
    var marque = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    var chemin = "assets/img/" + slug(base) + "-" + marque + "." + (EXTENSIONS[m[1]] || "jpg");
    fichiers.push({ chemin: chemin, base64: m[2] });
    reperesEnvoyes[chemin] = marqueur;
    return "/" + chemin;
  }

  function fichierArticle(rubrique, valeurs, chemin, fichiers) {
    var image = extraitPhoto(valeurs.image, valeurs.titre, fichiers);
    var lignes = ["---", "title: " + yTexte(valeurs.titre), "date: " + (valeurs.date || "")];
    if (rubrique === "talents" && valeurs.sous_titre) lignes.push("sous_titre: " + yTexte(valeurs.sous_titre));
    if (image) lignes.push("image: " + yTexte(image));
    if (image && valeurs.alt) lignes.push("alt: " + yTexte(valeurs.alt));
    var autres = (valeurs.photos || []).map(function (ph) {
      return { src: extraitPhoto(ph.src, valeurs.titre, fichiers), alt: ph.alt };
    }).filter(function (ph) { return ph.src; });
    if (autres.length) {
      lignes.push("photos:");
      autres.forEach(function (ph) {
        lignes.push("  - src: " + yTexte(ph.src));
        if (ph.alt) lignes.push("    alt: " + yTexte(ph.alt));
      });
    }
    if (valeurs.video) lignes.push("video: " + yTexte(valeurs.video));
    lignes.push("---");
    var corps = String(valeurs.texte || "").replace(/\r/g, "").trim();
    return { chemin: chemin, texte: lignes.join("\n") + "\n" + corps + "\n" };
  }

  function fichierElu(valeurs, chemin, fichiers) {
    var photo = extraitPhoto(valeurs.photo, valeurs.nom, fichiers);
    var lignes = ["---", "title: " + yTexte(valeurs.nom), "fonction: " + yTexte(valeurs.fonction),
      "ordre: " + (parseInt(valeurs.ordre, 10) || 10)];
    if (photo) lignes.push("photo: " + yTexte(photo));
    lignes.push("---");
    return { chemin: chemin, texte: lignes.join("\n") + "\n" };
  }

  function fichierAccueil(reglages, fichiers) {
    var photo = extraitPhoto(reglages.photo, "accueil", fichiers) || "/assets/img/hero-gapree.jpg";
    return {
      chemin: "_data/accueil.yml",
      texte: [
        "photo: " + yTexte(photo),
        "alt_photo: " + yTexte(reglages.alt_photo || ""),
        "sous_titre: " + yTexte(reglages.sous_titre || ""),
        yBloc("texte", reglages.texte, "")
      ].join("\n") + "\n"
    };
  }

  function fichierMairie(reglages) {
    var horaires = (reglages.horaires || []).map(function (h) {
      return "  - jours: " + yTexte(h.jours) + "\n    heures: " + yTexte(h.heures);
    }).join("\n");
    return {
      chemin: "_data/mairie.yml",
      texte: [
        yBloc("adresse", reglages.adresse, ""),
        "telephone: " + yTexte(reglages.telephone || ""),
        "email: " + yTexte(reglages.email || ""),
        "horaires:" + (horaires ? "\n" + horaires : " []"),
        "note_horaires: " + yTexte(reglages.note_horaires || ""),
        "carte: " + yTexte(reglages.carte || "")
      ].join("\n") + "\n"
    };
  }

  /* Traduit tout ce qui attend dans le navigateur en fichiers à écrire. */
  function construitChangements() {
    var fichiers = [];
    reperesEnvoyes = {};
    occurrences = {};
    var bases = surcouche.bases || {};
    var bloquees = clesBloquees();
    var retires = surcouche.supprimes.filter(function (c) { return !bloquees["s:" + c]; });
    var suppressions = retires.map(function (c) { return bases[c] ? { chemin: c, base: bases[c] } : c; });
    var resume = [];
    /* Les entrées du brouillon que cette publication emporte, telles qu'elles
       sont au départ : seules celles-là en sortiront au succès. */
    var entrees = {};
    /* Ce que le site montrera une fois la publication en ligne : éléments
       écrits (à leur chemin définitif) et réglages. */
    var ecrits = [];
    var reglages = {};
    function ecrit(chemin, v) {
      var publie = Object.assign({}, v);
      delete publie.chemin;
      ecrits.push({ chemin: chemin, valeurs: publie });
    }

    /* Un nouvel élément ne tombe jamais sur un fichier existant, sur celui
       d'un autre nouveau ni sur un fichier que la même publication retire :
       il réécrivait l'existant, perdait le second, ou bloquait la publication
       (revue du 05/10/2026). Suffixe -2, -3… au besoin. */
    var pris = cheminsPris();
    function cheminLibre(chemin) {
      var racine = chemin.replace(/\.md$/, ""), n = 1, essai = chemin;
      while (pris[essai]) { n++; essai = racine + "-" + n + ".md"; }
      pris[essai] = true;
      return essai;
    }

    ["actualites", "talents"].forEach(function (rubrique) {
      (surcouche.nouveaux[rubrique] || []).forEach(function (v) {
        /* Le jour seul, même si la date porte l'heure. */
        var nom = rubrique === "actualites"
          ? String(v.date || new Date().toISOString()).slice(0, 10) + "-" + slug(v.titre)
          : slug(v.titre);
        var chemin = cheminLibre("_" + rubrique + "/" + nom + ".md");
        var fichier = fichierArticle(rubrique, v, chemin, fichiers);
        fichier.nouveau = true;
        fichiers.push(fichier);
        resume.push("ajout : " + v.titre);
        entrees["n:" + rubrique + ":" + v.chemin] = copie(v);
        ecrit(chemin, v);
      });
    });

    (surcouche.nouveaux.elus || []).forEach(function (v) {
      var chemin = cheminLibre("_elus/" + slug(v.nom) + ".md");
      var fichier = fichierElu(v, chemin, fichiers);
      fichier.nouveau = true;
      fichiers.push(fichier);
      resume.push("ajout : " + v.nom);
      entrees["n:elus:" + v.chemin] = copie(v);
      ecrit(chemin, v);
    });

    Object.keys(surcouche.modifies).forEach(function (chemin) {
      if (bloquees["m:" + chemin]) return;
      /* Une modification d'un élément retiré dans la même publication n'a plus d'objet. */
      entrees["m:" + chemin] = copie(surcouche.modifies[chemin]);
      if (estSupprime(chemin)) return;
      var v = surcouche.modifies[chemin], fichier;
      if (chemin.indexOf("_elus/") === 0) {
        fichier = fichierElu(v, chemin, fichiers);
        resume.push("modification : " + v.nom);
      } else {
        var rubrique = chemin.indexOf("_talents/") === 0 ? "talents" : "actualites";
        fichier = fichierArticle(rubrique, v, chemin, fichiers);
        resume.push("modification : " + v.titre);
      }
      if (bases[chemin]) fichier.base = bases[chemin];
      fichiers.push(fichier);
      ecrit(chemin, v);
    });

    if (surcouche.reglages.accueil && !bloquees["r:accueil"]) {
      reglages.accueil = reglagesFusionnes("accueil");
      var accueil = fichierAccueil(reglages.accueil, fichiers);
      if (bases[accueil.chemin]) accueil.base = bases[accueil.chemin];
      fichiers.push(accueil);
      resume.push("page d'accueil");
      entrees["r:accueil"] = copie(surcouche.reglages.accueil);
    }
    if (surcouche.reglages.mairie && !bloquees["r:mairie"]) {
      reglages.mairie = reglagesFusionnes("mairie");
      var mairie = fichierMairie(reglages.mairie);
      if (bases[mairie.chemin]) mairie.base = bases[mairie.chemin];
      fichiers.push(mairie);
      resume.push("coordonnées de la mairie");
      entrees["r:mairie"] = copie(surcouche.reglages.mairie);
    }

    retires.forEach(function (chemin) {
      resume.push("suppression : " + chemin.split("/").pop());
      entrees["s:" + chemin] = true;
    });

    /* Les photos et pièces jointes que plus rien ne cite partent avec leur
       élément : retirer une photo ou supprimer un article les laissait en
       ligne à leur adresse, alors que la mairie croyait avoir satisfait une
       demande de retrait (84 images oubliées ainsi le 05/10/2026). On ne part
       que des anciennes valeurs des éléments touchés, aux noms uniques. */
    var cites = mediasCites();
    var anciennes = [];
    Object.keys(surcouche.modifies).forEach(function (c) {
      if (!bloquees["m:" + c] && !estSupprime(c)) anciennes = anciennes.concat(mediasDe(enLigne(c)));
    });
    retires.forEach(function (c) { anciennes = anciennes.concat(mediasDe(enLigne(c))); });
    if (reglages.accueil) anciennes = anciennes.concat(mediasDe(reglagesPublies("accueil")));
    anciennes.forEach(function (src) {
      var chemin = src.slice(1);
      if (cites[src] || MEDIAS_DU_SITE.indexOf(src) !== -1 || !MEDIA_RETIRABLE.test(chemin)) return;
      if (suppressions.indexOf(chemin) === -1) suppressions.push(chemin);
    });

    return {
      fichiers: fichiers,
      suppressions: suppressions,
      resume: resume,
      entrees: entrees,
      ecrits: ecrits,
      retires: retires,
      reglages: reglages,
      message: "Mise à jour du site depuis l'espace d'administration\n\n" + resume.join("\n") + "\n"
    };
  }

  /* Image que le site utilise lui-même (photo d'accueil par défaut, aperçu de
     partage) : jamais retirée. Et seuls les noms que le serveur accepte de
     retirer (contrat 1) partent. */
  var MEDIAS_DU_SITE = ["/assets/img/hero-gapree.jpg"];
  var MEDIA_RETIRABLE = /^assets\/img\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp|gif)$|^assets\/docs\/[a-z0-9][a-z0-9-]*\.pdf$/;

  /* Les photos et pièces jointes du site citées par une valeur, à toute profondeur. */
  function mediasDe(v, liste) {
    liste = liste || [];
    if (typeof v === "string") { if (/^\/assets\/(img|docs)\//.test(v)) liste.push(v); }
    else if (Array.isArray(v)) v.forEach(function (x) { mediasDe(x, liste); });
    else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { mediasDe(v[k], liste); });
    return liste;
  }

  /* Un élément tel qu'il est publié, avant le brouillon. */
  function enLigne(chemin) {
    var r = rubriqueDe(chemin);
    return r ? elementsPublies(r).filter(function (x) { return x.chemin === chemin; })[0] || null : null;
  }

  /* Tout ce qui sera encore cité une fois la publication faite : le site, les
     publications pas encore en ligne et le brouillon, y compris ses entrées
     qui ne partent pas. */
  function mediasCites() {
    var liste = [];
    RUBRIQUES.forEach(function (r) { mediasDe(listeFusionnee(r), liste); });
    mediasDe(Object.assign({}, reglagesPublies("accueil"), surcouche.reglages.accueil || {}), liste);
    mediasDe(surcouche.modifies, liste);
    var cites = {};
    liste.forEach(function (src) { cites[src] = true; });
    return cites;
  }

  /* Tous les chemins de contenu déjà pris : ceux du site, ceux qu'il aura une
     fois en ligne ce que ce navigateur a publié, et ceux qui attendent dans le
     brouillon (modifiés ou retirés). */
  function cheminsPris() {
    var pris = {};
    RUBRIQUES.forEach(function (r) {
      (donnees[r] || []).forEach(function (x) { pris[x.chemin] = true; });
    });
    publicationsEnAttente().forEach(function (p) {
      Object.keys(p.elements || {}).forEach(function (c) { pris[c] = true; });
    });
    Object.keys(surcouche.modifies).forEach(function (c) { pris[c] = true; });
    surcouche.supprimes.forEach(function (c) { pris[c] = true; });
    conflitsSignales.forEach(function (c) { pris[c] = true; });
    return pris;
  }

  /* Adresse sur le site d'une photo choisie dans l'éditeur (data:), d'après
     les références des photos déposées par cette publication : le site la
     montrera là, et une retouche la réutilisera sans la renvoyer. */
  function adressesPubliees(v) {
    if (typeof v === "string") {
      if (v.indexOf("data:") !== 0) return v;
      var deposee = (surcouche.deposees || {})[repere(v) + "#1"];
      return deposee && deposee.chemin ? "/" + deposee.chemin : v;
    }
    if (Array.isArray(v)) return v.map(adressesPubliees);
    if (v && typeof v === "object") {
      var c = {};
      Object.keys(v).forEach(function (k) { c[k] = adressesPubliees(v[k]); });
      return c;
    }
    return v;
  }

  /* Ce qu'une publication réussie laisse à suivre jusqu'à sa mise en ligne :
     les valeurs publiées, qui servent de base à tout élément rouvert, et les
     révisions déjà vues avant elle, dont le retour ne prouve rien. */
  function publicationFaite(changements, commit, connues) {
    var elements = {}, reglages = {};
    changements.ecrits.forEach(function (e) { elements[e.chemin] = adressesPubliees(e.valeurs); });
    Object.keys(changements.reglages).forEach(function (nom) { reglages[nom] = adressesPubliees(changements.reglages[nom]); });
    return { commit: commit, quand: Date.now(), connues: connues,
      elements: elements, supprimes: changements.retires, reglages: reglages };
  }

  /* Ce qu'une publication réussie retire du brouillon : ce qu'elle a emporté
     et qui n'a pas changé depuis (un autre onglet a pu y toucher), plus les
     références des photos déposées, devenues inutiles. */
  function retraitsApresPublication(entrees) {
    var operations = Object.keys(entrees).map(function (cle) { return { cle: cle, retire: true, si: entrees[cle] }; });
    Object.keys(surcouche.deposees || {}).forEach(function (k) { operations.push({ cle: "d:" + k, retire: true }); });
    return operations;
  }

  function nombreEnAttente() {
    var c = surcouche.supprimes.length + Object.keys(surcouche.modifies).length;
    ["actualites", "talents", "elus"].forEach(function (r) { c += (surcouche.nouveaux[r] || []).length; });
    if (surcouche.reglages.accueil) c++;
    if (surcouche.reglages.mairie) c++;
    return c - entreesBloquees().length;
  }

  function majBarrePublication() {
    var barre = document.getElementById("barre-publication");
    if (!barre || !window.GapreePublication.estConnecte()) return;
    var n = nombreEnAttente();
    var etat = document.getElementById("etat-publication");
    var bouton = document.getElementById("btn-publier");
    barre.hidden = false;
    /* Un changement d'onglet pendant l'envoi ne doit ni réactiver Publier ni
       effacer « Publication en cours… ». */
    if (publicationEnCours) {
      bouton.disabled = true;
      etat.textContent = "Publication en cours…";
      return;
    }
    bouton.disabled = n === 0;
    var miseEnLigne = publicationsEnAttente().length > 0;
    barre.classList.toggle("barre-publication--attente", n > 0 || miseEnLigne);
    etat.textContent = n === 0
      ? (miseEnLigne ? TEXTE_MISE_EN_LIGNE : "Le site en ligne est à jour.")
      : (n > 1
        ? n + " modifications ne sont pas encore en ligne."
        : "1 modification n'est pas encore en ligne.");
    afficheEntreesBloquees();
  }

  /* Les entrées qui ne partiront pas, sous la barre, chacune avec « Retirer ». */
  function afficheEntreesBloquees() {
    var barre = document.getElementById("barre-publication");
    if (!barre) return;
    var zone = document.getElementById("entrees-bloquees");
    if (!zone) {
      zone = document.createElement("div");
      zone.id = "entrees-bloquees";
      zone.style.flexBasis = "100%";
      barre.appendChild(zone);
    }
    var liste = entreesBloquees();
    zone.hidden = !liste.length;
    zone.innerHTML = liste.map(function (e, i) {
      return '<p class="etat-publication">' + echap(e.texte) +
        ' <button type="button" class="lien-reinit" data-entree="' + i + '">Retirer</button></p>';
    }).join("");
    zone.querySelectorAll("[data-entree]").forEach(function (b) {
      b.addEventListener("click", function () { retireEntree(liste[parseInt(b.dataset.entree, 10)]); });
    });
  }

  function retireEntree(e) {
    if (publicationBloque()) return;
    conflitsSignales = conflitsSignales.filter(function (c) { return c !== e.chemin; });
    appliqueIci([{ cle: e.cle, retire: true }]);
    majBarrePublication();
    toast("Retiré des modifications à publier");
  }

  /* ------------------------------------------------------- mise en ligne

     Après une publication, contenu.json est relu toutes les 15 secondes
     jusqu'à ce qu'il porte le commit publié, ou un commit postérieur. Cela
     remplace le rechargement de la page au bout de 60 secondes, qui effaçait
     la saisie en cours et, quand la construction durait plus (jusqu'à 330 s
     le 05/10/2026), laissait l'éditeur rouvrir l'état d'avant.              */
  var TEXTE_MISE_EN_LIGNE = "Mise en ligne en cours : cela prend en général une à trois minutes.";
  var SUIVI_MISE_EN_LIGNE = 15000;
  var MISE_EN_LIGNE_SANS_REVISION = 10 * 60 * 1000;
  var minuterieSuivi = null;

  /* contenu.json tel que le site le sert à l'instant, sans aucun cache. */
  function litContenuFrais() {
    return fetch("contenu.json?v=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  /* Une publication est en ligne quand contenu.json porte son commit, ou une
     révision jamais vue avant elle : le site n'en montre jamais de plus
     ancienne après une nouvelle, une révision inconnue est donc postérieure.
     Sans révision dans contenu.json (gabarit pas encore construit), on s'en
     tient au délai que GitHub annonce : dix minutes au plus. */
  function estEnLigne(p, revision) {
    if (!revision) return Date.now() - (p.quand || 0) >= MISE_EN_LIGNE_SANS_REVISION;
    return revision === p.commit || (p.connues || []).indexOf(revision) === -1;
  }

  /* Oublie les publications désormais en ligne ; rend leur nombre. */
  function oublieLesPubliees(revision) {
    var faites = publicationsEnAttente().filter(function (p) { return estEnLigne(p, revision); });
    if (faites.length) appliqueIci(faites.map(function (p) { return { cle: "p:" + p.commit, retire: true }; }));
    return faites.length;
  }

  function suisLaMiseEnLigne() {
    if (minuterieSuivi || !publicationsEnAttente().length) return;
    minuterieSuivi = setTimeout(function () {
      litContenuFrais().then(function (frais) {
        if (!oublieLesPubliees(frais.revision)) return;
        /* Le site montre désormais ce qui a été publié : ses données deviennent
           la base, et le texte se lira à cette révision. */
        donnees = frais;
        majBarrePublication();
        if (!publicationEnCours && !nombreEnAttente() && !publicationsEnAttente().length) {
          document.getElementById("etat-publication").textContent = "En ligne.";
        }
      }, function () { /* coupure passagère : on relira au prochain tour */ }).then(function () {
        minuterieSuivi = null;
        suisLaMiseEnLigne();
      });
    }, SUIVI_MISE_EN_LIGNE);
  }

  /* Le serveur ne peut pas recevoir un reportage entier d'un coup : les photos
     partent par paquets, puis le site est mis à jour une seule fois, à la fin.
     Quel que soit leur nombre, la personne n'a donc qu'un bouton à presser. */
  var POIDS_PAQUET = 10 * 1024 * 1024;

  function decoupeEnPaquets(fichiers) {
    var paquets = [], courant = [], poids = 0;
    fichiers.forEach(function (f) {
      if (courant.length && poids + f.base64.length > POIDS_PAQUET) {
        paquets.push(courant);
        courant = [];
        poids = 0;
      }
      courant.push(f);
      poids += f.base64.length;
    });
    if (courant.length) paquets.push(courant);
    return paquets;
  }

  /* Une coupure passagère ne doit pas coûter tout le reportage. */
  function reessaieUneFois(action) {
    return action().catch(function (premiere) {
      /* Un refus du serveur (session expirée, conflit…) ne passera pas mieux au second essai. */
      if (estUnRefus(premiere)) throw premiere;
      return respire().then(action).catch(function () { throw premiere; });
    });
  }

  function estUnRefus(e) { return !!(e && e.statut >= 400 && e.statut < 500); }

  /* Décrit un échec assez précisément pour être compris à distance, sans jamais
     transporter le contenu des photos. */
  function compteRendu(etape, erreur, fichiers, suppressions) {
    var sansRien = fichiers.filter(function (f) { return !f.sha && !f.base64 && typeof f.texte !== "string"; });
    var chemins = {};
    var doublons = [];
    fichiers.forEach(function (f) {
      if (chemins[f.chemin]) doublons.push(f.chemin);
      chemins[f.chemin] = true;
    });
    try {
      window.GapreePublication.journal({
        version: VERSION,
        etape: etape,
        erreur: String(erreur && erreur.message || erreur).slice(0, 300),
        navigateur: navigator.userAgent.slice(0, 160),
        fichiers: fichiers.length,
        avecReference: fichiers.filter(function (f) { return f.sha; }).length,
        avecPhoto: fichiers.filter(function (f) { return f.base64; }).length,
        avecTexte: fichiers.filter(function (f) { return typeof f.texte === "string"; }).length,
        sansRien: sansRien.length,
        cheminsSansRien: sansRien.slice(0, 5).map(function (f) { return f.chemin; }),
        cheminsEnDouble: doublons.slice(0, 5),
        suppressions: (suppressions || []).length,
        referencesGardees: Object.keys(surcouche.deposees || {}).length,
        articlesEnAttente: (surcouche.nouveaux.actualites || []).length,
        modifiesEnAttente: Object.keys(surcouche.modifies || {}).length
      });
    } catch (e) { /* un compte rendu ne doit jamais gêner */ }
  }

  /* Deux appuis rapprochés lançaient deux publications de front, qui se
     marchaient dessus (observé chez Camille le 10/09/2026 : tout partait en
     double). */
  var publicationEnCours = false;

  /* Pendant l'envoi, la publication travaille sur ce qu'elle a pris au départ :
     un enregistrement fait entre-temps ne partait pas, puis était effacé à la
     fin avec le reste, et « Annuler » vidait le brouillon sans arrêter l'envoi
     (revue du 05/10/2026). Le brouillon ne bouge donc plus tant que la
     publication n'est pas finie. Appelée en tête de chaque geste qui l'écrit. */
  function publicationBloque(message) {
    if (!publicationEnCours) return false;
    toast(message || "Une publication est en cours : attendez qu'elle se termine.");
    return true;
  }

  function publieMaintenant(deuxiemeChance) {
    if (publicationEnCours && !deuxiemeChance) return;
    publicationEnCours = true;
    var bouton = document.getElementById("btn-publier");
    var etat = document.getElementById("etat-publication");
    var changements = construitChangements();
    /* Trace du départ : sans elle, un appui qui ne produit rien reste invisible. */
    compteRendu(deuxiemeChance ? "reprise après échec" : "départ", null,
      changements.fichiers, changements.suppressions);
    if (!changements.fichiers.length && !changements.suppressions.length) { publicationEnCours = false; return; }
    if (!deuxiemeChance && !confirm("Publier " + changements.resume.length + " modification(s) sur le site en ligne ?\n\n"
      + changements.resume.join("\n"))) { publicationEnCours = false; return; }

    var aEnvoyer = changements.fichiers.filter(function (f) { return f.base64; });
    var textes = changements.fichiers.filter(function (f) { return !f.base64; });
    var paquets = decoupeEnPaquets(aEnvoyer);
    var deposees = [];
    var faites = 0;
    var etapeFinale = false;
    var connues = [];

    bouton.disabled = true;
    etat.textContent = "Publication en cours…";

    unParUn(paquets, function (n) {
      /* Le compte annoncé est celui atteint à la fin du paquet en cours : c'est
         ce que la jauge montre avancer. */
      return "Envoi des photos… " + Math.min(faites + paquets[n - 1].length, aEnvoyer.length)
        + " sur " + aEnvoyer.length;
    }, function (paquet) {
      return reessaieUneFois(function () {
        return window.GapreePublication.televerse(paquet);
      }).then(function (recues) {
        deposees = deposees.concat(recues);
        faites += paquet.length;
        /* Chaque paquet confirmé est noté dans le brouillon : si la suite
           échoue, ces photos ne repartiront pas une seconde fois. */
        surcouche.deposees = surcouche.deposees || {};
        recues.forEach(function (f) {
          var marqueur = reperesEnvoyes[f.chemin];
          /* Sans référence complète, mieux vaut renvoyer la photo à la prochaine
             tentative que garder une trace inutilisable. */
          if (marqueur && f.sha) surcouche.deposees[marqueur] = { chemin: f.chemin, sha: f.sha };
        });
        ecritSurcouche(surcouche);
      });
    }).then(function () {
      progression("Mise à jour du site…", 1, 2);
      etapeFinale = true;
      /* Les révisions que le site sert juste avant l'enregistrement : aucune
         d'elles ne pourra passer pour la mise en ligne de cette publication. */
      return litContenuFrais().then(function (frais) { return frais.revision; }, function () { return ""; });
    }).then(function (revisionAvant) {
      connues = [donnees.revision, revisionAvant].concat(publicationsEnAttente().map(function (p) { return p.commit; }))
        .filter(function (r, i, tout) { return r && tout.indexOf(r) === i; });
      return reessaieUneFois(function () {
        return window.GapreePublication.publie({
          message: changements.message,
          fichiers: textes.concat(deposees),
          suppressions: changements.suppressions
        });
      });
    }).then(function (reponse) {
      progression(null);
      publicationEnCours = false;
      var operations = retraitsApresPublication(changements.entrees);
      /* « Inchangé » : le site portait déjà exactement ce contenu, rien à suivre. */
      if (reponse && reponse.inchange) {
        appliqueIci(operations);
        majBarrePublication();
        etat.textContent = "Le site était déjà à jour.";
        toast("Le site était déjà à jour");
        return;
      }
      if (reponse && reponse.commit) {
        operations.push({ cle: "p:" + reponse.commit, valeur: publicationFaite(changements, reponse.commit, connues) });
        /* Un éditeur resté ouvert montre désormais ce qui vient d'être publié. */
        changements.ecrits.forEach(function (e) { baseOuverte[e.chemin] = reponse.commit; });
        Object.keys(changements.reglages).forEach(function (nom) { baseOuverte[cheminReglage(nom)] = reponse.commit; });
      }
      appliqueIci(operations);
      majBarrePublication();
      toast("Publié sur le site");
      suisLaMiseEnLigne();
    }).catch(function (e) {
      progression(null);
      publicationEnCours = false;
      compteRendu(etapeFinale ? "publication" : "envoi des photos", e,
        textes.concat(deposees), changements.suppressions);
      var gardees = Object.keys(surcouche.deposees || {}).length;
      var suite;
      if (e && e.conflits) conflitsSignales = e.conflits.slice();
      if (etapeFinale && gardees && !deuxiemeChance && !estUnRefus(e)) {
        /* L'envoi s'est bien passé et c'est la mise à jour qui a échoué : une des
           références gardées n'est donc pas exploitable. On les oublie et on
           renvoie les photos tout de suite, sans rien demander : sinon chaque
           appui rejoue le même échec, et l'on n'en sort jamais (Camille s'est
           retrouvée bloquée ainsi du 08 au 10/09/2026). */
        surcouche.deposees = {};
        ecritSurcouche(surcouche);
        etat.textContent = "Nouvel essai, les photos sont renvoyées…";
        publieMaintenant(true);
        return;
      }
      if (gardees) {
        /* L'envoi a été interrompu : ce qui est arrivé reste acquis. */
        suite = " Vos " + gardees + " photos déjà envoyées sont conservées :"
          + " appuyez à nouveau sur Publier pour reprendre.";
      } else {
        suite = "";
      }
      if (e && e.conflits) majBarrePublication();
      etat.textContent = (e.message || "La publication a échoué.") + suite;
      bouton.disabled = nombreEnAttente() === 0;
      toast("La publication a échoué");
    });
  }

  /* --------------------------------------------------------------- accès */

  function rendAcces() {
    app.innerHTML = '<div class="barre-liste"><h2>Qui peut modifier le site</h2></div>' +
      '<p class="aide aide--large">Chaque personne se connecte avec son adresse électronique. ' +
      'Le mot de passe est fabriqué ici : notez-le et transmettez-le à la personne, ' +
      'elle le remplacera par le sien à sa première connexion.</p>' +
      '<div class="panneau panneau--acces">' +
      '<h3>Donner un accès</h3>' +
      '<div class="champ"><label for="ch-nouvel-email">Adresse électronique</label>' +
      '<input type="email" id="ch-nouvel-email" placeholder="prenom.nom@exemple.fr"></div>' +
      '<label class="case"><input type="checkbox" id="ch-nouvel-admin"> Cette personne pourra aussi donner et retirer des accès</label>' +
      '<div class="actions"><button type="button" class="btn" id="btn-nouvel-acces">Créer l\'accès</button></div>' +
      '<div id="mdp-genere"></div>' +
      "</div>" +
      '<div id="zone-acces"><p class="chargement">Chargement…</p></div>';

    document.getElementById("btn-nouvel-acces").addEventListener("click", function () {
      var champ = document.getElementById("ch-nouvel-email");
      var email = champ.value.trim();
      if (!email) { toast("Indiquez une adresse électronique"); champ.focus(); return; }
      var admin = document.getElementById("ch-nouvel-admin").checked;
      pub.ajouteUtilisateur(email, admin).then(function (r) {
        champ.value = "";
        document.getElementById("ch-nouvel-admin").checked = false;
        montreMotDePasse(r.email, r.motDePasse);
        listeAcces();
      }).catch(function (e) { toast(e.message); });
    });

    listeAcces();
  }

  /* Le mot de passe ne s'affiche qu'une fois : il reste sous les yeux
     jusqu'à ce qu'on le referme, avec de quoi le copier. */
  function montreMotDePasse(email, motDePasse) {
    var zone = document.getElementById("mdp-genere");
    zone.innerHTML = '<div class="mdp-encart">' +
      "<p class=\"mdp-titre\">Mot de passe de " + echap(email) + "</p>" +
      '<p class="mdp-valeur" id="mdp-valeur">' + echap(motDePasse) + "</p>" +
      '<p class="mdp-aide">Notez-le et transmettez-le maintenant : il ne sera plus affiché. ' +
      'La personne choisira le sien en se connectant.</p>' +
      '<div class="actions"><button type="button" class="btn btn--secondaire" id="btn-copier">Copier</button>' +
      '<button type="button" class="btn btn--secondaire" id="btn-fermer-mdp">J\'ai noté</button></div></div>';

    document.getElementById("btn-copier").addEventListener("click", function () {
      var texte = document.getElementById("mdp-valeur").textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(texte).then(function () { toast("Mot de passe copié"); },
          function () { toast("Copie impossible, notez-le à la main"); });
      } else {
        toast("Copie impossible, notez-le à la main");
      }
    });
    document.getElementById("btn-fermer-mdp").addEventListener("click", function () { zone.innerHTML = ""; });
  }

  function listeAcces() {
    var zone = document.getElementById("zone-acces");
    pub.listeUtilisateurs().then(function (comptes) {
      var moi = pub.utilisateur() || {};
      zone.innerHTML = '<h3 class="titre-liste-acces">Accès en place</h3><div class="lignes">' + comptes.map(function (c) {
        var soi = c.email === moi.email;
        return '<div class="ligne ligne--acces">' +
          '<span class="ligne-texte"><span class="ligne-titre">' + echap(c.email) + (soi ? " (vous)" : "") + "</span>" +
          '<span class="ligne-meta">' + (c.admin ? "Peut gérer les accès" : "Peut modifier le site") +
          (c.aChange ? "" : " · mot de passe provisoire, jamais utilisé") + "</span></span>" +
          '<span class="acces-actions">' +
          (soi ? "" : '<button type="button" class="lien-reinit" data-droits="' + echap(c.email) + '" data-vers="' + (c.admin ? "0" : "1") + '">' +
            (c.admin ? "Ne plus gérer les accès" : "Autoriser à gérer les accès") + "</button>") +
          '<button type="button" class="lien-reinit" data-reinit="' + echap(c.email) + '">Nouveau mot de passe</button>' +
          (soi ? "" : '<button type="button" class="lien-reinit lien-reinit--danger" data-retire="' + echap(c.email) + '">Retirer l\'accès</button>') +
          "</span></div>";
      }).join("") + "</div>";

      zone.querySelectorAll("[data-droits]").forEach(function (b) {
        b.addEventListener("click", function () {
          var vers = b.dataset.vers === "1";
          var question = vers
            ? "Autoriser " + b.dataset.droits + " à donner et retirer des accès ?"
            : "Retirer à " + b.dataset.droits + " le droit de gérer les accès ?\n\nCette personne pourra toujours modifier et publier le site.";
          if (!confirm(question)) return;
          pub.changeDroits(b.dataset.droits, vers).then(function () {
            toast(vers ? "Peut désormais gérer les accès" : "Ne gère plus les accès");
            listeAcces();
          }).catch(function (e) { toast(e.message); });
        });
      });

      zone.querySelectorAll("[data-reinit]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("Fabriquer un nouveau mot de passe pour " + b.dataset.reinit + " ?\n\nL'ancien cessera aussitôt de fonctionner.")) return;
          pub.reinitialiseUtilisateur(b.dataset.reinit).then(function (r) {
            montreMotDePasse(r.email, r.motDePasse);
            listeAcces();
          }).catch(function (e) { toast(e.message); });
        });
      });

      zone.querySelectorAll("[data-retire]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!confirm("Retirer l'accès de " + b.dataset.retire + " ?\n\nCette personne ne pourra plus modifier le site.")) return;
          pub.retireUtilisateur(b.dataset.retire).then(function () {
            toast("Accès retiré");
            listeAcces();
          }).catch(function (e) { toast(e.message); });
        });
      });
    }).catch(function (e) {
      zone.innerHTML = '<p class="erreur-chargement">' + echap(e.message) + "</p>";
    });
  }

  /* ------------------------------------------------------------- initialisation */

  var pub = window.GapreePublication;

  document.querySelectorAll(".onglets button").forEach(function (b) {
    b.addEventListener("click", function () {
      vue = { type: "liste", rubrique: b.dataset.rubrique };
      rendre();
    });
  });

  function videBrouillon(question) {
    if (publicationBloque("La publication en cours ne peut plus être arrêtée : attendez qu'elle se termine.")) return;
    if (!confirm(question)) return;
    /* N'efface que ce que cette page connaît : ce qu'un autre onglet vient
       d'enregistrer reste, et s'affiche aussitôt. */
    conflitsSignales = [];
    appliqueIci(Object.keys(aplatit(surcouche)).map(function (cle) { return { cle: cle, retire: true }; }))
      .then(function () {
        toast("Modifications effacées");
        rendre();
      });
  }

  document.getElementById("btn-reinit").addEventListener("click", function () {
    videBrouillon("Effacer toutes les modifications de démonstration faites sur ce navigateur ?");
  });

  document.getElementById("btn-annule-brouillon").addEventListener("click", function () {
    videBrouillon("Effacer les modifications qui n'ont pas encore été publiées ?");
  });

  /* Sans cette enveloppe, l'événement du clic arriverait dans le premier
     paramètre et serait pris pour une seconde tentative : la demande de
     confirmation sauterait et le rattrapage ne se déclencherait jamais. */
  document.getElementById("btn-publier").addEventListener("click", function () { publieMaintenant(); });

  document.getElementById("btn-deconnexion").addEventListener("click", function () {
    if (nombreEnAttente() > 0 && !confirm("Des modifications ne sont pas publiées. Se déconnecter quand même ?")) return;
    pub.deconnecte().then(function () { window.location.reload(); });
  });

  window.addEventListener("beforeunload", function (e) {
    if (pub.estConnecte() && nombreEnAttente() > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function chargeContenu() {
    Promise.all([
      fetch("contenu.json", { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      chargeSurcouche()
    ])
      .then(function (deux) {
        donnees = deux[0];
        surcouche = deux[1];
        oublieLesPubliees(donnees.revision);
        rendre();
        suisLaMiseEnLigne();
      })
      .catch(function () {
        app.innerHTML = '<p class="erreur-chargement">Le contenu du site n\'a pas pu être chargé. Vérifiez la connexion internet, puis rechargez la page.</p>';
      });
  }

  function ouvreEspace() {
    var moi = pub.utilisateur();
    document.getElementById("connexion").hidden = true;
    document.getElementById("changer-mdp").hidden = true;
    document.getElementById("espace").hidden = false;
    if (pub.estConnecte()) {
      document.getElementById("bandeau-demo").hidden = true;
      document.getElementById("btn-deconnexion").hidden = false;
      var qui = document.getElementById("entete-qui");
      qui.textContent = moi.email;
      qui.hidden = false;
      document.getElementById("onglet-acces").hidden = !moi.admin;
    }
    chargeContenu();
  }

  /* Un mot de passe provisoire doit être remplacé avant d'entrer. */
  function demandeNouveauMotDePasse() {
    var ecran = document.getElementById("changer-mdp");
    var erreur = document.getElementById("erreur-mdp");
    document.getElementById("connexion").hidden = true;
    ecran.hidden = false;
    document.getElementById("ch-mdp-1").focus();

    document.getElementById("form-mdp").addEventListener("submit", function (e) {
      e.preventDefault();
      var a = document.getElementById("ch-mdp-1").value;
      var b = document.getElementById("ch-mdp-2").value;
      erreur.hidden = true;
      if (a !== b) {
        erreur.textContent = "Les deux mots de passe ne sont pas identiques.";
        erreur.hidden = false;
        return;
      }
      pub.changeMotDePasse(a).then(ouvreEspace).catch(function (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
      });
    });
  }

  function apresConnexion() {
    var moi = pub.utilisateur();
    if (moi && moi.doitChangerMotDePasse) return demandeNouveauMotDePasse();
    ouvreEspace();
  }

  function ecranConnexion() {
    var connexion = document.getElementById("connexion");
    var erreur = document.getElementById("erreur-connexion");
    var bouton = document.getElementById("btn-connexion");
    connexion.hidden = false;
    document.getElementById("ch-email").focus();

    document.getElementById("form-connexion").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("ch-email").value;
      var champMdp = document.getElementById("ch-mdp");
      erreur.hidden = true;
      bouton.disabled = true;
      bouton.textContent = "Vérification…";
      pub.connecte(email, champMdp.value)
        .then(apresConnexion)
        .catch(function (err) {
          erreur.textContent = err.message;
          erreur.hidden = false;
          champMdp.value = "";
          champMdp.focus();
        })
        .then(function () {
          bouton.disabled = false;
          bouton.textContent = "Entrer";
        });
    });
  }

  if (pub.estArme()) {
    pub.reprendSession().then(function (ouverte) {
      if (ouverte) return apresConnexion();
      ecranConnexion();
    });
  } else {
    /* Aucun serveur configuré : espace ouvert, en démonstration. */
    ouvreEspace();
  }
})();
