import { HttpErrorResponse } from '@angular/common/http';
import { Failure } from '../../models';
import { enFailure } from '../utils/erreur-api';

describe('enFailure', () => {
  it('garde le statut et le code d’une réponse HTTP en erreur', () => {
    const f = enFailure(
      new HttpErrorResponse({ status: 409, url: '/api/x', error: { error: { code: 'CONFLICT', message: 'brut' } } }),
    );
    expect(f).toBeInstanceOf(Failure);
    expect(f.statusCode).toBe(409);
    expect(f.code).toBe('CONFLICT');
  });

  it('traduit une réponse sans statut (réseau coupé) en message de patience', () => {
    const f = enFailure(new HttpErrorResponse({ status: 0, url: '/api/x' }));
    expect(f.message).toMatch(/met du temps à répondre/i);
  });

  it('transforme toute autre erreur en message générique', () => {
    expect(enFailure(new Error('boom')).message).toBe('Une erreur est survenue.');
    expect(enFailure('texte').message).toBe('Une erreur est survenue.');
  });
});
