// Outils communs aux tests du lot site : lecture des fichiers du dépôt,
// lecture sommaire de _config.yml et repérage des sorties Liquid placées
// dans un attribut HTML. Jekyll n'est pas installé : ces tests lisent les
// gabarits tels qu'ils sont écrits, sans les construire.
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function lit(chemin) {
  return readFileSync(join(RACINE, chemin), "utf8");
}

export function existe(chemin) {
  return existsSync(join(RACINE, chemin));
}

export function taille(chemin) {
  return statSync(join(RACINE, chemin)).size;
}

/* Texte provisoire qui ne doit jamais paraître sur une page publiée. */
export const PROVISOIRE = /à compléter|à préciser|à définir|à confirmer|TODO|XXX|\[\.\.\.\]|\[nom|\[date|\[JJ/i;

/* Le bloc YAML entre les deux premières lignes « --- », en texte brut. */
export function frontMatter(source) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(source);
  return m ? m[1] : "";
}

/* Le corps d'une page, sans son front matter. */
export function corps(source) {
  const m = /^---\n[\s\S]*?\n---\n/.exec(source);
  return m ? source.slice(m[0].length) : source;
}

/* Les lignes indentées qui suivent une clé de premier niveau de _config.yml
   (« cle: » seule sur sa ligne), sans l'indentation. */
export function sousCles(config, cle) {
  const lignes = config.split("\n");
  const debut = lignes.findIndex((l) => l === cle + ":" || l.startsWith(cle + ": #") || l.startsWith(cle + ":  "));
  if (debut === -1) return null;
  const res = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i];
    if (l.trim() === "" || l.trim().startsWith("#")) continue;
    if (!/^\s/.test(l)) break;
    res.push(l.trim());
  }
  return res;
}

function numeroDeLigne(source, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (source[i] === "\n") n++;
  return n;
}

/* Saute une balise Liquid qui commence en i ; un bloc comment est sauté
   jusqu'à son endcomment. Rend l'index qui suit. */
function sauteLiquid(source, i) {
  const sortie = source[i + 1] === "{";
  const fin = source.indexOf(sortie ? "}}" : "%}", i + 2);
  if (fin === -1) return source.length;
  if (!sortie) {
    const contenu = source.slice(i + 2, fin).replace(/^-/, "").trim();
    if (/^comment\b/.test(contenu)) {
      const re = /\{%-?\s*endcomment\s*-?%\}/g;
      re.lastIndex = fin;
      const m = re.exec(source);
      if (m) return m.index + m[0].length;
    }
  }
  return fin + 2;
}

/* Chaque attribut HTML écrit nom="valeur" dans un gabarit : la balise qui le
   porte, son nom, sa valeur brute, les sorties Liquid {{ ... }} qu'il
   contient et sa ligne. Le Liquid est sauté d'un bloc : un « > » ou un
   guillemet écrit dans une balise Liquid ne coupe ni la balise HTML ni
   l'attribut. Les commentaires Liquid et HTML sont ignorés. */
export function attributs(source) {
  const res = [];
  const n = source.length;
  let i = 0;
  let balise = null;
  while (i < n) {
    if (source.startsWith("{{", i) || source.startsWith("{%", i)) {
      i = sauteLiquid(source, i);
      continue;
    }
    if (balise === null) {
      if (source.startsWith("<!--", i)) {
        const fin = source.indexOf("-->", i + 4);
        i = fin === -1 ? n : fin + 3;
        continue;
      }
      const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(source.slice(i, i + 40));
      if (m) {
        balise = m[1].toLowerCase();
        i += m[0].length;
        continue;
      }
      i++;
      continue;
    }
    if (source[i] === ">") {
      balise = null;
      i++;
      continue;
    }
    const a = /^([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"/.exec(source.slice(i, i + 80));
    if (a && /[\s"'}]/.test(source[i - 1] || " ")) {
      const nom = a[1].toLowerCase();
      let j = i + a[0].length;
      const debut = j;
      const sorties = [];
      while (j < n && source[j] !== '"') {
        if (source.startsWith("{{", j)) {
          const fin = source.indexOf("}}", j + 2);
          sorties.push(source.slice(j + 2, fin).replace(/^-/, "").replace(/-$/, "").trim());
          j = fin + 2;
          continue;
        }
        if (source.startsWith("{%", j)) {
          j = sauteLiquid(source, j);
          continue;
        }
        j++;
      }
      res.push({ balise, nom, valeur: source.slice(debut, j), sorties, ligne: numeroDeLigne(source, i) });
      i = j + 1;
      continue;
    }
    i++;
  }
  return res;
}

/* Découpe une sortie Liquid en expression et filtres, sans couper dans une
   chaîne entre guillemets. */
export function filtres(sortie) {
  const morceaux = [];
  let courant = "";
  let guillemet = null;
  for (const c of sortie) {
    if (guillemet) {
      if (c === guillemet) guillemet = null;
      courant += c;
    } else if (c === '"' || c === "'") {
      guillemet = c;
      courant += c;
    } else if (c === "|") {
      morceaux.push(courant.trim());
      courant = "";
    } else {
      courant += c;
    }
  }
  morceaux.push(courant.trim());
  return { expression: morceaux[0], filtres: morceaux.slice(1).map((f) => f.split(":")[0].trim()) };
}
