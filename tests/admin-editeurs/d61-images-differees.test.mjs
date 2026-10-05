/* Défaut 61 : la liste de l'administration chargeait d'emblée la photo en
   pleine taille de chaque article (10,9 Mo à la première ouverture), et de
   même l'éditeur et l'aperçu d'un reportage. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

function differees(images) {
  assert.ok(images.length > 0, "aucune image trouvée");
  for (const img of images) {
    assert.equal(img.getAttribute("loading"), "lazy", img.className + " sans loading=lazy");
    assert.equal(img.getAttribute("decoding"), "async", img.className + " sans decoding=async");
  }
}

test("liste des actualités : vignettes en chargement différé", async () => {
  const b = await ouvreBanc();
  differees(b.document.querySelectorAll(".ligne-vignette"));
  b.ferme();
});

test("éditeur et aperçu d'un article à plusieurs photos : images en chargement différé", async () => {
  const b = await ouvreBanc();
  b.ouvre("_actualites/2026-10-05-ronde.md");
  await b.pause(10);
  differees(b.document.querySelectorAll(".photo-vignette"));
  differees(b.el("apercu").querySelectorAll("img"));
  b.ferme();
});

test("aperçu d'un article à une seule photo : image en chargement différé", async () => {
  const b = await ouvreBanc();
  b.ouvre("_actualites/2026-09-11-messe.md");
  await b.pause(10);
  differees(b.el("apercu").querySelectorAll("img"));
  b.ferme();
});
