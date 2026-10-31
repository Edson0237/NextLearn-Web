/**
 * Régénère `icon-paths.ts` depuis Lucide (`lucide-static`, licence ISC).
 *
 * Les icônes étaient des Material Symbols arrondis : pleines, épaisses,
 * reconnaissables entre mille - c'est ce qui donnait l'air « généré » à toute
 * l'interface. Lucide est un trait de 24 px, fin et régulier, celui qu'on
 * retrouve dans les applications d'apprentissage soignées : peu de matière,
 * des angles francs, aucune ornementation.
 *
 *   node tools/extraire-icones.mjs            # réécrit le registre
 *   node tools/extraire-icones.mjs --verifier # échoue si le registre a dévié
 *
 * `NOMS` fait le lien entre les noms de l'application (inchangés : aucun écran
 * n'a à bouger) et les fichiers Lucide. Le deuxième champ dit comment
 * l'icône se remplit quand l'état l'exige : `plein` (marque-page, étoile, cœur,
 * dossier - un aplat plein), `doux` (une teinte translucide sous le trait,
 * pour l'onglet courant) ; absent, l'icône reste au trait.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SOURCE = 'node_modules/lucide-static/icons';
const REGISTRE = 'src/app/shared/ui/icon/icon-paths.ts';

/** nom de l'application → [fichier Lucide, remplissage] */
const NOMS = {
  arrow_back: ['arrow-left'], arrow_forward: ['arrow-right'],
  chevron_right: ['chevron-right'], chevron_left: ['chevron-left'], expand_more: ['chevron-down'],
  first_page: ['chevrons-left'], last_page: ['chevrons-right'],
  check: ['check'], clear: ['x'], close: ['x'],
  check_circle: ['circle-check'], task_alt: ['circle-check-big'], error: ['circle-alert'],
  warning: ['triangle-alert'], report_problem: ['triangle-alert'], info: ['info'],
  radio_button_unchecked: ['circle'], backspace: ['delete'],
  assignment: ['clipboard-list'], fact_check: ['clipboard-check'], checklist: ['list-checks'],
  description: ['file-text'], description_outline: ['file-text'], insert_drive_file: ['file'],
  picture_as_pdf: ['file-text'], upload_file: ['file-up', 'doux'], upload_file_outline: ['file-up'],
  edit_note: ['notebook-pen'], history_edu: ['scroll-text'], summarize: ['align-left'],
  menu_book: ['book-open'], menu_book_outline: ['book-open'],
  library_books: ['book-copy'], library_books_fill: ['book-copy', 'doux'],
  article: ['newspaper'], article_fill: ['newspaper', 'doux'],
  quiz: ['circle-help'], science: ['flask-conical'], functions: ['sigma'], memory: ['cpu'],
  slideshow: ['presentation'], layers: ['layers'],
  cloud_done: ['cloud-check'], cloud_off: ['cloud-off'], cloud_outline: ['cloud'],
  cloud_download: ['cloud-download'], cloud_sync: ['cloud-upload'], download: ['download'],
  open_in_new: ['external-link'], share: ['share-2'], sync: ['refresh-cw'], refresh: ['refresh-cw'],
  person: ['user'], person_fill: ['user', 'doux'], groups: ['users'], badge: ['id-card'],
  admin_panel_settings: ['shield-user'], verified: ['badge-check'], workspace_premium: ['award'],
  fingerprint: ['fingerprint'], lock: ['lock'], lock_open: ['lock-open'], privacy_tip: ['shield-check'],
  inbox: ['inbox'], mail: ['mail'], alternate_email: ['at-sign'], forum: ['messages-square'], reply: ['reply'],
  photo_camera: ['camera'], photo_library: ['images'], mic: ['mic'],
  search: ['search'], filter_list: ['list-filter'], sort: ['arrow-up-down'], tune: ['sliders-horizontal'],
  home: ['house', 'doux'], home_outline: ['house'],
  monitoring: ['chart-no-axes-column-increasing', 'doux'], monitoring_outline: ['chart-no-axes-column-increasing'],
  timeline: ['chart-line'], trending_up: ['trending-up'],
  star: ['star', 'plein'], star_fill: ['star', 'plein'],
  favorite: ['heart'], favorite_fill: ['heart', 'plein'], thumb_up: ['thumbs-up'],
  bookmark: ['bookmark', 'plein'], bookmark_outline: ['bookmark'], bookmark_added: ['bookmark-check'],
  folder: ['folder'], folder_fill: ['folder', 'plein'], folder_open: ['folder-open'], create_new_folder: ['folder-plus'],
  explore: ['compass'], explore_fill: ['compass', 'doux'],
  local_fire: ['flame'], local_fire_department: ['flame'], bolt: ['zap'], lightbulb: ['lightbulb'],
  schedule: ['clock'], calendar_month: ['calendar-days'], history: ['history'],
  school: ['graduation-cap'], account_balance: ['landmark'], balance: ['scale'], gavel: ['gavel'],
  settings: ['settings'], language: ['globe'], notifications: ['bell'], storage: ['hard-drive'],
  delete: ['trash-2'], delete_forever: ['trash-2'], delete_sweep: ['eraser'], edit: ['pencil'],
  animation: ['sparkles'], format_size: ['a-large-small'], support_agent: ['headset'], logout: ['log-out'],
  devices: ['monitor-smartphone'], devices_other: ['monitor-smartphone'], mobile: ['smartphone'],
  list_alt: ['list'], format_list_numbered: ['list-ordered'], attach_file: ['paperclip'],
  visibility: ['eye'], more_vert: ['ellipsis-vertical'], more_horiz: ['ellipsis'],
  view_agenda: ['rows-3'], grid_view: ['layout-grid'], open_in_full: ['maximize-2'],
  zoom_in: ['zoom-in'], zoom_out: ['zoom-out'], location_on: ['map-pin'],
};

/** Éléments SVG que le composant sait dessiner. */
const ELEMENTS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);

function elementsDe(fichier) {
  const svg = readFileSync(`${SOURCE}/${fichier}.svg`, 'utf8');
  const corps = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  const els = [];
  for (const m of corps.matchAll(/<(\w+)\s+([^>]*?)\/>/gs)) {
    if (!ELEMENTS.has(m[1])) throw new Error(`${fichier}.svg : élément « ${m[1]} » non géré`);
    const attrs = {};
    for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    els.push({ t: m[1], ...attrs });
  }
  if (els.length === 0) throw new Error(`${fichier}.svg : aucun élément`);
  return els;
}

const manquants = Object.entries(NOMS).filter(([, [f]]) => !existsSync(`${SOURCE}/${f}.svg`)).map(([n, [f]]) => `${n} → ${f}`);
if (manquants.length > 0) {
  console.error(`Sans source dans ${SOURCE} : ${manquants.join(', ')}`);
  process.exit(1);
}

const lignes = Object.entries(NOMS).map(([nom, [fichier, remplissage]]) => {
  const icone = { f: remplissage ?? null, e: elementsDe(fichier) };
  return `  ${nom}: ${JSON.stringify(icone)},`;
});

const sortie = `/**
 * Icônes - Lucide (\`lucide-static\`, licence ISC), trait de 24 px.
 *
 * **Fichier généré** : \`node tools/extraire-icones.mjs\`. Ne pas éditer à la
 * main ; pour changer une icône, changer sa correspondance dans l'outil.
 *
 * \`f\` - remplissage quand l'état l'exige : \`plein\` (aplat), \`doux\` (teinte
 * translucide sous le trait) ; \`null\`, l'icône reste au trait.
 * \`e\` - les éléments SVG, dans un repère 24 × 24.
 */
export interface ElementIcone {
  readonly t: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse';
  readonly [attribut: string]: string;
}

export interface DefinitionIcone {
  readonly f: 'plein' | 'doux' | null;
  readonly e: readonly ElementIcone[];
}

export const ICON_PATHS = {
${lignes.join('\n')}
} as const satisfies Record<string, DefinitionIcone>;

export type IconName = keyof typeof ICON_PATHS;
`;

if (process.argv.includes('--verifier')) {
  const actuel = existsSync(REGISTRE) ? readFileSync(REGISTRE, 'utf8') : '';
  if (actuel !== sortie) {
    console.error('Le registre d’icônes a dévié de Lucide. Relancer `node tools/extraire-icones.mjs`.');
    process.exit(1);
  }
  console.log(`Les ${lignes.length} icônes correspondent à ${SOURCE}.`);
} else {
  writeFileSync(REGISTRE, sortie);
  console.log(`${lignes.length} icônes écrites depuis ${SOURCE}.`);
}
