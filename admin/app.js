/* Espace d'administration Gâprée : version de démonstration.
   Le contenu réel du site est chargé depuis /admin/contenu.json (généré par Jekyll)
   et le texte des articles depuis les fichiers source du dépôt public.
   Les modifications sont enregistrées dans le navigateur (localStorage) pour
   tester l'interface ; la publication réelle sera branchée à la mise en service. */

(function () {
  "use strict";

  var DEPOT_RAW = "https://raw.githubusercontent.com/davidlotaut/gapree-website/main/";
  var CLE_DEMO = "gapree-demo-admin";
  var TAILLE_PHOTO_MAX = 4 * 1024 * 1024;

  var app = document.getElementById("app");
  var donnees = null;
  var vue = { type: "liste", rubrique: "actualites" };

  /* ------------------------------------------------------------------ outils */

  function echap(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function litSurcouche() {
    try {
      var brut = JSON.parse(localStorage.getItem(CLE_DEMO) || "{}");
      return {
        modifies: brut.modifies || {},
        nouveaux: brut.nouveaux || { actualites: [], talents: [], elus: [] },
        supprimes: brut.supprimes || [],
        reglages: brut.reglages || {}
      };
    } catch (e) {
      return { modifies: {}, nouveaux: { actualites: [], talents: [], elus: [] }, supprimes: [], reglages: {} };
    }
  }

  function ecritSurcouche(s) {
    localStorage.setItem(CLE_DEMO, JSON.stringify(s));
  }

  var surcouche = litSurcouche();

  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  function dateFr(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    var j = parseInt(p[2], 10);
    return (j === 1 ? "1er" : j) + " " + (MOIS[parseInt(p[1], 10) - 1] || "") + " " + p[0];
  }

  function urlImage(chemin) {
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

  var cacheTextes = {};
  function chargeTexte(item) {
    if (typeof item.texte === "string") return Promise.resolve(item.texte);
    if (cacheTextes[item.chemin] !== undefined) return Promise.resolve(cacheTextes[item.chemin]);
    return fetch(DEPOT_RAW + item.chemin)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (brut) {
        var texte = separeFrontMatter(brut);
        cacheTextes[item.chemin] = texte;
        return texte;
      });
  }

  /* --------------------------------------------------------- fusion du contenu */

  function estSupprime(chemin) { return surcouche.supprimes.indexOf(chemin) !== -1; }

  function listeFusionnee(rubrique) {
    var base = (donnees[rubrique] || []).filter(function (x) { return !estSupprime(x.chemin); })
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

  function trouve(rubrique, chemin) {
    return listeFusionnee(rubrique).filter(function (x) { return x.chemin === chemin; })[0] || null;
  }

  function reglagesFusionnes(nom) {
    return Object.assign({}, donnees.reglages[nom] || {}, surcouche.reglages[nom] || {});
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
    return '<div class="champ"><label for="ch-image">' + libelle + "</label>" +
      (valeur ? '<img class="photo-actuelle" id="photo-actuelle" src="' + echap(urlImage(valeur)) + '" alt="">' :
        '<img class="photo-actuelle" id="photo-actuelle" src="" alt="" hidden>') +
      '<input type="file" id="ch-image" accept="image/*">' +
      '<p class="aide">Choisissez une photo depuis votre ordinateur (moins de 4 Mo).' +
      (valeur ? ' <button type="button" class="lien-reinit" id="btn-retire-photo">Retirer la photo</button>' : "") + "</p></div>";
  }

  function rendEditeurArticle(rubrique, chemin) {
    var lib = LIBELLES[rubrique];
    var creation = !chemin;
    var item = creation
      ? { chemin: "nouveau:" + rubrique + ":" + Date.now(), titre: "", date: new Date().toISOString().slice(0, 10), image: null, video: null, texte: "" }
      : trouve(rubrique, chemin);
    if (!item) { vue = { type: "liste", rubrique: rubrique }; return rendre(); }

    app.innerHTML = '<button type="button" class="retour-liste" id="btn-retour">&larr; ' + lib.titre + "</button>" +
      '<div class="editeur"><div class="editeur-form">' +
      '<div class="champ"><label for="ch-titre">Titre</label><input type="text" id="ch-titre" value="' + echap(item.titre) + '"></div>' +
      '<div class="champ"><label for="ch-date">Date</label><input type="date" id="ch-date" value="' + echap(item.date) + '"></div>' +
      (rubrique === "talents" ? '<div class="champ"><label for="ch-soustitre">Sous-titre</label><input type="text" id="ch-soustitre" value="' + echap(item.sous_titre || "") + '"><p class="aide">Le métier ou l\'activité. Exemple : Apicultrice au bourg.</p></div>' : "") +
      champPhoto(item.image, "Photo") +
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
      texte: document.getElementById("ch-texte"),
      image: item.image || null
    };

    function apercu() {
      var html = "<h1>" + echap(refs.titre.value || "(sans titre)") + "</h1>";
      html += '<p class="apercu-meta">' + (rubrique === "actualites"
        ? "Publié le " + dateFr(refs.date.value)
        : echap(refs.sousTitre && refs.sousTitre.value || "")) + "</p>";
      if (refs.image) html += '<img class="apercu-image" src="' + echap(urlImage(refs.image)) + '" alt="">';
      html += rendMarkdown(refs.texte.value);
      document.getElementById("apercu").innerHTML = html;
    }

    ["input", "change"].forEach(function (ev) {
      [refs.titre, refs.date, refs.sousTitre, refs.video, refs.texte].forEach(function (el) {
        if (el) el.addEventListener(ev, apercu);
      });
    });

    var inputImage = document.getElementById("ch-image");
    inputImage.addEventListener("change", function () {
      var f = inputImage.files[0];
      if (!f) return;
      if (f.size > TAILLE_PHOTO_MAX) { toast("Photo trop lourde (4 Mo maximum)"); inputImage.value = ""; return; }
      var lecteur = new FileReader();
      lecteur.onload = function () {
        refs.image = lecteur.result;
        var img = document.getElementById("photo-actuelle");
        img.src = refs.image;
        img.hidden = false;
        apercu();
      };
      lecteur.readAsDataURL(f);
    });

    var btnRetirePhoto = document.getElementById("btn-retire-photo");
    if (btnRetirePhoto) btnRetirePhoto.addEventListener("click", function () {
      refs.image = null;
      document.getElementById("photo-actuelle").hidden = true;
      apercu();
    });

    function retourListe() { vue = { type: "liste", rubrique: rubrique }; rendre(); }
    document.getElementById("btn-retour").addEventListener("click", retourListe);
    document.getElementById("btn-annuler").addEventListener("click", retourListe);

    document.getElementById("btn-enregistrer").addEventListener("click", function () {
      if (!refs.titre.value.trim()) { toast("Le titre est obligatoire"); refs.titre.focus(); return; }
      var valeurs = {
        titre: refs.titre.value.trim(),
        date: refs.date.value || item.date,
        image: refs.image,
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
      toast("Enregistré");
      retourListe();
    });

    var btnSupprimer = document.getElementById("btn-supprimer");
    if (btnSupprimer) btnSupprimer.addEventListener("click", function () {
      if (!confirm("Supprimer « " + item.titre + " » ?")) return;
      if (item.chemin.indexOf("nouveau:") === 0) {
        surcouche.nouveaux[rubrique] = surcouche.nouveaux[rubrique].filter(function (x) { return x.chemin !== item.chemin; });
      } else {
        surcouche.supprimes.push(item.chemin);
        delete surcouche.modifies[item.chemin];
      }
      ecritSurcouche(surcouche);
      toast("Supprimé");
      retourListe();
    });

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
          (m.photo ? '<img class="elu-photo" src="' + echap(urlImage(m.photo)) + '" alt="">'
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
      if (f.size > TAILLE_PHOTO_MAX) { toast("Photo trop lourde (4 Mo maximum)"); inputImage.value = ""; return; }
      var lecteur = new FileReader();
      lecteur.onload = function () {
        photo = lecteur.result;
        var img = document.getElementById("photo-actuelle");
        img.src = photo;
        img.hidden = false;
      };
      lecteur.readAsDataURL(f);
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
      toast("Enregistré");
      retour();
    });

    var btnSupprimer = document.getElementById("btn-supprimer");
    if (btnSupprimer) btnSupprimer.addEventListener("click", function () {
      if (!confirm("Retirer « " + item.nom + " » du trombinoscope ?")) return;
      if (item.chemin.indexOf("nouveau:") === 0) {
        surcouche.nouveaux.elus = surcouche.nouveaux.elus.filter(function (x) { return x.chemin !== item.chemin; });
      } else {
        surcouche.supprimes.push(item.chemin);
        delete surcouche.modifies[item.chemin];
      }
      ecritSurcouche(surcouche);
      toast("Supprimé");
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
      '<p class="aide">La grande photo en haut de la page d\'accueil (moins de 4 Mo).</p></div>' +
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
      if (f.size > TAILLE_PHOTO_MAX) { toast("Photo trop lourde (4 Mo maximum)"); inputPhoto.value = ""; return; }
      var lecteur = new FileReader();
      lecteur.onload = function () {
        photoAccueil = lecteur.result;
        document.getElementById("photo-accueil").src = photoAccueil;
      };
      lecteur.readAsDataURL(f);
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
      surcouche.reglages.accueil = Object.assign({}, accueil, {
        photo: photoAccueil,
        sous_titre: document.getElementById("ch-sous-titre").value.trim(),
        texte: document.getElementById("ch-texte-accueil").value.trim()
      });
      ecritSurcouche(surcouche);
      toast("Enregistré");
    });

    document.getElementById("btn-enregistre-mairie").addEventListener("click", function () {
      surcouche.reglages.mairie = Object.assign({}, mairie, {
        adresse: document.getElementById("ch-adresse").value.trim(),
        telephone: document.getElementById("ch-telephone").value.trim(),
        email: document.getElementById("ch-email").value.trim(),
        horaires: horaires.filter(function (h) { return (h.jours || h.heures || "").trim() !== ""; })
      });
      ecritSurcouche(surcouche);
      toast("Enregistré");
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

  /* Une photo choisie dans l'éditeur arrive en data: ; elle devient un fichier du site. */
  function extraitPhoto(valeur, base, fichiers) {
    if (!valeur || String(valeur).indexOf("data:") !== 0) return valeur || null;
    var m = String(valeur).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    var chemin = "assets/img/" + slug(base) + "-" + Date.now().toString(36) + "." + (EXTENSIONS[m[1]] || "jpg");
    fichiers.push({ chemin: chemin, base64: m[2] });
    return "/" + chemin;
  }

  function fichierArticle(rubrique, valeurs, chemin, fichiers) {
    var image = extraitPhoto(valeurs.image, valeurs.titre, fichiers);
    var lignes = ["---", "title: " + yTexte(valeurs.titre), "date: " + (valeurs.date || "")];
    if (rubrique === "talents" && valeurs.sous_titre) lignes.push("sous_titre: " + yTexte(valeurs.sous_titre));
    if (image) lignes.push("image: " + yTexte(image));
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
    var suppressions = surcouche.supprimes.slice();
    var resume = [];

    ["actualites", "talents"].forEach(function (rubrique) {
      (surcouche.nouveaux[rubrique] || []).forEach(function (v) {
        var nom = rubrique === "actualites"
          ? (v.date || new Date().toISOString().slice(0, 10)) + "-" + slug(v.titre)
          : slug(v.titre);
        fichiers.push(fichierArticle(rubrique, v, "_" + rubrique + "/" + nom + ".md", fichiers));
        resume.push("ajout : " + v.titre);
      });
    });

    (surcouche.nouveaux.elus || []).forEach(function (v) {
      fichiers.push(fichierElu(v, "_elus/" + slug(v.nom) + ".md", fichiers));
      resume.push("ajout : " + v.nom);
    });

    Object.keys(surcouche.modifies).forEach(function (chemin) {
      if (estSupprime(chemin)) return;
      var v = surcouche.modifies[chemin];
      if (chemin.indexOf("_elus/") === 0) {
        fichiers.push(fichierElu(v, chemin, fichiers));
        resume.push("modification : " + v.nom);
      } else {
        var rubrique = chemin.indexOf("_talents/") === 0 ? "talents" : "actualites";
        fichiers.push(fichierArticle(rubrique, v, chemin, fichiers));
        resume.push("modification : " + v.titre);
      }
    });

    if (surcouche.reglages.accueil) {
      fichiers.push(fichierAccueil(reglagesFusionnes("accueil"), fichiers));
      resume.push("page d'accueil");
    }
    if (surcouche.reglages.mairie) {
      fichiers.push(fichierMairie(reglagesFusionnes("mairie")));
      resume.push("coordonnées de la mairie");
    }

    suppressions.forEach(function (chemin) { resume.push("suppression : " + chemin.split("/").pop()); });

    return {
      fichiers: fichiers,
      suppressions: suppressions,
      resume: resume,
      message: "Mise à jour du site depuis l'espace d'administration\n\n" + resume.join("\n") + "\n"
    };
  }

  function nombreEnAttente() {
    var c = surcouche.supprimes.length + Object.keys(surcouche.modifies).length;
    ["actualites", "talents", "elus"].forEach(function (r) { c += (surcouche.nouveaux[r] || []).length; });
    if (surcouche.reglages.accueil) c++;
    if (surcouche.reglages.mairie) c++;
    return c;
  }

  function majBarrePublication() {
    var barre = document.getElementById("barre-publication");
    if (!barre || !window.GapreePublication.estConnecte()) return;
    var n = nombreEnAttente();
    var etat = document.getElementById("etat-publication");
    var bouton = document.getElementById("btn-publier");
    barre.hidden = false;
    bouton.disabled = n === 0;
    etat.textContent = n === 0
      ? "Le site en ligne est à jour."
      : n + (n > 1 ? " modifications en attente de publication." : " modification en attente de publication.");
  }

  function publieMaintenant() {
    var bouton = document.getElementById("btn-publier");
    var changements = construitChangements();
    if (!changements.fichiers.length && !changements.suppressions.length) return;
    if (!confirm("Publier " + changements.resume.length + " modification(s) sur le site en ligne ?\n\n"
      + changements.resume.join("\n"))) return;

    bouton.disabled = true;
    document.getElementById("etat-publication").textContent = "Publication en cours…";
    window.GapreePublication.publie(changements).then(function () {
      surcouche = { modifies: {}, nouveaux: { actualites: [], talents: [], elus: [] }, supprimes: [], reglages: {} };
      ecritSurcouche(surcouche);
      document.getElementById("etat-publication").textContent =
        "Publié. Le site en ligne se met à jour dans une minute environ.";
      toast("Publié sur le site");
      setTimeout(function () { window.location.reload(); }, 60000);
    }).catch(function (e) {
      document.getElementById("etat-publication").textContent = e.message || "La publication a échoué.";
      bouton.disabled = false;
      toast("La publication a échoué");
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
    if (!confirm(question)) return;
    localStorage.removeItem(CLE_DEMO);
    surcouche = litSurcouche();
    toast("Modifications effacées");
    rendre();
  }

  document.getElementById("btn-reinit").addEventListener("click", function () {
    videBrouillon("Effacer toutes les modifications de démonstration faites sur ce navigateur ?");
  });

  document.getElementById("btn-annule-brouillon").addEventListener("click", function () {
    videBrouillon("Effacer les modifications qui n'ont pas encore été publiées ?");
  });

  document.getElementById("btn-publier").addEventListener("click", publieMaintenant);

  function chargeContenu() {
    fetch("contenu.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (json) {
        donnees = json;
        rendre();
      })
      .catch(function () {
        app.innerHTML = '<p class="erreur-chargement">Le contenu du site n\'a pas pu être chargé. Vérifiez la connexion internet, puis rechargez la page.</p>';
      });
  }

  /* En publication réelle, on prévient avant de quitter avec des modifications en attente. */
  window.addEventListener("beforeunload", function (e) {
    if (pub.estConnecte() && nombreEnAttente() > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function ouvreEspace() {
    document.getElementById("connexion").hidden = true;
    document.getElementById("espace").hidden = false;
    if (pub.estConnecte()) document.getElementById("bandeau-demo").hidden = true;
    chargeContenu();
  }

  if (pub.estArme()) {
    /* Publication réelle installée : le mot de passe ouvre l'espace. */
    var connexion = document.getElementById("connexion");
    var erreur = document.getElementById("erreur-connexion");
    var btnConnexion = document.getElementById("btn-connexion");
    connexion.hidden = false;
    document.getElementById("ch-mdp").focus();

    document.getElementById("form-connexion").addEventListener("submit", function (e) {
      e.preventDefault();
      var champ = document.getElementById("ch-mdp");
      erreur.hidden = true;
      btnConnexion.disabled = true;
      btnConnexion.textContent = "Vérification…";
      pub.deverrouille(champ.value)
        .then(function () { return pub.verifieAcces(); })
        .then(ouvreEspace)
        .catch(function (err) {
          pub.oublie();
          erreur.textContent = err && err.message && err.message.indexOf("Accès refusé") === 0
            ? err.message
            : "Mot de passe incorrect.";
          erreur.hidden = false;
          champ.value = "";
          champ.focus();
        })
        .then(function () {
          btnConnexion.disabled = false;
          btnConnexion.textContent = "Entrer";
        });
    });
  } else {
    /* Aucun jeton installé : espace ouvert, en démonstration. */
    ouvreEspace();
  }
})();
