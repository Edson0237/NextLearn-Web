import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../../core/auth';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { PinDialog } from './pin-dialog';

/** Les règles de saisie et l'appel au serveur de la fenêtre PIN, sans l'interface. */
describe('PinDialog', () => {
  const auth = { changerPin: vi.fn(), state: signal({ error: undefined as string | undefined }) };
  const toast = { succes: vi.fn(), erreur: vi.fn() };

  function creer(aUnPin: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: auth }, { provide: ToastService, useValue: toast }],
    });
    const fixture = TestBed.createComponent(PinDialog);
    fixture.componentRef.setInput('aUnPin', aUnPin);
    const c = fixture.componentInstance as any;
    const saisir = (champ: string, v: string) => c.saisir(champ, { target: { value: v } } as unknown as Event);
    return { c, saisir };
  }

  beforeEach(() => { auth.changerPin.mockReset(); toast.succes.mockReset(); });

  it('ne garde que quatre chiffres', () => {
    const { c, saisir } = creer(true);
    saisir('nouveau', 'a1b2c3d4e5');
    expect(c.nouveau()).toBe('1234');
  });

  it('refuse un code actuel manquant, une confirmation différente, un code identique', () => {
    const { c, saisir } = creer(true);
    expect(c.motifDeRefus()).toMatch(/code actuel/);
    saisir('ancien', '1111'); saisir('nouveau', '2222'); saisir('confirmation', '3333');
    expect(c.motifDeRefus()).toMatch(/ne correspondent pas/);
    saisir('confirmation', '2222'); saisir('nouveau', '1111'); saisir('confirmation', '1111');
    expect(c.motifDeRefus()).toMatch(/différent/);
  });

  it('sans PIN, aucun code actuel n’est demandé : on en crée un', async () => {
    auth.changerPin.mockResolvedValue(0);
    const { c, saisir } = creer(false);
    saisir('nouveau', '4821'); saisir('confirmation', '4821');
    expect(c.motifDeRefus()).toBeUndefined();
    let ferme = false;
    c.ferme.subscribe(() => (ferme = true));
    await c.valider();
    expect(auth.changerPin).toHaveBeenCalledWith(undefined, '4821');
    expect(ferme).toBe(true);
    expect(toast.succes).toHaveBeenCalledWith('Code PIN créé.');
  });

  it('avec un PIN, l’ancien code part avec le nouveau, et la fenêtre reste ouverte si le serveur refuse', async () => {
    auth.changerPin.mockResolvedValue(null);
    auth.state.set({ error: 'PIN actuel incorrect' });
    const { c, saisir } = creer(true);
    saisir('ancien', '1111'); saisir('nouveau', '2222'); saisir('confirmation', '2222');
    let ferme = false;
    c.ferme.subscribe(() => (ferme = true));
    await c.valider();
    expect(auth.changerPin).toHaveBeenCalledWith('1111', '2222');
    expect(ferme).toBe(false);
    expect(c.erreur()).toBe('PIN actuel incorrect');
  });

  it('n’émet « enregistre » qu’après un enregistrement réussi', async () => {
    const { c, saisir } = creer(false);
    saisir('nouveau', '4821'); saisir('confirmation', '4821');
    let enregistre = 0;
    c.enregistre.subscribe(() => enregistre++);

    auth.changerPin.mockResolvedValueOnce(null);
    await c.valider();
    expect(enregistre).toBe(0);
    expect(c.erreur()).toBeDefined();

    auth.changerPin.mockResolvedValueOnce(0);
    await c.valider();
    expect(enregistre).toBe(1);
  });
});
