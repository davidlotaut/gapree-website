/* Crée le tout premier compte d'administration, celui de la mairie.

   Il n'y a pas d'adresse publique pour cela : le compte est écrit directement
   dans la base du serveur, depuis ce poste. Les suivants se créent ensuite
   depuis l'onglet « Accès » de l'espace d'administration.

     node amorcer.mjs mairie.gapree@wanadoo.fr           (serveur en ligne)
     node amorcer.mjs essai@exemple.fr --local           (serveur d'essai local)
*/

import { webcrypto as crypto } from "node:crypto";
import { execFileSync } from "node:child_process";

const ITERATIONS = 310000;

const email = (process.argv[2] || "").trim().toLowerCase();
const local = process.argv.includes("--local");

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("usage : node amorcer.mjs <adresse électronique> [--local]");
  process.exit(1);
}

const base64 = (o) => Buffer.from(o).toString("base64");

function motDePasseGenere() {
  const lettres = "abcdefghjkmnpqrstuvwxyz23456789";
  const t = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += lettres[t[i] % lettres.length];
    if (i === 3 || i === 7) s += "-";
  }
  return s;
}

const motDePasse = motDePasseGenere();
const sel = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(motDePasse), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: sel, iterations: ITERATIONS, hash: "SHA-256" }, base, 256);

const compte = {
  email,
  sel: base64(sel),
  empreinte: base64(bits),
  admin: true,
  cree: new Date().toISOString(),
  aChange: false
};

const args = ["kv", "key", "put", "compte:" + email, JSON.stringify(compte), "--binding", "COMPTES"];
if (local) args.push("--local"); else args.push("--remote");

execFileSync("wrangler", args, { stdio: "inherit" });

console.log("\n────────────────────────────────────────────");
console.log("Compte créé :", email);
console.log("Mot de passe provisoire :", motDePasse);
console.log("────────────────────────────────────────────");
console.log("À transmettre à la mairie. Il sera remplacé à la première connexion.\n");
