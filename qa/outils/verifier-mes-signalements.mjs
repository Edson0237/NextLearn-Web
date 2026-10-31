/** « Mes signalements » : les contenus signalés (document, épreuve) et les tickets, avec un libellé d'état clair. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1200 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const rep = (id, type, titre, motifLabel, status, decisionMotif) => ({ id, cibleType: type, cibleTitre: titre, motifLabel, motif: 'X', status, decisionMotif, createdAt: '2026-10-30T10:00:00Z' });
await ctx.route('**/api/**', (r) => {
  const u = r.request().url(); let data = [];
  if (/verification/.test(u)) data = { statut: 'APPROVED' };
  else if (/reports\/me/.test(u)) data = [
    rep('1', 'epreuve', 'Algorithmique 2024', 'Violation de droit d’auteur', 'ouvert', null),
    rep('2', 'document', 'Cours réseaux', 'Doublon', 'en_examen', null),
    rep('3', 'document', 'TD bases de données', 'Contenu inapproprié', 'retenu', 'Fondé : retiré.'),
    rep('4', 'epreuve', null, 'Erreur', 'rejete', 'Usage légitime.'),
  ];
  else if (/support\/tickets/.test(u)) data = [{ _id: 't1', id: 't1', categorie: 'CONNEXION', sujet: 'Problème de connexion', message: 'Je ne peux pas me connecter', status: 'open', createdAt: '2026-10-30T09:00:00Z' }];
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const res = [];
const v = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? '  ✔' : '  ✘'} ${n}${d ? ' — ' + d : ''}`); };
await page.goto(`${base}/app/support/tickets`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.waitForTimeout(1500);
console.log('url', page.url());
const t = await page.locator('body').innerText();
v('les contenus signalés sont listés (épreuve et document)', t.includes('Algorithmique 2024') && t.includes('Cours réseaux') && /Épreuve/.test(t) && /Document/.test(t));
v('« En attente » pour un signalement ouvert, jamais « Ouvert »', /En attente/.test(t) && !/\bOuvert\b/.test(t));
v('« En cours d’examen », « Retenu », « Non retenu »', /En cours d’examen/.test(t) && /Retenu/.test(t) && /Non retenu/.test(t));
v('la décision du modérateur est visible', t.includes('Fondé : retiré.') && t.includes('Usage légitime.'));
v('un contenu supprimé reste lisible', /Contenu supprimé/.test(t));
v('les tickets restent affichés, sous leur titre, avec « En attente »', t.includes('Problème de connexion') && /demandes au support/i.test(t));
console.log(`${res.filter(Boolean).length}/${res.length}`);
await nav.close();
