/* Défaut 58 : une adresse web collée dans un article n'était pas cliquable sur
   le site (kramdown ne fait pas de lien d'une adresse nue). Contrat 9 : elle
   s'écrit en lien automatique <https://…>, et l'aperçu la montre en lien. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

const RONDE = "_actualites/2026-10-05-ronde.md";
const OUEST = "https://www.ouest-france.fr/normandie/gapree-61390/gapree-lancien-maire-francois-rattier-medaille-3321c0cb-664e-4723-8710-06a59883895e";
const RATTIER = "Retrouvez l’article de Ouest France ici : " + OUEST;
const corpsDe = (fichier) => fichier.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/\n$/, "");

/* Une adresse que kramdown ne lie pas : ni dans <…>, ni dans [texte](…). */
function adressesNues(corps) {
  const reste = corps.replace(/<https?:\/\/[^\s<>]+>/g, "").replace(/\[[^\]]*\]\((?:[^()\s]|\([^()\s]*\))*\)/g, "");
  return reste.match(/https?:\/\/\S+|www\.\S+/g) || [];
}

async function publieTexte(b, texte) {
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-texte", texte);
  b.clic("btn-enregistrer");
  await b.pause(5);
  return corpsDe(b.fichierPublie(await b.publie(), RONDE));
}

test("l'adresse de l'article Rattier devient un lien automatique", async () => {
  const b = await ouvreBanc();
  const corps = await publieTexte(b, RATTIER);
  assert.equal(corps, "Retrouvez l’article de Ouest France ici : <" + OUEST + ">");
  assert.deepEqual(adressesNues(corps), []);
  b.ferme();
});

test("la ponctuation qui suit reste hors du lien, une parenthèse équilibrée reste dedans", async () => {
  const b = await ouvreBanc();
  const corps = await publieTexte(b,
    "Voir https://a.fr/page. Puis https://b.fr/x, et (https://c.fr/y) ou https://d.fr/z !\n" +
    "Fiche https://fr.wikipedia.org/wiki/Gâprée_(Orne) et **https://e.fr/gras**");
  assert.match(corps, /Voir <https:\/\/a\.fr\/page>\. Puis <https:\/\/b\.fr\/x>, et \(<https:\/\/c\.fr\/y>\) ou <https:\/\/d\.fr\/z> !/);
  assert.match(corps, /Fiche <https:\/\/fr\.wikipedia\.org\/wiki\/Gâprée_\(Orne\)> et \*\*<https:\/\/e\.fr\/gras>\*\*/);
  assert.deepEqual(adressesNues(corps), []);
  b.ferme();
});

test("une adresse déjà en lien n'est pas touchée ; une adresse en www devient un lien qui garde son texte", async () => {
  const b = await ouvreBanc();
  const corps = await publieTexte(b, "Le [site de la préfecture](https://www.orne.gouv.fr) et <https://b.fr>.\nTél : 02 33 80 60 31\nwww.orne.gouv.fr");
  assert.match(corps, /Le \[site de la préfecture\]\(https:\/\/www\.orne\.gouv\.fr\) et <https:\/\/b\.fr>\./);
  assert.match(corps, /\n\[www\.orne\.gouv\.fr\]\(https:\/\/www\.orne\.gouv\.fr\)$/);
  assert.deepEqual(adressesNues(corps), []);
  b.ferme();
});

test("l'aperçu montre l'adresse en lien, ponctuation dehors", async () => {
  const b = await ouvreBanc();
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-texte", RATTIER + "\n\nPréfecture : www.orne.gouv.fr. Voir aussi https://a.fr/page.");
  const apercu = b.el("apercu").innerHTML;
  assert.ok(apercu.includes('<a href="' + OUEST + '">' + OUEST + "</a>"), apercu);
  assert.ok(apercu.includes('<a href="https://www.orne.gouv.fr">www.orne.gouv.fr</a>.'), apercu);
  assert.ok(apercu.includes('<a href="https://a.fr/page">https://a.fr/page</a>.'), apercu);
  b.ferme();
});

test("aller-retour : l'éditeur rouvert montre les adresses telles que collées, et republie à l'identique", async () => {
  const b = await ouvreBanc();
  const texte = RATTIER + "\n\n(voir https://c.fr/y) et www.orne.gouv.fr.";
  b.ouvre(RONDE);
  await b.pause(10);
  b.saisit("ch-texte", texte);
  b.clic("btn-enregistrer");
  await b.pause(5);
  const fichier = b.fichierPublie(await b.publie(), RONDE);
  b.ferme();

  const b2 = await ouvreBanc();
  b2.raw.textes[RONDE] = fichier;
  b2.ouvre(RONDE);
  await b2.pause(10);
  assert.equal(b2.el("ch-texte").value, texte);
  b2.saisit("ch-titre", "Ronde classique ornaise");
  b2.clic("btn-enregistrer");
  await b2.pause(5);
  assert.equal(b2.fichierPublie(await b2.publie(), RONDE).split("\n---\n")[1], fichier.split("\n---\n")[1]);
  b2.ferme();
});
