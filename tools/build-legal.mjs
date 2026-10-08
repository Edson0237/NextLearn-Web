// Rend les textes de `legal/*.md` en pages statiques sous `public/`.
//
// Pourquoi des fichiers statiques et pas des routes Angular : Google Play
// ouvre ces URL directement, sans passer par la page d'accueil. Une route
// Angular ne survit à un chargement direct que si l'hébergeur réécrit vers
// `index.html` — et l'hébergeur de ce site n'est déclaré nulle part. Un
// `public/<slug>/index.html` est un vrai fichier : il répond sur n'importe
// quel hébergeur statique, sans règle de réécriture, et sans JavaScript.
//
// `public/` est copié verbatim dans la sortie de build (voir angular.json).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  { source: 'politique-confidentialite.md', slug: 'confidentialite',
    titre: 'Politique de confidentialité' },
  { source: 'conditions-utilisation.md', slug: 'conditions',
    titre: "Conditions d'utilisation" },
  { source: 'suppression-compte.md', slug: 'suppression-compte',
    titre: 'Supprimer votre compte' },
];

// Les fichiers source portent des notes internes en commentaire HTML — dont
// « À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT PUBLICATION ». marked les
// laisse passer tels quels dans la sortie : elles seraient lisibles par
// quiconque affiche le source de la page. On les retire avant la conversion.
const sansCommentaires = (md) => md.replace(/<!--[\s\S]*?-->/g, '');

const echapper = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const gabarit = (titre, corps) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre)} — NextLearn</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${echapper(titre)} de l'application NextLearn.">
<link rel="icon" href="/images/Logo.png" type="image/png">
<style>
  :root {
    --primary: #1a497d; --primary-dark: #0d2844; --accent: #7db8ff;
    --texte: #1f2937; --doux: #5b6778; --bord: #e5e9f0; --fond: #f8fafc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--fond); color: var(--texte);
    font: 16px/1.7 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  header {
    background: var(--primary-dark); color: #fff; padding: 18px 0;
  }
  header .bande, main { max-width: 820px; margin: 0 auto; padding-inline: 20px; }
  header .bande { display: flex; align-items: center; gap: 10px; }
  header a { color: #fff; text-decoration: none; font-weight: 600; display: flex;
             align-items: center; gap: 10px; }
  header img { height: 30px; width: auto; }
  header span { color: var(--accent); }
  main { padding-block: 40px 72px; }
  article {
    background: #fff; border: 1px solid var(--bord); border-radius: 16px;
    padding: 40px; box-shadow: 0 4px 20px rgba(26, 73, 125, 0.06);
  }
  h1 { font-size: 1.9rem; line-height: 1.25; color: var(--primary-dark);
       margin: 0 0 24px; }
  h2 { font-size: 1.25rem; color: var(--primary); margin: 40px 0 12px;
       padding-top: 20px; border-top: 1px solid var(--bord); }
  h3 { font-size: 1.05rem; color: var(--primary-dark); margin: 26px 0 8px; }
  h2 + h3 { margin-top: 14px; }
  p, li { margin: 0 0 12px; }
  ul, ol { padding-left: 22px; }
  li::marker { color: var(--accent); }
  a { color: var(--primary); }
  strong { color: var(--primary-dark); }
  hr { border: 0; border-top: 1px solid var(--bord); margin: 32px 0; }
  code { background: var(--fond); padding: 2px 6px; border-radius: 5px;
         font-size: 0.9em; }
  footer {
    border-top: 1px solid var(--bord); margin-top: 48px; padding-top: 24px;
    font-size: 0.9rem; color: var(--doux);
  }
  footer a { margin-right: 18px; white-space: nowrap; }
  @media (max-width: 600px) {
    article { padding: 24px 20px; border-radius: 12px; }
    h1 { font-size: 1.5rem; }
  }
</style>
</head>
<body>
<header>
  <div class="bande">
    <a href="/"><img src="/images/Logo.png" alt="">Next<span>Learn</span></a>
  </div>
</header>
<main>
  <article>
${corps}
    <footer>
      <a href="/confidentialite/">Politique de confidentialité</a>
      <a href="/conditions/">Conditions d'utilisation</a>
      <a href="/suppression-compte/">Supprimer mon compte</a>
      <a href="mailto:tientcheumarvin@gmail.com">Nous écrire</a>
    </footer>
  </article>
</main>
</body>
</html>
`;

for (const { source, slug, titre } of PAGES) {
  const md = readFileSync(join(racine, 'legal', source), 'utf8');
  const corps = marked.parse(sansCommentaires(md), { async: false }).trim();

  if (corps.includes('<!--')) {
    throw new Error(`${source} : un commentaire a survécu au nettoyage`);
  }

  const cible = join(racine, 'public', slug, 'index.html');
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, gabarit(titre, corps), 'utf8');
  console.log(`public/${slug}/index.html  <-  legal/${source}`);
}
