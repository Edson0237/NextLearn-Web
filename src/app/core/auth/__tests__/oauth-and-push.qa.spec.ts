import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  GithubIdentite,
  versBase64Url,
  genererEtatOAuth,
  genererPkceVerifier,
  calculerPkceChallengeS256,
} from '../services/github-identite';
import { GoogleIdentite } from '../services/google-identite';
import { AuthRepository } from '../repositories/auth-repository';
import { AUTH_PATH } from '../../network/config/api-config';
import { PushService } from '../../notifications/services/push.service';
import { PreferenceNotifications } from '../../notifications/services/preference-notifications';
import { Failure } from '../../models';

describe('GithubIdentite, GoogleIdentite, PushService & PreferenceNotifications — QA Coverage Suite', () => {
  let httpMock: HttpTestingController;

  const pushManagerDesc = Object.getOwnPropertyDescriptor(window, 'PushManager');
  const notificationDesc = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
  const swDesc = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (window.google) delete (window as { google?: unknown }).google;
    if (pushManagerDesc) Object.defineProperty(window, 'PushManager', pushManagerDesc);
    else delete (window as { PushManager?: unknown }).PushManager;
    if (notificationDesc) Object.defineProperty(globalThis, 'Notification', notificationDesc);
    else delete (globalThis as { Notification?: unknown }).Notification;
    if (swDesc) Object.defineProperty(navigator, 'serviceWorker', swDesc);
    else if ('serviceWorker' in navigator) delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    TestBed.resetTestingModule();
  });

  it('GithubIdentite construit PKCE S256, valide le retour OAuth et rejette un state forgé', async () => {
    expect(versBase64Url(new Uint8Array([251, 255]))).toBe('-_8');
    expect(genererEtatOAuth().length).toBeGreaterThanOrEqual(32);
    const verifier = genererPkceVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const challenge = await calculerPkceChallengeS256(verifier);
    expect(challenge).not.toBe(verifier);

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const github = TestBed.inject(GithubIdentite);
    httpMock = TestBed.inject(HttpTestingController);

    const pUrl = github.construireUrlRedirection('https://app.test/auth/github/callback');
    httpMock.expectOne(`${AUTH_PATH}/github/config`).flush({
      data: { enabled: true, clientId: 'gh-client-1', scope: 'read:user' },
    });
    const url = new URL(await pUrl);
    expect(url.searchParams.get('client_id')).toBe('gh-client-1');
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();

    // Retour valide -> nettoie sessionStorage & rend code + codeVerifier
    const retour = github.verifierRetour({ code: 'gh-code-1', state });
    expect(retour.code).toBe('gh-code-1');
    expect(retour.codeVerifier).toBeTruthy();
    expect(() => github.verifierRetour({ code: 'gh-code-1', state })).toThrow(Failure);
    expect(() => github.verifierRetour({ error: 'access_denied' })).toThrow(Failure);

    github.masquerSiNonConfigure();
    expect(github.desactive()).toBe(true);
    httpMock.verify();
  });

  it('GoogleIdentite gère config désactivée, script GIS prêt et rendu bouton', async () => {
    const authRepoStub = {
      configGoogle: vi.fn(async () => ({ enabled: true, clientId: 'google-cid-1' })),
    };
    const renderButton = vi.fn();
    const initialize = vi.fn();
    (window as { google?: unknown }).google = { accounts: { id: { initialize, renderButton } } };

    TestBed.configureTestingModule({
      providers: [{ provide: AuthRepository, useValue: authRepoStub }],
    });
    const google = TestBed.inject(GoogleIdentite);
    expect(await google.preparer()).toBe(true);
    expect(google.disponible()).toBe(true);
    expect(initialize).toHaveBeenCalled();

    const host = document.createElement('div');
    const onToken = vi.fn();
    google.afficherBouton(host, onToken, { texte: 'continue_with', largeur: 300 });
    expect(renderButton).toHaveBeenCalled();

    // Déclenche le callback enregistré par initialize()
    const cfg = initialize.mock.calls[0][0] as { callback: (r: { credential?: string }) => void };
    cfg.callback({ credential: 'jwt-id-token' });
    expect(onToken).toHaveBeenCalledWith('jwt-id-token');
  });

  it('PushService et PreferenceNotifications gèrent support navigateur, config absente et bascule', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const push = TestBed.inject(PushService);
    const pref = TestBed.inject(PreferenceNotifications);

    // Sans Notification/PushManager en jsdom -> indisponible
    expect(await pref.definir(true)).toBe('indisponible');
    expect(await pref.definir(false)).toBe('inactif');
    expect(localStorage.getItem('nl_notifications_actives')).toBe('0');
    await pref.rebrancher();

    // Simule un navigateur supportant Push mais sans config Firebase
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function () {} });
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: Object.assign(function () {}, { permission: 'default', requestPermission: vi.fn(async () => 'denied') }),
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn() } });

    const pActiver = push.activer();
    httpMock.expectOne('/firebase-config.json').flush({}, { status: 404, statusText: 'Not found' });
    expect(await pActiver).toBe('non-configure');

    httpMock.verify();
  });
});
