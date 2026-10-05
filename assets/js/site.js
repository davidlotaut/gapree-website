/* Confort de lecture des photos, rien de plus : les flèches qui font défiler
   les bandes, et le clavier dans la vue en grand.

   Tout le reste du site fonctionne sans ce fichier. La vue en grand s'ouvre par
   l'adresse de la photo, et les bandes se font glisser au doigt : si ce script
   ne se charge pas, on perd le confort, jamais l'accès aux photos. */
(function () {
  "use strict";

  /* Largeur d'un pas de défilement : une photo, marge comprise. */
  function pas(bande) {
    var premier = bande.querySelector(":scope > *");
    if (!premier) return bande.clientWidth;
    var style = window.getComputedStyle(bande);
    var espace = parseFloat(style.columnGap || style.gap || "0") || 0;
    return premier.getBoundingClientRect().width + espace;
  }

  function fabriqueFleche(sens, libelle, signe) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bande-fleche bande-fleche--" + sens;
    b.setAttribute("aria-label", libelle);
    b.innerHTML = '<span aria-hidden="true">' + signe + "</span>";
    return b;
  }

  function equipe(bande) {
    var cadre = bande.parentNode;
    if (!cadre.classList.contains("bande")) {
      var enveloppe = document.createElement("div");
      enveloppe.className = "bande";
      bande.parentNode.insertBefore(enveloppe, bande);
      enveloppe.appendChild(bande);
      cadre = enveloppe;
    }

    var avant = fabriqueFleche("avant", "Photo précédente", "‹");
    var apres = fabriqueFleche("apres", "Photo suivante", "›");
    cadre.appendChild(avant);
    cadre.appendChild(apres);

    function majEtat() {
      /* Les photos arrivent au fur et à mesure : tant qu'il n'y a rien à faire
         défiler, les flèches restent absentes plutôt que grisées. */
      var defilable = bande.scrollWidth > bande.clientWidth + 4;
      avant.hidden = !defilable;
      apres.hidden = !defilable;
      avant.disabled = bande.scrollLeft <= 2;
      apres.disabled = bande.scrollLeft + bande.clientWidth >= bande.scrollWidth - 2;
    }

    function glisse(direction) {
      bande.scrollBy({ left: direction * pas(bande), behavior: "smooth" });
    }

    avant.addEventListener("click", function () { glisse(-1); });
    apres.addEventListener("click", function () { glisse(1); });
    bande.addEventListener("scroll", majEtat, { passive: true });
    window.addEventListener("resize", majEtat);
    /* Chaque photo qui finit de charger change la largeur de la bande. */
    if (window.ResizeObserver) new ResizeObserver(majEtat).observe(bande);
    bande.querySelectorAll("img").forEach(function (img) {
      if (!img.complete) img.addEventListener("load", majEtat, { once: true });
    });
    majEtat();
  }

  function equipeTout() {
    var bandes = document.querySelectorAll(".galerie, .carte-photos");
    for (var i = 0; i < bandes.length; i++) equipe(bandes[i]);
  }

  /* La vue en grand et le bouton Retour du téléphone. Sans script, flèches et
     « Fermer » sont des ancres : chacune ajoute une page à l'historique, et
     Retour rouvrait les photos une à une. Ici, les flèches remplacent la photo
     affichée, et « Fermer » (ou le fond) revient en arrière quand la vue a été
     ouverte d'un clic sur la bande pendant cette visite : un seul Retour
     quitte ensuite l'article. Arrivé directement sur une photo (lien partagé,
     page rechargée), « Fermer » ramène à la bande sans quitter le site. */
  var ouverteParClic = false;
  /* La flèche qui avait le focus, à retrouver dans la photo suivante. */
  var flecheGardee = null;
  /* La vue affichée avant le dernier changement d'adresse. */
  var vuePrecedente = null;

  function vueOuverte() {
    var id = location.hash.slice(1);
    var vue = id ? document.getElementById(id) : null;
    return vue && vue.classList.contains("visionneuse") ? vue : null;
  }

  document.addEventListener("click", function (e) {
    /* Ctrl, Cmd ou Maj : le navigateur garde la main (nouvel onglet...). */
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var lien = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!lien) return;
    if (lien.classList.contains("galerie-lien")) {
      ouverteParClic = true;
      return;
    }
    if (!lien.closest(".visionneuse")) return;
    e.preventDefault();
    if (lien.classList.contains("visionneuse-fleche")) {
      flecheGardee = document.activeElement === lien
        ? (lien.classList.contains("visionneuse-fleche--avant") ? ".visionneuse-fleche--avant" : ".visionneuse-fleche--apres")
        : null;
      location.replace(lien.href);
    } else if (ouverteParClic) {
      history.back();
    } else {
      location.replace(lien.href);
    }
  });

  /* Le clavier dans la vue en grand : le focus va sur « Fermer » à
     l'ouverture, Tab et Maj+Tab tournent sur les liens de la vue (le reste de
     la page est sous le voile), et à la fermeture le focus revient sur la
     vignette de la dernière photo vue. D'une photo à l'autre, il reste sur la
     flèche qui l'avait : un second appui sur Entrée avance encore au lieu de
     fermer la vue. */
  function liensDe(vue) {
    var tous = vue.querySelectorAll("a[href]");
    var liens = [];
    for (var i = 0; i < tous.length; i++) {
      if (tous[i].getAttribute("tabindex") !== "-1") liens.push(tous[i]);
    }
    return liens;
  }

  function suitLaVue() {
    var vue = vueOuverte();
    if (vue) {
      var cible = (flecheGardee && vue.querySelector(flecheGardee)) || vue.querySelector(".visionneuse-fermer");
      if (cible) cible.focus();
    } else {
      ouverteParClic = false;
      if (vuePrecedente) {
        var vignette = document.querySelector('.galerie-lien[href="#' + vuePrecedente.id + '"]');
        if (vignette) vignette.focus();
      }
    }
    flecheGardee = null;
    vuePrecedente = vue;
  }

  window.addEventListener("hashchange", suitLaVue);

  /* Dans la vue en grand : Tab reste dans la vue, les flèches du clavier
     changent de photo, Échap ferme. Avec Alt, Ctrl ou Cmd, la touche reste au
     navigateur (Alt + flèche gauche, c'est son Retour). */
  document.addEventListener("keydown", function (e) {
    var ouverte = vueOuverte();
    if (!ouverte || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Tab") {
      var liens = liensDe(ouverte);
      if (!liens.length) return;
      var i = liens.indexOf(document.activeElement);
      var dernier = liens.length - 1;
      var suivant = e.shiftKey ? (i <= 0 ? dernier : i - 1) : (i === -1 || i === dernier ? 0 : i + 1);
      e.preventDefault();
      liens[suivant].focus();
      return;
    }
    var lien = null;
    if (e.key === "ArrowLeft") lien = ouverte.querySelector('[rel="prev"]');
    else if (e.key === "ArrowRight") lien = ouverte.querySelector('[rel="next"]');
    else if (e.key === "Escape") lien = ouverte.querySelector(".visionneuse-fermer");
    if (lien) {
      e.preventDefault();
      lien.click();
    }
  });

  function demarre() {
    equipeTout();
    suitLaVue();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarre);
  } else {
    demarre();
  }
})();
