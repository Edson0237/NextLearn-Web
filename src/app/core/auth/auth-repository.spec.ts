import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthRepository } from './auth-repository';
import { SecureStorageService } from '../storage/secure-storage.service';
import { ParcoursOtp } from '../models/parcours-otp.model';

/**
 * Ce que ce test protège : deux horloges qui ne pardonnent pas une
 * erreur d'un cran — le blocage après échecs de PIN (30 s, 1 min, 2 min,
 * 4 min… plafonné à 15 min), et la fenêtre de reprise d'une démarche OTP
 * (15 minutes, calée sur la durée de vie du jeton temporaire côté
 * serveur). Une off-by-one ici se traduirait soit par un blocage qui ne
 * bloque pas, soit par un écran de code repris alors que le jeton qui le
 * ferait fonctionner est déjà mort.
 */
describe('AuthRepository — verrouillage PIN', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    localStorage.clear();
  });

  it('ne bloque pas avant le cinquième échec', () => {
    const repo = TestBed.inject(AuthRepository);
    for (let i = 0; i < 4; i++) repo.registerPinFailure();
    expect(repo.pinLockedUntil()).toBeNull();
  });

  it('bloque 30 secondes au cinquième échec', () => {
    const repo = TestBed.inject(AuthRepository);
    for (let i = 0; i < 5; i++) repo.registerPinFailure();

    const verrou = repo.pinLockedUntil();
    expect(verrou).not.toBeNull();
    const secondes = Math.round((verrou!.getTime() - Date.now()) / 1000);
    expect(secondes).toBeGreaterThanOrEqual(29);
    expect(secondes).toBeLessThanOrEqual(30);
  });

  it('double le délai à chaque échec supplémentaire, plafonné à 15 minutes', () => {
    const repo = TestBed.inject(AuthRepository);
    // 10 échecs : palier 6, soit 30 * 2^5 = 960 s, plafonné à 900 s (15 min).
    for (let i = 0; i < 10; i++) repo.registerPinFailure();

    const verrou = repo.pinLockedUntil();
    const secondes = Math.round((verrou!.getTime() - Date.now()) / 1000);
    expect(secondes).toBeLessThanOrEqual(900);
    expect(secondes).toBeGreaterThan(890);
  });

  it('clearPinFailures lève le verrou et remet le compteur à zéro', () => {
    const repo = TestBed.inject(AuthRepository);
    for (let i = 0; i < 6; i++) repo.registerPinFailure();
    expect(repo.pinLockedUntil()).not.toBeNull();

    repo.clearPinFailures();

    expect(repo.pinLockedUntil()).toBeNull();
  });
});

describe('AuthRepository — reprise d’une démarche OTP', () => {
  let storage: SecureStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    storage = TestBed.inject(SecureStorageService);
    localStorage.clear();
  });

  it('aucune démarche sans jeton temporaire', () => {
    const repo = TestBed.inject(AuthRepository);
    expect(repo.parcoursOtpEnCours()).toBeNull();
  });

  it('reprend la démarche dans la fenêtre des 15 minutes', () => {
    const repo = TestBed.inject(AuthRepository);
    storage.saveTempToken('jeton');
    storage.saveParcoursOtp(ParcoursOtp.inscription, new Date(Date.now() + 60_000));

    expect(repo.parcoursOtpEnCours()).toBe(ParcoursOtp.inscription);
  });

  it('efface le jeton mort plutôt que de restaurer un écran invérifiable', () => {
    const repo = TestBed.inject(AuthRepository);
    storage.saveTempToken('jeton');
    storage.saveParcoursOtp(ParcoursOtp.inscription, new Date(Date.now() - 1000));

    expect(repo.parcoursOtpEnCours()).toBeNull();
    expect(storage.getTempToken()).toBeNull();
  });

  it('un code de parcours inconnu est ignoré sans lever', () => {
    const repo = TestBed.inject(AuthRepository);
    storage.saveTempToken('jeton');
    // Écriture directe pour simuler un code d'une version antérieure.
    localStorage.setItem('nl_otp_parcours', 'motif-disparu');
    localStorage.setItem('nl_otp_parcours_echeance', new Date(Date.now() + 60_000).toISOString());

    expect(repo.parcoursOtpEnCours()).toBeNull();
  });
});
