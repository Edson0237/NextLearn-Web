import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthRepository } from './auth-repository';
import { SecureStorageService } from '../storage/secure-storage.service';
import { ParcoursOtp } from '../models/parcours-otp.model';

/**
 * Ce que ce test protège : la fenêtre de reprise d'une démarche OTP (15
 * minutes, calée sur la durée de vie du jeton temporaire côté serveur). Une
 * off-by-one ici se traduirait par un écran de code repris alors que le jeton
 * qui le ferait fonctionner est déjà mort. (Le blocage après échecs de PIN a
 * son propre test : `verrou-pin.spec.ts`.)
 */
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
