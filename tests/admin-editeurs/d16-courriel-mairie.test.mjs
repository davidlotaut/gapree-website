/* Défaut 16 : l'enregistrement des coordonnées de la mairie lisait le champ de
   connexion (même id ch-email), et publiait une adresse vide ou celle du compte
   connecté à la place de celle de la mairie. */
import test from "node:test";
import assert from "node:assert/strict";
import { ouvreBanc } from "./banc.mjs";

async function enregistreTelephone(b) {
  assert.ok(b.onglet("reglages"));
  await b.pause(5);
  b.saisit("ch-telephone", "02 33 99 99 99");
  b.clic("btn-enregistre-mairie");
  await b.pause(5);
}

test("session reprise : l'adresse de la mairie reste celle de la mairie", async () => {
  const b = await ouvreBanc();
  await enregistreTelephone(b);
  assert.equal(b.brouillon().reglages.mairie.email, "ADRESSE_PUBLIQUE_MAIRIE");
  const p = await b.publie();
  const yml = b.fichierPublie(p, "_data/mairie.yml");
  assert.match(yml, /^email: "ADRESSE_PUBLIQUE_MAIRIE"$/m);
  assert.match(yml, /^telephone: "02 33 99 99 99"$/m);
  b.ferme();
});

test("connexion tapée : l'adresse de connexion n'est jamais publiée comme celle de la mairie", async () => {
  const b = await ouvreBanc({ sessionReprise: false });
  b.el("ch-email").value = "COMPTE_DE_CONNEXION";
  b.el("ch-mdp").value = "mot-de-passe-de-test";
  b.el("form-connexion").tire("submit");
  await b.pause(20);
  await enregistreTelephone(b);
  assert.equal(b.brouillon().reglages.mairie.email, "ADRESSE_PUBLIQUE_MAIRIE");
  const p = await b.publie();
  assert.doesNotMatch(b.fichierPublie(p, "_data/mairie.yml"), /COMPTE_DE_CONNEXION/);
  b.ferme();
});

test("le champ courriel des Réglages a un id unique, que son étiquette désigne", async () => {
  const b = await ouvreBanc();
  b.onglet("reglages");
  await b.pause(5);
  const etiquette = b.el("app").querySelectorAll("label").find((l) => /mail/.test(l.attrs.for || ""));
  assert.ok(etiquette, "étiquette du courriel introuvable");
  const id = etiquette.attrs.for;
  assert.equal(b.document.querySelectorAll("#" + id).length, 1, "id en double : " + id);
  assert.equal(b.el(id).value, "ADRESSE_PUBLIQUE_MAIRIE");
  b.ferme();
});
