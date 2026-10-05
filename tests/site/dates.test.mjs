// Défaut 62 : la date visible d'une carte d'actualité porte l'année. Sans elle,
// dès juillet 2027 la liste montre « 13 juil. » pour l'annonce de 2026 comme
// pour celle du jour ; l'année n'était lue que par les lecteurs d'écran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lit } from "./outils.mjs";

const card = lit("_includes/card.html");

/* Les lignes visibles d'un bloc : celles qui ne sont pas réservées aux
   lecteurs d'écran (visually-hidden) et qui sont masquées pour eux. */
function partieVisible(classe) {
  const m = new RegExp('<p class="' + classe + '">([\\s\\S]*?)</p>').exec(card);
  assert.ok(m, "bloc ." + classe + " introuvable dans card.html");
  return m[1].split("\n").filter((l) => l.includes('aria-hidden="true"')).join("\n");
}

test("62 : la pastille posée sur la photo affiche l'année", () => {
  const visible = partieVisible("card-chip");
  assert.match(visible, /\{\{ item\.date \| date: "%-d" \}\} \{\{ mabr \}\} \{\{ item\.date \| date: "%Y" \}\}/);
});

test("62 : le bloc de date d'une carte sans photo affiche l'année", () => {
  const visible = partieVisible("card-date");
  assert.match(visible, /class="card-date-annee">\{\{ item\.date \| date: "%Y" \}\}</);
  assert.match(lit("assets/css/style.css"), /^\.card-date-annee \{/m, "style de l'année du bloc de date");
});

test("62 : l'année reste aussi dans le texte lu aux lecteurs d'écran", () => {
  assert.equal((card.match(/Publié le \{% include date_fr\.html date=item\.date %\}/g) || []).length, 2);
  assert.match(lit("_includes/date_fr.html"), /\{\{ mois \}\} \{\{ y \}\}/);
});
