import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AuthRepository,
  GithubIdentite,
  calculerPkceChallengeS256,
  genererEtatOAuth,
  genererPkceVerifier,
} from '../index';

describe('GithubIdentite (Chantier P4)', () => {
  const configGithubMock = vi.fn();

  beforeEach(() => {
    configGithubMock.mockReset();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        GithubIdentite,
        {
          provide: AuthRepository,
          useValue: { configGithub: configGithubMock },
        },
      ],
    });
  });

  it('génère un state >= 16 octets et un code_verifier PKCE valide (43..128 car.) avec challenge S256', async () => {
    const state = genererEtatOAuth();
    expect(state.length).toBeGreaterThanOrEqual(22);

    const verifier = genererPkceVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);

    const challenge = await calculerPkceChallengeS256(verifier);
    expect(challenge.length).toBeGreaterThan(20);
    expect(challenge).not.toBe(verifier);
    expect(challenge).not.toContain('=');
  });

  it('désactive le bouton lorsque le serveur répond enabled: false', async () => {
    configGithubMock.mockResolvedValue({ enabled: false });
    const service = TestBed.inject(GithubIdentite);
    const ok = await service.preparer();
    expect(ok).toBe(false);
    expect(service.disponible()).toBe(false);
    expect(service.desactive()).toBe(true);
  });

  it('construit l’URL d’autorisation avec state et PKCE S256, nettoie l’URL au retour et refuse un state falsifié', async () => {
    configGithubMock.mockResolvedValue({
      enabled: true,
      clientId: 'Iv1.testclient',
      scope: 'read:user user:email',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
    });

    const service = TestBed.inject(GithubIdentite);
    const urlStr = await service.construireUrlRedirection('https://nextlearn.cm/auth/github/callback');
    const url = new URL(urlStr);

    expect(url.searchParams.get('client_id')).toBe('Iv1.testclient');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const stateAttendu = url.searchParams.get('state');
    expect(stateAttendu).toBeTruthy();

    const spyReplace = vi.spyOn(window.history, 'replaceState');

    // 1. Retour avec state falsifié -> refusé + URL nettoyée + sessionStorage vidé
    expect(() =>
      service.verifierRetour({ code: 'gh_code_123', state: 'state_falsifie' }),
    ).toThrow(/state invalide/i);
    expect(spyReplace).toHaveBeenCalled();
    expect(sessionStorage.getItem('nl_github_oauth_state')).toBeNull();
    expect(sessionStorage.getItem('nl_github_pkce_verifier')).toBeNull();

    // 2. Nouveau flux avec state valide -> accepté
    const urlStr2 = await service.construireUrlRedirection('https://nextlearn.cm/auth/github/callback');
    const stateValide = new URL(urlStr2).searchParams.get('state')!;
    const retour = service.verifierRetour({ code: 'gh_code_ok', state: stateValide });
    expect(retour.code).toBe('gh_code_ok');
    expect(retour.redirectUri).toBe('https://nextlearn.cm/auth/github/callback');
    expect(retour.codeVerifier).toBeTruthy();
  });
});
