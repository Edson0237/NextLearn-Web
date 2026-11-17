import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { Cycle, Langue, NiveauEtude, UserModel } from '../../../core/models';
import { executerChangementNiveau } from './changement-niveau';

function creerUser(surcharge: Partial<UserModel> = {}): UserModel {
  return {
    id: 'etu-1',
    email: 'etu@sji.cm',
    nom: 'Ndongo',
    prenom: 'Paul',
    universite: 'Saint Jean Ingénieur (SJI)',
    filiere: 'Cycle Ingénieur — Tronc commun',
    niveau: NiveauEtude.n1,
    cycle: Cycle.ingenieur,
    langue: Langue.fr,
    ...surcharge,
  };
}

function setup(userInit: UserModel, overrides: {
  niveaux?: { code: string; label: string }[];
  filieresN3?: { id: string; nom: string; libelle: string }[];
  langue?: 'fr' | 'en';
} = {}) {
  const userSig = signal<{ user?: UserModel }>({ user: userInit });
  const auth: any = {
    state: userSig.asReadonly(),
    niveauxDuCycle: vi.fn().mockResolvedValue({
      niveaux: overrides.niveaux ?? [
        { code: 'N1', label: 'Niveau 1' },
        { code: 'N2', label: 'Niveau 2' },
        { code: 'N3', label: 'Niveau 3' },
        { code: 'N4', label: 'Niveau 4' },
        { code: 'N5', label: 'Niveau 5' },
      ],
    }),
    filieresPourNiveau: vi.fn().mockResolvedValue(
      overrides.filieresN3 ?? [
        { id: 'isi3', nom: 'Cycle Ingénieur — Ingénierie des Systèmes d’Information (ISI)', libelle: 'Cycle Ingénieur - Ingénierie des Systèmes d’Information (ISI)' },
        { id: 'srt3', nom: 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)', libelle: 'Cycle Ingénieur - Systèmes, Réseaux & Télécoms (SRT)' },
        { id: 'gc3', nom: 'Cycle Ingénieur — Génie Civil (GC)', libelle: 'Cycle Ingénieur - Génie Civil (GC)' },
      ],
    ),
    changerNiveau: vi.fn().mockResolvedValue(null),
  };
  const actions: any = { choisir: vi.fn() };
  const toast: any = { succes: vi.fn(), erreur: vi.fn(), info: vi.fn() };
  const fraicheur: any = { tick: vi.fn() };
  const traductions: any = { langue: signal<'fr' | 'en'>(overrides.langue ?? 'fr') };
  return { auth, actions, toast, fraicheur, traductions, userSig };
}

describe('executerChangementNiveau — Tronc commun, ISI, SRT & Génie Civil', () => {
  it('Cas 1 (ISI) et Cas 2 (SRT) : navigue sur N1..N5 sans re-choisir de filière et appelle changerNiveau avec le code seul', async () => {
    const isi = setup(creerUser({
      filiere: 'Cycle Ingénieur — Ingénierie des Systèmes d’Information (ISI)',
      niveau: NiveauEtude.n3,
    }));
    isi.actions.choisir.mockResolvedValueOnce('N2');

    await executerChangementNiveau(isi);
    expect(isi.auth.filieresPourNiveau).not.toHaveBeenCalled();
    expect(isi.auth.changerNiveau).toHaveBeenCalledWith('N2');
    expect(isi.toast.succes).toHaveBeenCalled();
    expect(isi.fraicheur.tick).toHaveBeenCalled();

    const srt = setup(creerUser({
      filiere: 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)',
      niveau: NiveauEtude.n2,
    }));
    srt.actions.choisir.mockResolvedValueOnce('N5');
    await executerChangementNiveau(srt);
    expect(srt.auth.changerNiveau).toHaveBeenCalledWith('N5');
  });

  it('Cas 3 (GC) : filtre N4 et N5 même en repli hors ligne ou réponse périmée et limite à N1..N3', async () => {
    const gcRepli = setup(creerUser({
      filiere: 'Cycle Ingénieur — Génie Civil (GC)',
      niveau: NiveauEtude.n3,
    }), { niveaux: [] });
    gcRepli.actions.choisir.mockResolvedValueOnce('N1');

    await executerChangementNiveau(gcRepli);
    const choixProposes = gcRepli.actions.choisir.mock.calls[0][0].options.map((o: any) => o.value);
    expect(choixProposes).toEqual(['N1', 'N2', 'N3']);
    expect(gcRepli.auth.changerNiveau).toHaveBeenCalledWith('N1');

    const gcServeurPerime = setup(creerUser({
      filiere: 'Cycle Ingénieur — Génie Civil (GC)',
      niveau: NiveauEtude.n2,
    }));
    gcServeurPerime.actions.choisir.mockResolvedValueOnce('N3');
    await executerChangementNiveau(gcServeurPerime);
    const optionsServeur = gcServeurPerime.actions.choisir.mock.calls[0][0].options.map((o: any) => o.value);
    expect(optionsServeur).toEqual(['N1', 'N2', 'N3']);
    expect(gcServeurPerime.auth.changerNiveau).toHaveBeenCalledWith('N3');
  });

  it('Cas 4 (TC) : bascule directement en N1/N2, puis propose ISI, SRT et GC en N3 (y compris depuis un autre N3)', async () => {
    const tc = setup(creerUser({ niveau: NiveauEtude.n1 }));

    // N1 -> N2 direct
    tc.actions.choisir.mockResolvedValueOnce('N2');
    await executerChangementNiveau(tc);
    expect(tc.auth.changerNiveau).toHaveBeenCalledWith('N2');

    // N2 -> N3 => choix entre ISI, SRT et GC
    tc.actions.choisir
      .mockResolvedValueOnce('N3')
      .mockResolvedValueOnce('Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)');
    await executerChangementNiveau(tc);
    expect(tc.auth.filieresPourNiveau).toHaveBeenCalledWith('N3');
    expect(tc.actions.choisir.mock.calls[2][0].options).toHaveLength(3);
    expect(tc.auth.changerNiveau).toHaveBeenCalledWith('N3', 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)');

    // Déjà en N3 (SRT) avec filiereOrigine TC -> peut re-choisir N3 -> GC
    const tcEnN3 = setup(creerUser({
      filiere: 'Cycle Ingénieur — Systèmes, Réseaux & Télécoms (SRT)',
      filiereOrigine: 'Cycle Ingénieur — Tronc commun',
      niveau: NiveauEtude.n3,
    }));
    tcEnN3.actions.choisir
      .mockResolvedValueOnce('N3')
      .mockResolvedValueOnce('Cycle Ingénieur — Génie Civil (GC)');
    await executerChangementNiveau(tcEnN3);
    expect(tcEnN3.auth.changerNiveau).toHaveBeenCalledWith('N3', 'Cycle Ingénieur — Génie Civil (GC)');
  });

  it('Cas limites : annulation du choix de spécialité ou erreur API sans crash', async () => {
    const tc = setup(creerUser({ niveau: NiveauEtude.n1 }));
    tc.actions.choisir
      .mockResolvedValueOnce('N3')
      .mockResolvedValueOnce(undefined);
    await executerChangementNiveau(tc);
    expect(tc.auth.changerNiveau).not.toHaveBeenCalled();

    tc.auth.changerNiveau.mockResolvedValueOnce('Refus serveur');
    tc.actions.choisir.mockResolvedValueOnce('N2');
    await executerChangementNiveau(tc);
    expect(tc.toast.erreur).toHaveBeenCalledWith('Refus serveur');
    expect(tc.fraicheur.tick).not.toHaveBeenCalled();
  });

  it('Non-régression : Prépa IGC reste en N1..N2 sans être traité comme Génie Civil Ingénieur', async () => {
    const prepa = setup(creerUser({
      filiere: 'Ingénieur en Génie Civil (IGC)',
      cycle: Cycle.prepa,
      niveau: NiveauEtude.n1,
    }), { niveaux: [] });
    prepa.actions.choisir.mockResolvedValueOnce('N2');
    await executerChangementNiveau(prepa);
    expect(prepa.actions.choisir.mock.calls[0][0].options.map((o: any) => o.value)).toEqual(['N1', 'N2']);
    expect(prepa.auth.changerNiveau).toHaveBeenCalledWith('N2');
  });
});
