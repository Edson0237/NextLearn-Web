import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallationService } from './installation.service';

/** Une invitation `beforeinstallprompt` simulée, avec le choix que l'utilisateur fera. */
function invitation(issue: 'accepted' | 'dismissed' | 'erreur') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => {
    if (issue === 'erreur') throw new Error('refusé par le navigateur');
  });
  e.userChoice = Promise.resolve({ outcome: issue === 'erreur' ? 'dismissed' : issue });
  return e;
}

describe('InstallationService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });
  afterEach(() => TestBed.resetTestingModule());

  const creer = () => TestBed.inject(InstallationService);

  it('n’a aucune invitation tant que le navigateur n’en a pas émis', () => {
    const s = creer();
    expect(s.invitationDisponible()).toBe(false);
    expect(s.peutProposer()).toBe(false);
    expect(s.dernierResultat()).toBeNull();
  });

  it('retient l’invitation et empêche l’affichage natif du navigateur', () => {
    const s = creer();
    const e = invitation('accepted');
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(s.invitationDisponible()).toBe(true);
    // Retenir l'événement ne déclenche rien : seul un clic le fait.
    expect(e.prompt).not.toHaveBeenCalled();
  });

  it('proposer() sans invitation ne fait rien', async () => {
    expect(await creer().proposer()).toBe(false);
  });

  it('un choix « installer » est rendu comme accepté, sans déclarer l’application installée', async () => {
    const s = creer();
    const e = invitation('accepted');
    window.dispatchEvent(e);
    expect(await s.proposer()).toBe(true);
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(s.dernierResultat()).toBe('accepte');
    // Seul « appinstalled » (ou le mode autonome) confirme l'installation.
    expect(s.dejaInstallee()).toBe(false);
    expect(s.invitationDisponible()).toBe(false);
  });

  it('« appinstalled » confirme l’installation', () => {
    const s = creer();
    window.dispatchEvent(invitation('accepted'));
    window.dispatchEvent(new Event('appinstalled'));
    expect(s.dejaInstallee()).toBe(true);
    expect(s.invitationDisponible()).toBe(false);
  });

  it('un refus est retenu : le bandeau disparaît, le guide garde son bouton à la prochaine invitation', async () => {
    const s = creer();
    window.dispatchEvent(invitation('dismissed'));
    expect(await s.proposer()).toBe(false);
    expect(s.dernierResultat()).toBe('refuse');
    expect(localStorage.getItem('nl_install_refuse')).toBe('1');

    window.dispatchEvent(invitation('accepted'));
    expect(s.invitationDisponible()).toBe(true);
    expect(s.peutProposer()).toBe(false);
  });

  it('un refus mémorisé survit à un rechargement', () => {
    localStorage.setItem('nl_install_refuse', '1');
    const s = creer();
    window.dispatchEvent(invitation('accepted'));
    expect(s.peutProposer()).toBe(false);
    expect(s.bandeauVisible()).toBe(false);
  });

  it('une erreur du navigateur est signalée, pas avalée en succès', async () => {
    const s = creer();
    window.dispatchEvent(invitation('erreur'));
    expect(await s.proposer()).toBe(false);
    expect(s.dernierResultat()).toBe('echec');
    expect(s.dejaInstallee()).toBe(false);
  });

  it('ne cumule pas d’écouteurs : une seule instance réagit', () => {
    const s = creer();
    const e = invitation('accepted');
    window.dispatchEvent(e);
    window.dispatchEvent(invitation('accepted'));
    expect(s.invitationDisponible()).toBe(true);
  });

  it('retire ses écouteurs à la destruction', () => {
    const s = creer();
    TestBed.resetTestingModule();
    window.dispatchEvent(invitation('accepted'));
    expect(s.invitationDisponible()).toBe(false);
  });
});
