import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { GithubIdentite, GoogleIdentite } from '../../core/auth';
import { LoginPin } from './login-pin/login-pin';
import { Register } from './register/register';

describe('PWA Connexion & Inscription — divulgation progressive et chargement Google direct', () => {
  function creerMockGoogle() {
    return {
      disponible: signal(false),
      desactive: signal(false),
      preparer: vi.fn(async () => false),
      afficherBouton: vi.fn(),
    };
  }

  function creerMockGithub() {
    return {
      disponible: signal(false),
      desactive: signal(true),
      preparer: vi.fn(async () => false),
    };
  }

  it('LoginPin : appelle google.preparer() directement à la construction et replie les champs e-mail au départ', () => {
    const google = creerMockGoogle();
    const github = creerMockGithub();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GoogleIdentite, useValue: google },
        { provide: GithubIdentite, useValue: github },
      ],
    });

    const fixture = TestBed.createComponent(LoginPin);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(google.preparer).toHaveBeenCalled();

    const panneau = el.querySelector('.nl-loginpin__progressif')!;
    expect(panneau.classList.contains('nl-loginpin__progressif--ouvert')).toBe(false);
    expect(panneau.getAttribute('aria-hidden')).toBe('true');
    expect(panneau.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('nl-mentions-legales')).not.toBeNull();
    expect(el.querySelector('.nl-loginpin__toggle')).not.toBeNull();

    // Déplier
    (el.querySelector('.nl-loginpin__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(panneau.classList.contains('nl-loginpin__progressif--ouvert')).toBe(true);
    expect(panneau.getAttribute('aria-hidden')).toBe('false');
    expect(panneau.hasAttribute('inert')).toBe(false);
    expect(el.querySelector('.nl-loginpin__toggle')).toBeNull();
    expect(el.querySelector('nl-mentions-legales')).not.toBeNull();

    // Revenir en arrière
    (el.querySelector('.nl-loginpin__replier') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(panneau.classList.contains('nl-loginpin__progressif--ouvert')).toBe(false);
    expect(panneau.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('.nl-loginpin__toggle')).not.toBeNull();
  });

  it('Register : appelle google.preparer() directement à la construction et replie les champs jusqu’au tap', () => {
    const google = creerMockGoogle();
    const github = creerMockGithub();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GoogleIdentite, useValue: google },
        { provide: GithubIdentite, useValue: github },
      ],
    });

    const fixture = TestBed.createComponent(Register);
    const controller = TestBed.inject(HttpTestingController);
    controller.expectOne('/api/references/universites').flush({ data: [] });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(google.preparer).toHaveBeenCalled();

    const panneau = el.querySelector('.nl-reg__progressif')!;
    expect(panneau.classList.contains('nl-reg__progressif--ouvert')).toBe(false);
    expect(panneau.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('nl-mentions-legales')).not.toBeNull();
    expect(el.querySelector('.nl-reg__toggle')).not.toBeNull();

    // Déplier
    (el.querySelector('.nl-reg__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(panneau.classList.contains('nl-reg__progressif--ouvert')).toBe(true);
    expect(panneau.hasAttribute('inert')).toBe(false);
    expect(el.querySelector('.nl-reg__toggle')).toBeNull();
    expect(el.querySelector('nl-mentions-legales')).not.toBeNull();

    // Revenir en arrière
    (el.querySelector('.nl-reg__replier') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(panneau.classList.contains('nl-reg__progressif--ouvert')).toBe(false);
    expect(panneau.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('.nl-reg__toggle')).not.toBeNull();
    controller.verify();
  });
});
