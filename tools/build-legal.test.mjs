// Lancer : npm run test:legal   (lanceur de tests de Node, sans dépendance)
//
// Ce que ce test protège : deux blocages de publication sur le Play Store.
//
// Play exige une URL publique pour la politique de confidentialité et une
// autre pour la demande de suppression de compte, toutes deux atteignables
// sans installer l'application. Les textes existaient, mais seulement dans
// l'application — ce qui ne compte pas.
//
// Deux choses peuvent casser silencieusement :
//
// 1. Une note interne qui fuit. Les fichiers source portent des commentaires
//    HTML, dont « À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT
//    PUBLICATION ». Publier cela affaiblirait le document publié.
//
// 2. Une divulgation qui disparaît. La politique doit nommer chaque donnée
//    que l'application collecte. Un remaniement du markdown peut en perdre
//    une sans que rien ne le signale, et une politique incomplète est un
//    motif de rejet autant qu'une politique absente.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUGS = ['confidentialite', 'conditions', 'suppression-compte'];
const chemin = (slug) => join(racine, 'public', slug, 'index.html');
// marked échappe les apostrophes et les guillemets en entités : `d&#39;appareil`
// s'affiche correctement mais ne se cherche pas tel quel. Les tests portent sur
// le texte tel qu'il se lit, donc on décode avant de comparer.
const page = (slug) =>
  readFileSync(chemin(slug), 'utf8')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

before(() => {
  // On teste ce que la génération produit, pas une sortie laissée en place.
  execFileSync('node', [join(racine, 'tools', 'build-legal.mjs')], {
    cwd: racine,
    stdio: 'pipe',
  });
});

describe('Pages légales publiées', () => {
  test('existent aux trois URL attendues', () => {
    for (const slug of SLUGS) {
      assert.ok(existsSync(chemin(slug)), `${slug} manquante`);
    }
  });

  test('ne laissent fuir aucune note interne', () => {
    for (const slug of SLUGS) {
      assert.ok(!page(slug).includes('<!--'), `${slug} : commentaire HTML`);
      assert.ok(!page(slug).includes('FAIRE VALIDER'), `${slug} : note interne`);
    }
  });

  test('portent le texte, pas seulement le gabarit', () => {
    // Un markdown vide ou illisible produirait une coquille valide.
    assert.match(page('confidentialite'), /responsable du traitement/);
    assert.match(page('conditions'), /Conditions générales d'utilisation/);
    assert.match(page('suppression-compte'), /Supprimer mon compte/);
  });

  test('se lisent sans JavaScript', () => {
    // C'est la raison d'être des fichiers statiques : la console Play ouvre
    // ces URL directement, et une route Angular répondrait 404.
    for (const slug of SLUGS) {
      assert.ok(!page(slug).includes('<app-root>'), `${slug} : coquille Angular`);
      assert.match(page(slug), /<h1>/, `${slug} : pas de titre rendu`);
    }
  });
});

describe('Divulgations exigées par la politique', () => {
  // Chaque entrée est une donnée que l'application collecte réellement, et
  // que la politique doit donc nommer.
  const exigees = [
    ['adresse e-mail', /adresse électronique/i],
    ['nom et prénom', /nom et (votre )?prénom/i],
    ['photo de profil', /photo de profil/i],
    ['établissement', /établissement/i],
    ['filière et niveau', /filière et (votre )?niveau/i],
    ['pièce justificative', /justificatif/i],
    ["identifiant d'appareil", /identifiant technique d'appareil/i],
    ['jeton de notification', /notifications/i],
    ['activité de lecture', /progression de lecture/i],
  ];

  for (const [quoi, motif] of exigees) {
    test(`mentionne : ${quoi}`, () => {
      assert.match(page('confidentialite'), motif);
    });
  }
});

describe('Page de suppression de compte', () => {
  test('donne une adresse de contact', () => {
    assert.match(page('suppression-compte'), /tientcheumarvin@gmail\.com/);
  });

  test('annonce un délai', () => {
    // Play attend que la page dise combien de temps la demande prend.
    assert.match(page('suppression-compte'), /trente \(30\) jours/);
  });

  test('dit ce qui est supprimé et ce qui est conservé', () => {
    assert.match(page('suppression-compte'), /anonymisée/i);
    assert.match(page('suppression-compte'), /définitive/i);
  });

  test("décrit aussi le chemin dans l'application", () => {
    // Play exige la page web *en plus* du chemin in-app, pas à sa place.
    assert.match(page('suppression-compte'), /Profil/);
  });
});

describe('Liens entre les pages', () => {
  test('chaque page renvoie aux deux autres', () => {
    for (const slug of SLUGS) {
      for (const autre of SLUGS) {
        assert.ok(page(slug).includes(`/${autre}/`), `${slug} ne lie pas ${autre}`);
      }
    }
  });

  test('le footer du site renvoie aux trois pages', () => {
    const footer = readFileSync(
      join(racine, 'src/app/Components/footer/footer.html'), 'utf8',
    );
    for (const slug of SLUGS) {
      assert.ok(footer.includes(`/${slug}/`), `footer ne lie pas ${slug}`);
    }
  });
});
