import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheetRef, BOTTOM_SHEET_DATA } from '../bottom-sheet/bottom-sheet';
import { SignalementSheet } from './signalement-sheet';

function creer() {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: BottomSheetRef, useValue: { close } },
      {
        provide: BOTTOM_SHEET_DATA,
        useValue: {
          titre: 'Signaler',
          motifs: [{ code: 'DOUBLON', label: 'Doublon' }, { code: 'AUTRE', label: 'Autre' }],
          information: '24 h',
          motifsMasquants: [],
        },
      },
    ],
  });
  const sheet = TestBed.runInInjectionContext(() => new SignalementSheet()) as any;
  return { sheet, close };
}

describe('SignalementSheet', () => {
  it('refuse d’envoyer sans motif', () => {
    const { sheet, close } = creer();
    sheet.envoyer();
    expect(close).not.toHaveBeenCalled();
    expect(sheet.erreur()).toBe('signalementChoisirMotif');
  });

  it('« Autre » exige une explication', () => {
    const { sheet, close } = creer();
    sheet.choisir('AUTRE');
    sheet.envoyer();
    expect(close).not.toHaveBeenCalled();
    expect(sheet.erreur()).toBe('signalementExpliquerObligatoire');
    sheet.explication.set('Le fichier est celui d’une autre matière.');
    sheet.envoyer();
    expect(close).toHaveBeenCalledWith({ motif: 'AUTRE', commentaire: 'Le fichier est celui d’une autre matière.' });
  });

  it('garde le texte quand on change de motif puis qu’on revient à « Autre »', () => {
    const { sheet } = creer();
    sheet.choisir('AUTRE');
    sheet.explication.set('Mon explication');
    sheet.choisir('DOUBLON');
    sheet.choisir('AUTRE');
    expect(sheet.explication()).toBe('Mon explication');
  });

  it('un autre motif part sans commentaire', () => {
    const { sheet, close } = creer();
    sheet.choisir('DOUBLON');
    sheet.envoyer();
    expect(close).toHaveBeenCalledWith({ motif: 'DOUBLON', commentaire: undefined });
  });
});
