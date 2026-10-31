/**
 * Harnais de bout en bout : une vraie API (base mémoire), un vrai navigateur,
 * une vraie connexion. Aucun mock : ce qui échoue ici échoue pour l'étudiant.
 */
import { chromium } from 'playwright';

export const base = process.env.BASE ?? 'http://127.0.0.1:4201';
export const DEVICE = 'appareil-de-test-0123456789abcdef';

export async function ouvrir(options = {}) {
  const navigateur = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: options.sw ? 'allow' : 'block' });
  await contexte.grantPermissions(['clipboard-read', 'clipboard-write']);
  // `neuf` : un téléphone qui ouvre l'application pour la première fois - ni
  // appareil connu, ni « déjà lancé ».
  if (!options.neuf) {
    await contexte.addInitScript((d) => {
      if (!localStorage.getItem('nl_device_id')) localStorage.setItem('nl_device_id', d);
      localStorage.setItem('nl_first_launch', '0');
    }, DEVICE);
  }
  const page = await contexte.newPage();
  const journal = { api: [], erreurs: [], console: [] };
  page.on('pageerror', (e) => journal.erreurs.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') journal.console.push(m.text().slice(0, 200)); });
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/')) journal.api.push({ m: r.request().method(), s: r.status(), u: u.replace(/^.*\/api/, '/api').slice(0, 90) });
  });
  return { navigateur, contexte, page, journal };
}

export async function connecter(page) {
  await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('etudiant@test.local');
  // L'adresse d'abord : le serveur dit ensuite si ce compte a un PIN.
  await page.getByRole('button', { name: /continuer avec le code pin/i }).click();
  await page.locator('nl-pin-input').waitFor();
  for (const c of '1234') {
    await page.locator('nl-pin-input').getByRole('button', { name: c, exact: true }).click();
  }
  await page.waitForURL(/\/app\/home/, { timeout: 20000 });
  await page.waitForTimeout(1500);
}

/** Les appels en échec depuis `depuis` (index du journal). */
export function echecs(journal, depuis = 0) {
  return journal.api.slice(depuis).filter((a) => a.s >= 400);
}

/** Appelle l'API avec la session de la page - pour vérifier l'état côté serveur. */
export async function api(page, methode, chemin, corps) {
  return page.evaluate(async ([m, c, b]) => {
    const r = await fetch(`/api${c}`, {
      method: m,
      headers: { Authorization: `Bearer ${localStorage.getItem('nl_jwt_token')}`, 'Content-Type': 'application/json' },
      body: b ? JSON.stringify(b) : undefined,
    });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, data: json?.data ?? json };
  }, [methode, chemin, corps ?? null]);
}

export const verdicts = [];
export function verifier(nom, ok, detail = '') {
  verdicts.push({ nom, ok });
  console.log(`${ok ? '  ✔' : '  ✘'} ${nom}${detail ? ' - ' + detail : ''}`);
}
export function bilan() {
  const ko = verdicts.filter((v) => !v.ok);
  console.log(`\n${verdicts.length - ko.length}/${verdicts.length} vérifications passées`);
  if (ko.length) console.log('ÉCHECS :', ko.map((v) => v.nom).join(' | '));
}
