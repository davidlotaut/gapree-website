/* Défaut 13 (contrat 2) : chaque entrée envoyée à /publier peut porter la
   révision du site sur laquelle l'élément a été ouvert (base) ou se déclarer
   nouvelle (nouveau). Le serveur refuse en 409 { erreur, conflits } tout
   fichier changé sur main depuis cette révision, ou déjà présent pour un
   ajout, sauf si main porte déjà exactement le contenu envoyé (réessai d'une
   publication réussie). Sans base ni nouveau (page ouverte avant la mise à
   jour), aucun contrôle, comme avant. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nouveauBanc, ouvreSession, appel } from "./banc.mjs";

const X = "_actualites/2026-10-05-repas-communal.md";
const ARC = "_actualites/2026-09-11-archives.md";
const ACC = "_data/accueil.yml";
const DEPART = {
  [X]: "---\ntitle: \"Repas communal\"\ndate: 2026-10-05\n---\nLe repas aura lieu à 12h.\n",
  [ARC]: "---\ntitle: \"Archives\"\ndate: 2026-09-11\n---\nLes bulletins.\n",
  [ACC]: "photo: \"/assets/img/ancienne.jpg\"\nsous_titre: \"Commune de l'Orne\"\n"
};
const article = (titre, texte) => "---\ntitle: \"" + titre + "\"\ndate: 2026-10-05\n---\n" + texte + "\n";

async function deuxPersonnes() {
  const banc = nouveauBanc(DEPART);
  const camille = await ouvreSession(banc, "camille", false);
  const autre = await ouvreSession(banc, "autre", true);
  return { banc, camille, autre, R0: banc.github.tete() };
}

const publie = (banc, jeton, corps) => appel(banc.env, "POST", "/publier", Object.assign({ message: "essai" }, corps), { jeton });

test("une modification ouverte avant celle d'une autre personne est refusée en la nommant, sans rien écraser", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  const a = await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas communal", "Le repas aura lieu à 12h30."), base: R0 }] });
  assert.equal(a.statut, 200, JSON.stringify(a.d));
  const apresA = banc.github.tete();
  const b = await publie(banc, autre, { fichiers: [{ chemin: X, texte: article("Repas communal du 12 octobre", "Le repas aura lieu à 12h."), base: R0 }] });
  assert.equal(b.statut, 409, JSON.stringify(b.d));
  assert.deepEqual(b.d.conflits, [X]);
  assert.ok(b.d.erreur.includes(X), b.d.erreur);
  assert.equal(banc.github.tete(), apresA, "rien n'a été publié");
  assert.match(banc.github.lit(X), /12h30/, "la correction de Camille est gardée");
});

test("les réglages de l'accueil suivent la même règle", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  const a = await publie(banc, camille, { fichiers: [{ chemin: ACC, texte: DEPART[ACC].replace("ancienne", "nouvelle"), base: R0 }] });
  assert.equal(a.statut, 200);
  const b = await publie(banc, autre, { fichiers: [{ chemin: ACC, texte: DEPART[ACC].replace("Commune de l'Orne", "Bienvenue"), base: R0 }] });
  assert.equal(b.statut, 409);
  assert.deepEqual(b.d.conflits, [ACC]);
  assert.match(banc.github.lit(ACC), /nouvelle\.jpg/);
});

test("retirer un article modifié entre-temps par quelqu'un d'autre est refusé", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  const a = await publie(banc, autre, { fichiers: [{ chemin: ARC, texte: article("Archives (corrigé)", "Les bulletins."), base: R0 }] });
  assert.equal(a.statut, 200);
  const b = await publie(banc, camille, { suppressions: [{ chemin: ARC, base: R0 }] });
  assert.equal(b.statut, 409, JSON.stringify(b.d));
  assert.deepEqual(b.d.conflits, [ARC]);
  assert.match(banc.github.lit(ARC), /corrigé/);
});

test("réécrire un article retiré entre-temps par quelqu'un d'autre est refusé", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  const a = await publie(banc, camille, { suppressions: [{ chemin: ARC, base: R0 }] });
  assert.equal(a.statut, 200);
  const b = await publie(banc, autre, { fichiers: [{ chemin: ARC, texte: article("Archives (corrigé)", "x"), base: R0 }] });
  assert.equal(b.statut, 409, JSON.stringify(b.d));
  assert.deepEqual(b.d.conflits, [ARC]);
  assert.equal(banc.github.lit(ARC), undefined, "l'article reste retiré");
});

test("un ajout sur un nom déjà pris est refusé, un ajout sur un nom libre passe", async () => {
  const { banc, camille } = await deuxPersonnes();
  const pris = await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas communal", "Photos à venir."), nouveau: true }] });
  assert.equal(pris.statut, 409, JSON.stringify(pris.d));
  assert.deepEqual(pris.d.conflits, [X]);
  assert.match(banc.github.lit(X), /12h\./);
  const libre = await publie(banc, camille, { fichiers: [{ chemin: "_actualites/2026-10-05-repas-communal-2.md", texte: article("Repas communal", "Photos."), nouveau: true }] });
  assert.equal(libre.statut, 200, JSON.stringify(libre.d));
});

test("le réessai d'une publication réussie (réponse perdue) est accepté sans second enregistrement", async () => {
  const { banc, camille, R0 } = await deuxPersonnes();
  const corps = {
    fichiers: [
      { chemin: X, texte: article("Repas communal", "Le repas aura lieu à 12h30 🍎, salle des fêtes."), base: R0 },
      { chemin: "_actualites/2026-10-06-fete.md", texte: article("Fête", "Venez nombreux."), nouveau: true },
      { chemin: "assets/img/fete-mgx1-ab12c.jpg", base64: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10]).toString("base64"), nouveau: true }
    ],
    suppressions: [{ chemin: ARC, base: R0 }]
  };
  const premier = await publie(banc, camille, corps);
  assert.equal(premier.statut, 200, JSON.stringify(premier.d));
  const apres = banc.github.tete();
  const commits = banc.github.nombreCommits();
  const reessai = await publie(banc, camille, corps);
  assert.equal(reessai.statut, 200, JSON.stringify(reessai.d));
  assert.deepEqual(reessai.d, { ok: true, inchange: true });
  assert.equal(banc.github.tete(), apres);
  assert.equal(banc.github.nombreCommits(), commits);
});

test("deux personnes sur deux éléments différents publient toutes les deux", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  const a = await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas communal", "Texte de Camille."), base: R0 }] });
  const b = await publie(banc, autre, { fichiers: [{ chemin: ARC, texte: article("Archives", "Texte de l'autre compte."), base: R0 }] });
  assert.equal(a.statut, 200);
  assert.equal(b.statut, 200, JSON.stringify(b.d));
  assert.match(banc.github.lit(X), /Camille/);
  assert.match(banc.github.lit(ARC), /autre compte/);
});

test("une page ouverte avant la mise à jour (sans base) publie comme avant, sans contrôle", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas communal", "Texte de Camille."), base: R0 }] });
  const ancienne = await publie(banc, autre, { fichiers: [{ chemin: X, texte: article("Repas", "Ancienne page.") }], suppressions: [ARC] });
  assert.equal(ancienne.statut, 200, JSON.stringify(ancienne.d));
  assert.match(banc.github.lit(X), /Ancienne page/);
  assert.equal(banc.github.lit(ARC), undefined);
});

test("une base égale à la tête de main ne coûte aucune lecture de plus", async () => {
  const { banc, camille, R0 } = await deuxPersonnes();
  banc.github.appels.length = 0;
  const r = await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas communal", "Nouveau."), base: R0 }] });
  assert.equal(r.statut, 200);
  const lectures = banc.github.appels.filter((x) => x.methode === "GET").map((x) => x.p.split("?")[0].replace(/[0-9a-f]{40}/, "*"));
  assert.deepEqual(lectures, ["/git/ref/heads/main", "/git/commits/*", "/git/trees/*"]);
});

test("une base inconnue de GitHub fait refuser l'entrée, faute de pouvoir la vérifier", async () => {
  const { banc, camille } = await deuxPersonnes();
  const avant = banc.github.tete();
  const r = await publie(banc, camille, { fichiers: [{ chemin: X, texte: article("Repas", "x"), base: "f".repeat(40) }] });
  assert.equal(r.statut, 409, JSON.stringify(r.d));
  assert.deepEqual(r.d.conflits, [X]);
  assert.equal(banc.github.tete(), avant);
});

test("une base illisible est refusée avant tout appel à GitHub", async () => {
  const { banc, camille } = await deuxPersonnes();
  for (const base of ["abc", "../../../../user", 42, { sha: "a" }, "F".repeat(40), ["a".repeat(40)]]) {
    banc.github.appels.length = 0;
    const r = await publie(banc, camille, { fichiers: [{ chemin: X, texte: "x", base }] });
    assert.equal(r.statut, 400, JSON.stringify(base) + " : " + JSON.stringify(r.d));
    assert.equal(banc.github.appels.length, 0, JSON.stringify(base));
    const s = await publie(banc, camille, { suppressions: [{ chemin: ARC, base }] });
    assert.equal(s.statut, 400, JSON.stringify(base));
  }
});

test("un seul conflit fait refuser tout l'envoi, et seul le fichier en cause est nommé", async () => {
  const { banc, camille, autre, R0 } = await deuxPersonnes();
  await publie(banc, autre, { fichiers: [{ chemin: X, texte: article("Repas communal", "Version de l'autre compte."), base: R0 }] });
  const r = await publie(banc, camille, {
    fichiers: [
      { chemin: X, texte: article("Repas communal", "Version de Camille."), base: R0 },
      { chemin: ACC, texte: DEPART[ACC].replace("ancienne", "nouvelle"), base: R0 }
    ]
  });
  assert.equal(r.statut, 409);
  assert.deepEqual(r.d.conflits, [X]);
  assert.match(banc.github.lit(ACC), /ancienne/, "le fichier sans conflit n'est pas publié seul");
});

test("une publication arrivée entre la lecture et l'écriture n'est pas écrasée, et le réessai est refusé", async () => {
  const { banc, camille, R0 } = await deuxPersonnes();
  banc.github.avantMiseAJour = () => banc.github.publieDirect({ [X]: article("Repas communal", "Arrivé pendant l'envoi.") });
  const corps = { fichiers: [{ chemin: X, texte: article("Repas communal", "Version de Camille."), base: R0 }] };
  const r = await publie(banc, camille, corps);
  assert.notEqual(r.statut, 200);
  assert.match(banc.github.lit(X), /Arrivé pendant l'envoi/);
  const reessai = await publie(banc, camille, corps);
  assert.equal(reessai.statut, 409, JSON.stringify(reessai.d));
  assert.deepEqual(reessai.d.conflits, [X]);
});
