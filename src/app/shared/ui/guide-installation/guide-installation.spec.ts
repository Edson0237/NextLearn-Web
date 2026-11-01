import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Environnement } from '../../../core/pwa/environnement';
import { InstallationService } from '../../../core/pwa/installation.service';
import { TraductionService } from '../../../core/i18n';
import { GuideInstallation } from './guide-installation';

/**
 * Le guide lit l'état du service d'installation ; on le remplace ici par des
 * signaux pilotés à la main pour parcourir chaque environnement. Ce que
 * le navigateur fait réellement de `prompt()` ne se teste pas ici - voir les
 * vérifications manuelles dans ARCHITECTURE.md.
 */
describe('GuideInstallation', () => {
  const installation = {
    environnement: signal<Environnement>({ appareil: 'telephone', systeme: 'android', navigateur: 'chrome' }),
    dejaInstallee: signal(false),
    invitationDisponible: signal(false),
    dernierResultat: signal<string | null>(null),
    proposer: vi.fn(async () => true),
  };

  function creer() {
    TestBed.configureTestingModule({
      providers: [
        { provide: InstallationService, useValue: installation },
        { provide: TraductionService, useValue: { t: (k: string) => k, messages: signal({}), preference: signal('fr'), langue: signal('fr') } },
      ],
    });
    const fixture = TestBed.createComponent(GuideInstallation);
    fixture.detectChanges();
    return fixture;
  }

  const texte = (f: ReturnType<typeof creer>) => (f.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    installation.environnement.set({ appareil: 'telephone', systeme: 'android', navigateur: 'chrome' });
    installation.dejaInstallee.set(false);
    installation.invitationDisponible.set(false);
    installation.dernierResultat.set(null);
    installation.proposer.mockClear();
    TestBed.resetTestingModule();
  });

  it('affiche les étapes manuelles quand le navigateur n’offre pas de bouton natif', () => {
    const f = creer();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.guide__bouton')).toBeNull();
    expect(el.querySelectorAll('.guide__etape').length).toBe(3);
  });

  it('propose le bouton natif, et il déclenche l’installation', async () => {
    installation.invitationDisponible.set(true);
    const f = creer();
    const bouton = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.guide__bouton');
    expect(bouton).not.toBeNull();
    bouton!.click();
    expect(installation.proposer).toHaveBeenCalledTimes(1);
  });

  it('ne déclare pas l’application installée tant que le navigateur ne l’a pas confirmé', () => {
    installation.invitationDisponible.set(false);
    installation.dernierResultat.set('accepte');
    const t = texte(creer());
    expect(t).toContain('installEnCours');
    expect(t).not.toContain('installDejaTitre');
  });

  it('annonce un refus sans cacher les étapes manuelles', () => {
    installation.invitationDisponible.set(true);
    installation.dernierResultat.set('refuse');
    const f = creer();
    expect(texte(f)).toContain('installRefusee');
    expect((f.nativeElement as HTMLElement).querySelectorAll('.guide__etape').length).toBeGreaterThan(0);
  });

  it('n’affiche aucune instruction si l’application est déjà installée', () => {
    installation.dejaInstallee.set(true);
    const f = creer();
    const el: HTMLElement = f.nativeElement;
    expect(texte(f)).toContain('installDejaTitre');
    expect(el.querySelector('.guide__etapes')).toBeNull();
    expect(el.querySelector('.guide__bouton')).toBeNull();
  });

  it('iPhone + Safari : le geste Partager, sans bouton natif', () => {
    installation.environnement.set({ appareil: 'telephone', systeme: 'ios', navigateur: 'safari' });
    const f = creer();
    expect(texte(f)).toContain('installIosSafariEtape1');
    expect((f.nativeElement as HTMLElement).querySelector('.guide__bouton')).toBeNull();
  });

  it('environnement inconnu : le guide général, et le sélecteur manuel reste disponible', () => {
    installation.environnement.set({ appareil: 'inconnu', systeme: 'inconnu', navigateur: 'inconnu' });
    const f = creer();
    const el: HTMLElement = f.nativeElement;
    expect(texte(f)).toContain('installNonReconnu');
    expect(texte(f)).toContain('installInconnuEtape1');
    expect(el.querySelector('.guide__lien')).not.toBeNull();
  });

  it('le choix manuel change la procédure et retire le bouton natif', () => {
    installation.invitationDisponible.set(true);
    const f = creer();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.guide__bouton')).not.toBeNull();

    el.querySelector<HTMLButtonElement>('.guide__lien')!.click();
    f.detectChanges();
    const iphone = [...el.querySelectorAll<HTMLButtonElement>('.guide__puce')].find((b) => b.textContent?.includes('installSysIphone'))!;
    iphone.click();
    f.detectChanges();

    // L'invitation du navigateur installe cet appareil-ci, pas l'iPhone consulté.
    expect(el.querySelector('.guide__bouton')).toBeNull();
    expect(el.textContent).toContain('installIosSafariEtape1');

    const retour = [...el.querySelectorAll<HTMLButtonElement>('.guide__lien')].find((b) => b.textContent?.includes('installRevenirDetection'))!;
    retour.click();
    f.detectChanges();
    expect(el.querySelector('.guide__bouton')).not.toBeNull();
  });
});
