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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", equipeTout);
  } else {
    equipeTout();
  }

  /* Dans la vue en grand : les flèches du clavier changent de photo, Échap ferme. */
  document.addEventListener("keydown", function (e) {
    var ouverte = document.querySelector(".visionneuse:target");
    if (!ouverte) return;
    var lien = null;
    if (e.key === "ArrowLeft") lien = ouverte.querySelector('[rel="prev"]');
    else if (e.key === "ArrowRight") lien = ouverte.querySelector('[rel="next"]');
    else if (e.key === "Escape") lien = ouverte.querySelector(".visionneuse-fermer");
    if (lien) {
      e.preventDefault();
      lien.click();
    }
  });
})();
