// Lancer : npm run test:site
//
// Ce que ce test protège : le `<head>`.
//
// Le passage du site statique à Angular a emporté tout le `<head>` de
// l'ancien `index.html` sauf la favicon. Les icônes ont disparu — une
// centaine de `<i class="fas …">` dans les gabarits, devenues autant
// d'espaces vides — et avec elles la police Poppins, le titre et la
// description.
//
// Rien dans la compilation ne le signale : le build réussit, les tests
// passent, la page s'affiche. Seul un œil sur le site le voit. D'où ce
// garde-fou : il échoue si une de ces lignes repart.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(join(racine, 'src/index.html'), 'utf8');

/** Le contenu de tous les gabarits de composants, concaténé. */
function gabarits() {
  const base = join(racine, 'src/app/Components');
  return readdirSync(base)
    .map((d) => join(base, d, `${d}.html`))
    .filter((f) => {
      try { readFileSync(f); return true; } catch { return false; }
    })
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

describe('Feuilles de style externes', () => {
  test('Font Awesome est chargé', () => {
    assert.match(index, /font-awesome|fontawesome/i);
  });

  test('Poppins est chargée', () => {
    // `--font-family` dans styles.scss la désigne en premier choix : sans le
    // lien, toute la page retombe sur la police système.
    assert.match(index, /family=Poppins/);
  });

  test('les icônes des gabarits ont bien une feuille qui les définit', () => {
    const utilisees = [...gabarits().matchAll(/class="(fa[sbr]|fa-solid|fa-brands)\s/g)];
    if (utilisees.length === 0) return; // plus aucune icône : rien à charger
    assert.match(
      index, /font-awesome|fontawesome/i,
      `${utilisees.length} icônes dans les gabarits, aucune feuille pour les définir`,
    );
  });
});

describe('Métadonnées de la page', () => {
  test('la langue déclarée est le français', () => {
    // Le site est entièrement en français : `lang="en"` fait lire la page
    // avec une voix anglaise par les lecteurs d'écran.
    assert.match(index, /<html lang="fr">/);
  });

  test('le titre nomme le produit', () => {
    const titre = index.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    assert.match(titre, /NextLearn/);
    // « NextLearnWeb » est le nom que le CLI a genere, pas un titre.
    assert.notStrictEqual(titre.trim(), 'NextLearnWeb');
  });

  test('la description existe et dit quelque chose', () => {
    const desc = index.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? '';
    assert.ok(desc.length > 40, `description trop courte : ${desc.length} caractères`);
  });
});
