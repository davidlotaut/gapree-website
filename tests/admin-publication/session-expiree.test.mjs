/* Défaut 73 : la session de 12 h expire pendant qu'on travaille. Sur un refus
   401 pendant une publication, l'écran de connexion s'affiche sur place, le
   brouillon et l'éditeur ouvert restent intacts ; après reconnexion, Publier
   fonctionne. Exécuté avec le vrai admin/publication.js et un faux serveur. */
import test from "node:test";
import assert from "node:assert/strict";
import { creeMonde, ouvrePage, siteDeDepart, vide } from "./banc.mjs";

const H = "_actualites/2026-10-01-halloween.md";
const A = "_actualites/2026-09-11-archives.md";

/* Un serveur dont la première session expire à la demande. */
function serveur(m) {
  const etat = { valides: new Set(["jeton-1"]), appels: [] };
  m.stock.set("gapree-session", "jeton-1");
  m.serveur = (chemin, methode, corps, entetes) => {
    const jeton = String(entetes.Authorization || "").replace(/^Bearer /, "");
    etat.appels.push({ chemin, jeton });
    const connecte = etat.valides.has(jeton);
    if (chemin === "/connexion") {
      etat.valides.add("jeton-2");
      return { statut: 200, corps: { jeton: "jeton-2", email: corps.email, admin: true, doitChangerMotDePasse: false } };
    }
    if (!connecte) return { statut: 401, corps: { erreur: "Session expirée. Reconnectez-vous." } };
    if (chemin === "/moi") return { statut: 200, corps: { email: "compte-du-banc", admin: true, doitChangerMotDePasse: false } };
    if (chemin === "/journal") return { statut: 200, corps: { ok: true } };
    if (chemin === "/televerser") return { statut: 200, corps: { fichiers: corps.fichiers.map((f, i) => ({ chemin: f.chemin, sha: "blob" + i })) } };
    if (chemin === "/publier") {
      m.publications.push(corps);
      return { statut: 200, corps: m.applique(corps) };
    }
    return { statut: 404, corps: { erreur: "Adresse inconnue." } };
  };
  return etat;
}

async function seReconnecte(p) {
  p.el("ch-email").value = "compte-du-banc";
  p.el("ch-mdp").value = "mot-de-passe";
  p.el("form-connexion").tire("submit");
  await p.attends();
}

test("défaut 73 : un 401 à la publication montre l'écran de connexion sur place, sans rien perdre, et Publier marche après", async () => {
  const m = creeMonde(siteDeDepart());
  const etat = serveur(m);
  const b = vide();
  b.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: "/assets/img/halloween-a1b2c3d4-aaaaa.jpg", alt: null,
    photos: [], video: null, texte: "Rendez-vous le 24 octobre." };
  m.poseBrouillon(b);
  const p = ouvrePage(m, { vraiePublication: true });
  await p.attends();
  assert.equal(p.el("espace").hidden, false);
  p.ouvre(A);
  await p.attends();
  p.saisit("ch-texte", "Saisie en cours, pas encore enregistrée.");

  etat.valides.delete("jeton-1");
  p.clic("btn-publier");
  await p.attends();
  assert.equal(etat.appels.filter((a) => a.chemin === "/publier").length, 1, "aucun nouvel essai sans session");
  assert.equal(p.el("connexion").hidden, false, "l'écran de connexion est affiché");
  assert.equal(p.el("espace").hidden, true);
  assert.match(p.el("erreur-connexion").textContent, /session a expiré/);
  assert.match(p.el("erreur-connexion").textContent, /modifications sont conservées/);
  assert.deepEqual(Object.keys(m.brouillon().modifies), [H], "le brouillon est intact");
  assert.equal(p.retiendrait(), true, "fermer la page maintenant perdrait la saisie : le navigateur prévient");

  await seReconnecte(p);
  assert.equal(p.el("connexion").hidden, true);
  assert.equal(p.el("espace").hidden, false);
  assert.equal(p.el("ch-texte").value, "Saisie en cours, pas encore enregistrée.", "l'éditeur ouvert est resté tel quel");
  assert.equal(p.el("entete-qui").textContent, "compte-du-banc");

  p.clic("btn-publier");
  await p.attends();
  const publications = etat.appels.filter((a) => a.chemin === "/publier");
  assert.equal(publications.length, 2);
  assert.equal(publications[1].jeton, "jeton-2");
  assert.equal(m.publications.length, 1);
  assert.equal(p.etat(), "Mise en ligne en cours : cela prend en général une à trois minutes.");
});

test("défaut 73 : un 401 pendant l'envoi des photos ne dit pas « appuyez à nouveau sur Publier » et ne relance rien", async () => {
  const m = creeMonde(siteDeDepart());
  const etat = serveur(m);
  const b = vide();
  b.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: "data:image/jpeg;base64,UEhPVE8=", alt: null,
    photos: [], video: null, texte: "x" };
  m.poseBrouillon(b);
  const p = ouvrePage(m, { vraiePublication: true });
  await p.attends();
  etat.valides.delete("jeton-1");
  p.clic("btn-publier");
  await p.attends();
  assert.equal(etat.appels.filter((a) => a.chemin === "/televerser").length, 1);
  assert.equal(p.el("connexion").hidden, false);
  assert.doesNotMatch(p.etat(), /appuyez à nouveau sur Publier/);
  await seReconnecte(p);
  p.clic("btn-publier");
  await p.attends();
  assert.equal(m.publications.length, 1);
  assert.match(m.publications[0].fichiers.find((f) => f.chemin === H).texte, /image: "\/assets\/img\/halloween-/);
});

test("défaut 73 : la connexion du démarrage fonctionne toujours, une seule fois par envoi du formulaire", async () => {
  const m = creeMonde(siteDeDepart());
  const etat = serveur(m);
  m.stock.delete("gapree-session");
  const p = ouvrePage(m, { vraiePublication: true });
  await p.attends();
  assert.equal(p.el("connexion").hidden, false);
  await seReconnecte(p);
  assert.equal(etat.appels.filter((a) => a.chemin === "/connexion").length, 1);
  assert.equal(p.el("espace").hidden, false);
  assert.equal(p.etat(), "Le site en ligne est à jour.");
});

test("défaut 73 : le mot de passe ne reste pas dans la page après une connexion réussie", async () => {
  const m = creeMonde(siteDeDepart());
  const etat = serveur(m);
  m.stock.delete("gapree-session");
  const p = ouvrePage(m, { vraiePublication: true });
  await p.attends();
  await seReconnecte(p);
  assert.equal(p.el("ch-mdp").value, "", "vidé dès l'entrée");
  etat.valides.clear();
  const b = vide();
  b.modifies[H] = { titre: "Halloween", date: "2026-10-01", image: "/assets/img/halloween-a1b2c3d4-aaaaa.jpg", alt: null,
    photos: [], video: null, texte: "x" };
  m.poseBrouillon(b);
  p.onglet("talents");
  await p.attends();
  p.ouvre(H);
  await p.attends();
  p.saisit("ch-texte", "Rendez-vous le 24 octobre.");
  p.clic("btn-enregistrer");
  await p.attends();
  p.clic("btn-publier");
  await p.attends();
  assert.equal(p.el("connexion").hidden, false);
  assert.equal(p.el("ch-mdp").value, "", "l'écran de reconnexion ne montre aucun mot de passe");
});
