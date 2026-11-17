import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { DepotForm } from './depot-form';
import { AuthService } from '../../../core/auth';
import { DepotLicence, DepotRepository } from '../../../core/contributions';
import { ReferencesRepository } from '../../../core/references';
import { TraductionService } from '../../../core/i18n';
import { ToastService } from '../../../shared/ui/toast/toast';
import { ScanTransfert } from '../../../core/scan';
import { Failure } from '../../../core/models';

describe('QA DepotForm — Gardes de validation, doublon 409 SHA-256 & support requestId', () => {
  function setup(scanne?: File) {
    const toastMock = {
      info: vi.fn(),
      succes: vi.fn(),
      erreur: vi.fn(),
    };
    const repoMock = {
      getTypes: vi.fn().mockResolvedValue([
        { value: 'COURS', label: 'Cours' },
        { value: 'EPREUVE', label: 'Épreuve' },
      ]),
      deposer: vi.fn().mockResolvedValue({}),
    };
    const refsMock = {
      getLimitesFichier: vi.fn().mockResolvedValue({ maxFileSizeMb: 25, formats: ['pdf'] }),
      getTypesEpreuve: vi.fn().mockResolvedValue([{ value: 'SN', label: 'Session normale' }]),
      getMatieres: vi.fn().mockResolvedValue([
        { id: 'm1', nom: 'Architecture Logicielle' },
        { id: 'm2', nom: 'TD Systèmes' }, // doit être filtré par motifHorsMatiere
      ]),
    };

    TestBed.configureTestingModule({
      imports: [DepotForm],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { state: signal({ user: { niveau: 'N3' } }).asReadonly() } },
        { provide: DepotRepository, useValue: repoMock },
        { provide: ReferencesRepository, useValue: refsMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: TraductionService,
          useValue: {
            langue: signal('fr').asReadonly(),
            aDesMessages: signal(true).asReadonly(),
            t: (_k: string, _p?: unknown, def?: string) => def ?? _k,
          },
        },
        { provide: ScanTransfert, useValue: { reprendre: () => scanne } },
      ],
    });

    const fixture = TestBed.createComponent(DepotForm);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance as any,
      repoMock,
      toastMock,
      navSpy,
      navUrlSpy,
    };
  }

  it('valide progressivement chaque champ manquant et filtre les intitulés hors-matière', async () => {
    const scanPdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'scan.pdf', { type: 'application/pdf' });
    const { component, toastMock, navSpy, navUrlSpy } = setup(scanPdf);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.fichier()?.name).toBe('scan.pdf');
    expect(component.matieres().items).toHaveLength(1);

    await component.envoyer();
    expect(toastMock.info).toHaveBeenCalled();

    component.titre.set('Titre valide');
    await component.envoyer();
    component.description.set('Description supérieure à dix caractères.');
    await component.envoyer();
    component.surChangementType('EPREUVE');
    expect(component.estEpreuve()).toBe(true);
    await component.envoyer();
    component.matiereId.set('m1');
    await component.envoyer();
    component.licence.set(DepotLicence.auteur);
    component.retirerFichier();
    await component.envoyer();
    expect(toastMock.info).toHaveBeenCalledTimes(6);

    component.scanner();
    expect(navUrlSpy).toHaveBeenCalled();
    component.annuler();
    expect(navSpy).toHaveBeenCalled();
  });

  it('rejette un mauvais format ou un dépassement de taille dans surFichierChoisi()', async () => {
    const { component, toastMock } = setup();
    await Promise.resolve();

    component.surFichierChoisi({
      target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] },
    } as unknown as Event);
    expect(toastMock.erreur).toHaveBeenCalled();
    expect(component.fichier()).toBeUndefined();

    const tropGros = new File(['x'], 'lourd.pdf', { type: 'application/pdf' });
    Object.defineProperty(tropGros, 'size', { value: 30 * 1024 * 1024 });
    component.surFichierChoisi({ target: { files: [tropGros] } } as unknown as Event);
    expect(toastMock.erreur).toHaveBeenCalledTimes(2);
  });

  it('gère les erreurs serveur 409 DUPLICATE_FILE, FILE_TOO_LARGE, requestId et champs inconnus', async () => {
    const { component, repoMock, navUrlSpy } = setup();
    await Promise.resolve();

    component.titre.set('Cours complet QA');
    component.description.set('Notes rédigées et vérifiées pour examen.');
    component.type.set('COURS');
    component.matiereId.set('m1');
    component.licence.set(DepotLicence.auteur);
    component.fichier.set(new File(['%PDF'], 'ok.pdf', { type: 'application/pdf' }));

    repoMock.deposer.mockRejectedValueOnce(
      new Failure('Doublon détecté', 409, 'DUPLICATE_FILE', undefined, {
        code: 'DUPLICATE_FILE',
        conseil: 'Consulte la fiche existante.',
        existant: { type: 'document', id: 'doc-ex-1', titre: 'Cours existant', statut: 'publie' },
      }),
    );

    await component.envoyer();
    expect(component.doublonDetecte()?.existant?.id).toBe('doc-ex-1');
    component.basculerPourquoi();
    expect(component.pourquoiOuvert()).toBe(true);
    component.voirDocumentExistant('doc-ex-1');
    expect(navUrlSpy).toHaveBeenCalledWith('/app/bibliotheque/doc/doc-ex-1');

    repoMock.deposer.mockRejectedValueOnce(
      new Failure('Trop lourd', 413, 'FILE_TOO_LARGE', undefined, undefined, 'req-qa-500', {
        champInconnu: 'Erreur technique',
        titre: 'Titre pris',
      }),
    );

    await component.envoyer();
    expect(component.erreurDepot()?.requestId).toBe('req-qa-500');
    expect(component.champsNonRattaches()).toEqual([{ champ: 'champInconnu', message: 'Erreur technique' }]);

    await component.contacterSupport();
    expect(component.requestIdCopie()).toBe(true);
    expect(navUrlSpy).toHaveBeenCalled();
  });
});
