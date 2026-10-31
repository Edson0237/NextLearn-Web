import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { InstallationService } from '../../core/pwa/installation.service';
import { Vitrine } from './vitrine';

/**
 * La page d'accueil publique : son rôle est de mener dans l'application, sans
 * rien charger ailleurs, et de ne proposer l'installation que si elle est possible.
 */
describe('Vitrine', () => {
  const installation = {
    dejaInstallee: signal(false),
    peutProposer: signal(false),
    besoinGuideIos: signal(false),
    proposer: vi.fn(async () => true),
  };

  /** `avant` s'exécute une fois le module configuré, avant que la page ne démarre. */
  function creer(avant?: () => void) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: InstallationService, useValue: installation }],
    });
    avant?.();
    const fixture = TestBed.createComponent(Vitrine);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    installation.dejaInstallee.set(false);
    installation.peutProposer.set(false);
    installation.besoinGuideIos.set(false);
    installation.proposer.mockClear();
  });

  it('mène à l’application par le bouton principal', () => {
    const el: HTMLElement = creer().nativeElement;
    const liens = [...el.querySelectorAll<HTMLAnchorElement>('a.nl-vit__bouton--plein')];
    expect(liens).toHaveLength(1);
    expect(liens[0].getAttribute('href')).toBe('/app');
  });

  it('masque pour l’instant « Comment ça marche » et l’appel final', () => {
    const el: HTMLElement = creer().nativeElement;
    expect(el.querySelector('.nl-vit__etapes')).toBeNull();
    expect(el.querySelector('.nl-vit__final')).toBeNull();
    // Les sections qui restent : accroche, atouts, pied de page.
    expect(el.querySelector('.nl-vit__hero')).not.toBeNull();
    expect(el.querySelector('.nl-vit__cartes')).not.toBeNull();
    expect(el.querySelector('footer')).not.toBeNull();
  });

  it('ne parle d’aucun magasin d’applications en tant que téléchargement', () => {
    const texte = (creer().nativeElement as HTMLElement).textContent ?? '';
    expect(texte).not.toMatch(/télécharger sur (l.)?(app store|google play)/i);
  });

  it('ne propose pas d’installer quand le navigateur ne sait pas le faire', () => {
    const el: HTMLElement = creer().nativeElement;
    expect(el.querySelector('.nl-vit__bouton--contour')).toBeNull();
  });

  it('propose d’installer sur Android/Chrome, et déclenche l’invitation native', async () => {
    installation.peutProposer.set(true);
    const fixture = creer();
    const bouton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.nl-vit__bouton--contour');
    expect(bouton).not.toBeNull();
    bouton!.click();
    await fixture.whenStable();
    expect(installation.proposer).toHaveBeenCalledTimes(1);
  });

  it('sur iPhone, explique le geste au lieu de déclencher une invitation qui n’existe pas', async () => {
    installation.besoinGuideIos.set(true);
    const fixture = creer();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.nl-vit__guide')).toBeNull();
    el.querySelector<HTMLButtonElement>('.nl-vit__bouton--contour')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.nl-vit__guide')).not.toBeNull();
    expect(installation.proposer).not.toHaveBeenCalled();
  });

  it('renvoie vers l’application quand elle est déjà installée', () => {
    installation.dejaInstallee.set(true);
    let naviguer!: ReturnType<typeof vi.spyOn>;
    creer(() => {
      naviguer = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    });
    expect(naviguer).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });

  it('ne charge aucune feuille de style externe (ni police, ni icônes tierces)', () => {
    creer();
    const externes = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .map((l) => l.href)
      .filter((h) => /fonts\.googleapis|cdnjs|font-awesome/i.test(h));
    expect(externes).toEqual([]);
  });

  it('expose les liens légaux et le contact', () => {
    const el: HTMLElement = creer().nativeElement;
    const hrefs = [...el.querySelectorAll('footer a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/confidentialite/', '/conditions/', '/suppression-compte/']));
    expect(hrefs.some((h) => h?.startsWith('mailto:'))).toBe(true);
  });
});
