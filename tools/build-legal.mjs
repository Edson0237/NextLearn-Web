// Rend les textes de `legal/*.md` en pages statiques sous `public/`.
//
// Pourquoi des fichiers statiques et pas des routes Angular : Google Play
// ouvre ces URL directement, sans passer par la page d'accueil. Une route
// Angular ne survit à un chargement direct que si l'hébergeur réécrit vers
// `index.html` - et l'hébergeur de ce site n'est déclaré nulle part. Un
// `public/<slug>/index.html` est un vrai fichier : il répond sur n'importe
// quel hébergeur statique, sans règle de réécriture, et sans JavaScript.
//
// `public/` est copié verbatim dans la sortie de build (voir angular.json).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// Chaque page existe en français (`legal/<source>`) et en anglais
// (`legal/en/<source>`). Les deux versions sont dans le même fichier : la
// langue est choisie côté navigateur, sans second aller-retour réseau.
const PAGES = [
  { source: 'politique-confidentialite.md', slug: 'confidentialite',
    titre: { fr: 'Politique de confidentialité', en: 'Privacy policy' } },
  { source: 'conditions-utilisation.md', slug: 'conditions',
    titre: { fr: "Conditions d'utilisation", en: 'Terms of use' } },
  { source: 'suppression-compte.md', slug: 'suppression-compte',
    titre: { fr: 'Supprimer votre compte', en: 'Delete your account' } },
];

const PIED = {
  fr: { confidentialite: 'Politique de confidentialité', conditions: "Conditions d'utilisation",
        suppression: 'Supprimer mon compte', ecrire: 'Nous écrire' },
  en: { confidentialite: 'Privacy policy', conditions: 'Terms of use',
        suppression: 'Delete my account', ecrire: 'Contact us' },
};

// Même clé que l'application (`TraductionService`) : le texte s'ouvre dans la
// langue choisie dans les Réglages, y compris dans le lecteur intégré.
const SCRIPT_LANGUE = `(function () {
  var d = document.documentElement, l = null;
  try {
    var q = /[?&]lang=(fr|en)/.exec(location.search); if (q) l = q[1];
    if (!l) { var p = localStorage.getItem('nl_langue'); if (p === 'fr' || p === 'en') l = p; }
  } catch (e) {}
  if (!l) l = /^en/i.test(navigator.language || '') ? 'en' : 'fr';
  d.setAttribute('data-lang', l); d.lang = l;
  window.nlLangue = function (x) { d.setAttribute('data-lang', x); d.lang = x; };
})();`;

// Les fichiers source portent des notes internes en commentaire HTML - dont
// « À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE AVANT PUBLICATION ». marked les
// laisse passer tels quels dans la sortie : elles seraient lisibles par
// quiconque affiche le source de la page. On les retire avant la conversion.
const sansCommentaires = (md) => md.replace(/<!--[\s\S]*?-->/g, '');

const echapper = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pied = (l) => `<footer>
      <a href="/confidentialite/">${PIED[l].confidentialite}</a>
      <a href="/conditions/">${PIED[l].conditions}</a>
      <a href="/suppression-compte/">${PIED[l].suppression}</a>
      <a href="mailto:tientcheumarvin@gmail.com">${PIED[l].ecrire}</a>
    </footer>`;

const version = (l, html) => `<div class="version" lang="${l}">\n${html}\n${pied(l)}\n</div>`;

const gabarit = (titre, corps) => `<!doctype html>
<html lang="fr" data-lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(titre.fr)} / ${echapper(titre.en)} - NextLearn</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${echapper(titre.fr)} / ${echapper(titre.en)} - NextLearn.">
<link rel="icon" href="/images/Logo.png" type="image/png">
<script>${SCRIPT_LANGUE}</script>
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
  .langues { margin-left: auto; display: flex; gap: 6px; }
  .langues button {
    font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    color: #fff; background: transparent; border: 1px solid rgba(255,255,255,.4);
    border-radius: 999px; padding: 4px 12px;
  }
  html[data-lang="fr"] .langues [data-l="fr"],
  html[data-lang="en"] .langues [data-l="en"] { background: #fff; color: var(--primary-dark); }
  html[data-lang="fr"] [lang="en"].version, html[data-lang="en"] [lang="fr"].version { display: none; }
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
    <div class="langues" role="group" aria-label="Langue / Language">
      <button type="button" data-l="fr" onclick="nlLangue('fr')">FR</button>
      <button type="button" data-l="en" onclick="nlLangue('en')">EN</button>
    </div>
  </div>
</header>
<main>
  <article>
${corps}
  </article>
</main>
</body>
</html>
`;

const rendre = (chemin, source) => {
  const md = readFileSync(chemin, 'utf8');
  const corps = marked.parse(sansCommentaires(md), { async: false }).trim();
  if (corps.includes('<!--')) {
    throw new Error(`${source} : un commentaire a survécu au nettoyage`);
  }
  return corps;
};

for (const { source, slug, titre } of PAGES) {
  const fr = rendre(join(racine, 'legal', source), source);
  const en = rendre(join(racine, 'legal', 'en', source), `en/${source}`);

  const cible = join(racine, 'public', slug, 'index.html');
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, gabarit(titre, version('fr', fr) + '\n' + version('en', en)), 'utf8');
  console.log(`public/${slug}/index.html  <-  legal/${source} + legal/en/${source}`);
}
