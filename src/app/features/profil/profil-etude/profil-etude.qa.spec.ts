import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ProfilEtudePage } from './profil-etude';
import { ProfilEtude, ProfilRepository } from '../../../core/profil';
import { ReferencesRepository } from '../../../core/references';
import { TraductionService } from '../../../core/i18n';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';

const profilSample: ProfilEtude = {
  compte: {
    id: 'u-1',
    prenom: 'Marin',
    nom: 'QA',
    email: 'qa@univ-qa.test',
    avatarUrl: null,
    universite: { id: 'univ-1', nom: 'UQA' },
    filiere: { id: 'fil-1', nom: 'GL' },
    cycle: 'LICENCE',
    niveau: 'N3',
    section: 'FRANCOPHONE',
    langue: 'fr',
    verifie: true,
    premium: false,
    membreDepuis: null,
  },
  etude: {
    matieresDifficiles: [{ id: 'm1', nom: 'Algorithmes' }],
    objectif: 'mention',
    dateProchainExamen: '2026-12-10',
    joursAvantExamen: 24,
    languesDocuments: ['fr'],
    formatsPreferes: ['pdf'],
    economieDonnees: false,
    rappels: { actifs: true, heure: '18:30' },
    consentementSuivi: false,
  },
  completude: {
    pourcentage: 80,
    manquants: [{ cle: 'objectif', fr: 'Précise ton objectif', en: 'Set goal' }],
  },
};

describe('QA ProfilEtudePage — Accessibilité WCAG 2.1 (NL-BUG-2026-006) & mise à jour champs', () => {
  function setup() {
    const repoMock = {
      lireProfilEtude: vi.fn().mockResolvedValue(profilSample),
      mettreAJourProfilEtude: vi.fn().mockResolvedValue(profilSample),
      reinitialiserProfilEtude: vi.fn().mockResolvedValue(profilSample),
    };
    const refsMock = {
      getMatieres: vi.fn().mockResolvedValue([
        { id: 'm1', nom: 'Algorithmes' },
        { id: 'm2', nom: 'Réseaux' },
      ]),
    };

    TestBed.configureTestingModule({
      imports: [ProfilEtudePage],
      providers: [
        provideRouter([]),
        { provide: ProfilRepository, useValue: repoMock },
        { provide: ReferencesRepository, useValue: refsMock },
        { provide: ToastService, useValue: { succes: vi.fn(), erreur: vi.fn(), info: vi.fn() } },
        { provide: FeuilleActionService, useValue: { confirmer: vi.fn().mockResolvedValue(true) } },
        { provide: TraductionService, useValue: { langue: signal<'fr' | 'en'>('fr').asReadonly(), aDesMessages: signal(true).asReadonly(), t: (_k: string, _p?: unknown, def?: string) => def ?? _k } },
      ],
    });

    const fixture = TestBed.createComponent(ProfilEtudePage);
    return { fixture, component: fixture.componentInstance as any, repoMock };
  }

  it('NL-BUG-2026-006 : tous les champs et role="switch" ont un libellé accessible explicite', async () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    await component.charger();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dateInput = host.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(dateInput).toBeTruthy();
    expect(dateInput!.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);

    const searchInput = host.querySelector('input[type="search"]') as HTMLInputElement | null;
    expect(searchInput).toBeTruthy();
    expect(searchInput!.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);

    const switches = Array.from(host.querySelectorAll('button[role="switch"]'));
    expect(switches).toHaveLength(3);
    for (const sw of switches) {
      expect(sw.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
    }
  });

  it('met à jour objectif, date, matières, langues, formats, rappels, économie, consentement et réinitialisation', async () => {
    const { fixture, component, repoMock } = setup();
    await component.ngOnInit();
    await Promise.resolve();
    fixture.detectChanges();

    component.choisirObjectif('reussir');
    await Promise.resolve();
    component.basculerMatiereDifficile('m2');
    await Promise.resolve();
    component.surChangementDateExamen({ target: { value: '2027-01-15' } } as unknown as Event);
    await Promise.resolve();
    component.effacerDateExamen();
    await Promise.resolve();
    component.basculerLangueDoc('en');
    await Promise.resolve();
    component.basculerFormatPrefere('docx');
    await Promise.resolve();
    component.basculerRappels();
    await Promise.resolve();
    component.surChangementHeureRappel({ target: { value: '19:00' } } as unknown as Event);
    await Promise.resolve();
    component.basculerEconomieDonnees();
    await Promise.resolve();
    component.basculerConsentementSuivi();
    await Promise.resolve();
    await component.reinitialiserProfil();

    expect(repoMock.mettreAJourProfilEtude).toHaveBeenCalled();
    expect(repoMock.reinitialiserProfilEtude).toHaveBeenCalled();
  });
});
