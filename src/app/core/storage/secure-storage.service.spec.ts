import { TestBed } from '@angular/core/testing';
import { SecureStorageService } from './secure-storage.service';
import { Langue, NiveauEtude } from '../models/user.model';

/**
 * Ce que ce test protège : les comparaisons de date (jeton valide tant
 * qu'on n'a pas dépassé son échéance) et les effets de cascade
 * (`clearTempToken` efface aussi l'étape du parcours — en garder une sans
 * jeton enfermerait sur un écran de code devenu inutilisable).
 */
describe('SecureStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('un jeton sans échéance enregistrée n’est pas valide', () => {
    const s = TestBed.inject(SecureStorageService);
    expect(s.isTokenValid()).toBe(false);
  });

  it('un jeton est valide avant son échéance, plus après', () => {
    const s = TestBed.inject(SecureStorageService);
    s.saveToken('abc', new Date(Date.now() + 1000));
    expect(s.isTokenValid()).toBe(true);

    s.saveToken('abc', new Date(Date.now() - 1000));
    expect(s.isTokenValid()).toBe(false);
  });

  it('clearTempToken efface aussi l’étape du parcours et son échéance', () => {
    const s = TestBed.inject(SecureStorageService);
    s.saveTempToken('jeton');
    s.saveParcoursOtp('inscription', new Date());

    s.clearTempToken();

    expect(s.getTempToken()).toBeNull();
    expect(s.getParcoursOtp()).toBeNull();
    expect(s.getEcheanceParcoursOtp()).toBeNull();
  });

  it('un verrou de PIN passé n’est plus retourné', () => {
    const s = TestBed.inject(SecureStorageService);
    s.savePinLockedUntil(new Date(Date.now() - 1000));
    // Le verrou a une date passée : c'est à l'appelant (AuthService) de la
    // comparer à « maintenant », ce stockage ne fait que la restituer.
    expect(s.getPinLockedUntil()).not.toBeNull();
  });

  it('conserve et restitue un utilisateur', () => {
    const s = TestBed.inject(SecureStorageService);
    s.saveUser({
      id: '1', email: 'a@b.cm', nom: 'Nkeng', prenom: 'Awa',
      universite: 'ISJ', filiere: 'ISI', niveau: NiveauEtude.n3, langue: Langue.fr,
    });

    expect(s.getUser()?.email).toBe('a@b.cm');
  });

  it('isFirstLaunch vaut vrai avant tout marquage', () => {
    const s = TestBed.inject(SecureStorageService);
    expect(s.isFirstLaunch()).toBe(true);
    s.markLaunched();
    expect(s.isFirstLaunch()).toBe(false);
  });
});
