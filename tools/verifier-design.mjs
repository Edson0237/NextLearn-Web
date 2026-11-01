/**
 * Les contrôles de la refonte qu'aucun test ne couvre.
 *
 * Trois dérives silencieuses, toutes rencontrées pendant la refonte : une
 * clé de traduction employée dans un gabarit mais absente d'un catalogue,
 * une variable CSS survivante d'une palette disparue, et une icône écrite
 * en caractère plutôt qu'en tracé. Aucune ne casse la compilation ; toutes
 * se voient à l'écran.
 *
 *   node tools/verifier-design.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const fichiers = [];
(function marche(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marche(p);
    else if (/\.(scss|html|ts)$/.test(p)) fichiers.push(p);
  }
})('src');

const lire = (f) => readFileSync(f, 'utf8');
const problemes = [];

// ── 1. Les clés de traduction ──────────────────────────────────────────────
const fr = JSON.parse(lire('public/i18n/fr.json'));
const en = JSON.parse(lire('public/i18n/en.json'));
const cles = new Set();
for (const f of fichiers) {
  const src = lire(f);
  for (const m of src.matchAll(/'([A-Za-z][A-Za-z0-9_]*)'\s*\|\s*t\b/g)) cles.add(m[1]);
  for (const m of src.matchAll(/\btr\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)) cles.add(m[1]);
}
for (const [nom, cat] of [['fr.json', fr], ['en.json', en]]) {
  const absentes = [...cles].filter((k) => !(k in cat)).sort();
  if (absentes.length) problemes.push(`${nom} : ${absentes.length} clé(s) employée(s) mais absente(s) - ${absentes.join(', ')}`);
}
const desync = [
  ...Object.keys(fr).filter((k) => !(k in en)),
  ...Object.keys(en).filter((k) => !(k in fr)),
];
if (desync.length) problemes.push(`fr/en désynchronisés : ${desync.join(', ')}`);

// ── 2. Les variables CSS ───────────────────────────────────────────────────
//
// Celles-ci sont posées en ligne par liaison Angular (`[style.--x]`) ou par
// une liaison d'hôte : aucune déclaration ne les porte dans une feuille.
const POSEES_EN_LIGNE = new Set([
  '--mouse-x', '--mouse-y', '--teinte', '--teinte-fond', '--matiere-color',
  '--chip-color', '--avatar-size', '--cascade-index', '--type-bg', '--type-color',
  '--accent', '--accent-fonce',
  '--type-', // construite par concaténation dans document.model.ts
]);
const definies = new Set();
for (const f of fichiers) {
  for (const m of lire(f).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) definies.add(m[1]);
}
const orphelines = new Map();
for (const f of fichiers) {
  for (const m of lire(f).matchAll(/var\((--[a-z0-9-]+)/g)) {
    if (!definies.has(m[1]) && !POSEES_EN_LIGNE.has(m[1])) {
      if (!orphelines.has(m[1])) orphelines.set(m[1], new Set());
      orphelines.get(m[1]).add(f);
    }
  }
}
for (const [v, ou] of orphelines) {
  problemes.push(`${v} : utilisée sans définition - ${[...ou].join(', ')}`);
}

// ── 3. Les routes à plusieurs segments ─────────────────────────────────────
//
// `router.navigate(['/app', AppRoutes.loginOtp])` traite la constante comme
// **un seul** segment et encode son « / » en %2F. L'URL obtenue
// (`/app/login%2Fotp`) ne correspond à aucune route, et l'écran affiche
// « Page introuvable ». Treize appels étaient dans ce cas - dont la saisie du
// code après connexion, qui rendait l'application inutilisable.
//
// `navigateByUrl('/app/' + AppRoutes.X)` prend le chemin tel quel.
const routes = lire('src/app/core/router/routes/app-routes.ts');
const valeurs = new Map(
  [...routes.matchAll(/static readonly (\w+)\s*=\s*'([^']*)'/g)].map((m) => [m[1], m[2]]),
);
const plusieursSegments = new Set(
  [...valeurs].filter(([, v]) => v.includes('/')).map(([k]) => k),
);
// Tout `navigate([...])` dont le tableau contient une de ces constantes - y
// compris dans un ternaire (`cond ? AppRoutes.home : AppRoutes.pinSetup`, qui
// avait échappé à la première version de cette garde et menait l'étudiant,
// juste après le code reçu par e-mail, sur une page introuvable) - ou un
// constructeur de chemin (`AppRoutes.epreuveDetailPath(id)`).
for (const f of fichiers.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
  const source = lire(f);
  for (const m of source.matchAll(/navigate\(\s*\[([^\]]*)\]/g)) {
    const ligne = source.slice(0, m.index).split('\n').length;
    for (const r of m[1].matchAll(/AppRoutes\.(\w+)(\()?/g)) {
      if (r[2] ? /Path$/.test(r[1]) : plusieursSegments.has(r[1])) {
        problemes.push(
          `${f}:${ligne} : AppRoutes.${r[1]} est un chemin à plusieurs segments - ` +
          `son « / » sera encodé. Utiliser navigateByUrl('/app/' + AppRoutes.${r[1]}${r[2] ? '(…)' : ''}).`,
        );
      }
    }
  }
}

// ── 4. Les icônes en caractère ─────────────────────────────────────────────
//
// Emoji, étoiles, flèches, chevrons typographiques : tout ce qui dessine une
// icône sans passer par `nl-icon`. Les commentaires sont hors sujet - les
// guillemets français y sont légitimes - donc seuls les gabarits et les
// catalogues sont fouillés.
const GLYPHES = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2605}\u{2606}\u{2713}\u{2714}\u{2717}\u{25B6}\u{25C0}\u{2039}\u{203A}]/u;
for (const f of [...fichiers.filter((f) => f.endsWith('.html')), 'public/i18n/fr.json', 'public/i18n/en.json']) {
  // Les commentaires sont blanchis plutôt que retirés : la numérotation des
  // lignes doit rester celle du fichier pour que le message serve à quelque
  // chose. Une flèche dans un commentaire n'est pas une icône.
  const sansCommentaires = lire(f).replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  sansCommentaires.split('\n').forEach((ligne, i) => {
    if (GLYPHES.test(ligne)) problemes.push(`${f}:${i + 1} : icône en caractère - ${ligne.trim().slice(0, 60)}`);
  });
}

if (problemes.length) {
  console.error(`${problemes.length} problème(s) :`);
  for (const p of problemes) console.error('  ' + p);
  process.exit(1);
}
console.log(`Clés i18n : ${cles.size} employées, catalogues de ${Object.keys(fr).length} en phase.`);
console.log(`Variables CSS : ${definies.size} définies, aucune orpheline.`);
console.log(`Routes : ${plusieursSegments.size} à plusieurs segments, toutes naviguées par URL.`);
console.log('Icônes : aucune écrite en caractère.');
