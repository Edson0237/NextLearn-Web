/**
 * Audit des dépendances entre couches de `src/app` — lecture seule.
 *
 *   node tools/audit-architecture.mjs            # rapport
 *   node tools/audit-architecture.mjs --verifier # code de sortie 1 s'il y a des entorses
 *
 * Règles (voir ARCHITECTURE.md) :
 *   R1  core ne dépend ni de shared ni de features
 *   R2  shared ne dépend pas de features
 *   R3  une feature ne dépend pas d'une autre feature
 *   R4  seul core/ (accès aux données) parle à HttpClient
 *   R5  rien ne dépend de layout/ (l'enveloppe) — c'est elle qui compose les features
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const racine = resolve('src/app');
const fichiers = [];
(function parcourir(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) fichiers.push(p);
  }
})(racine);

const couche = (p) => {
  const r = relative(racine, p).split('/');
  if (r[0] === 'features') return `features/${r[1]}`;
  return r[0].endsWith('.ts') ? 'app' : r[0];
};

const entorses = { R1: [], R2: [], R3: [], R4: [], R5: [] };
for (const f of fichiers) {
  const src = readFileSync(f, 'utf8');
  const de = couche(f);
  for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const cible = resolve(dirname(f), m[1]);
    const vers = couche(cible);
    if (vers === 'layout' && de !== 'layout' && de !== 'app') entorses.R5.push(`${relative(racine, f)} → layout`);
    if (de === 'core' && (vers === 'shared' || vers.startsWith('features/'))) entorses.R1.push(`${relative(racine, f)} → ${vers}`);
    if (de === 'shared' && vers.startsWith('features/')) entorses.R2.push(`${relative(racine, f)} → ${vers}`);
    if (de.startsWith('features/') && vers.startsWith('features/') && de !== vers) entorses.R3.push(`${relative(racine, f)} → ${vers}`);
  }
  if (de !== 'core' && /\binject\(\s*HttpClient\s*\)|private\s+(readonly\s+)?\w+:\s*HttpClient/.test(src)) entorses.R4.push(relative(racine, f));
}

let total = 0;
for (const [r, l] of Object.entries(entorses)) {
  console.log(`${r} : ${l.length} entorse(s)`);
  for (const e of l) console.log('   ' + e);
  total += l.length;
}
console.log(`\nTotal : ${total}`);
if (process.argv.includes('--verifier') && total > 0) process.exit(1);
