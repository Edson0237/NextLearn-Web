import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorHandler } from '../handlers/app-error-handler';
import { GlobalErrorService } from '../services/global-error.service';

class AppErrorHandlerTestable extends AppErrorHandler {
  readonly rechargements = vi.fn();
  enLigneSimule = true;

  protected override enLigne(): boolean {
    return this.enLigneSimule;
  }

  protected override recharger(): void {
    this.rechargements();
  }
}

describe('AppErrorHandler', () => {
  let handler: AppErrorHandlerTestable;
  let global: GlobalErrorService;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
    sessionStorage.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [GlobalErrorService, AppErrorHandlerTestable],
    });
    handler = TestBed.inject(AppErrorHandlerTestable);
    global = TestBed.inject(GlobalErrorService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('iOS Safari : ignore les erreurs survenues pendant que la feuille Partager floute la page (`blur` sans `hidden`)', () => {
    window.dispatchEvent(new Event('blur'));

    handler.handleError(new TypeError('Importing a module script failed.'));

    expect(global.fatal()).toBeNull();
    expect(handler.rechargements).not.toHaveBeenCalled();
  });

  it('laisse passer le délai de grâce après `focus` puis redevient strict pour les vrais bogues', () => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));

    // Juste après le retour : encore dans la fenêtre de grâce (2 s)
    vi.advanceTimersByTime(500);
    handler.handleError(new Error('Requête tardive interrompue'));
    expect(global.fatal()).toBeNull();

    // Au-delà de 2 s : un vrai bogue redevient fatal
    vi.advanceTimersByTime(2500);
    handler.handleError(new TypeError('Vrai bug applicatif'));
    expect(global.fatal()).not.toBeNull();
  });

  it('recharge une seule fois en cas de chunk manquant ou obsolète puis affiche FatalError en cas d’échec répété', () => {
    const errChunk = new TypeError('Importing a module script failed.');

    handler.handleError(errChunk);
    expect(handler.rechargements).toHaveBeenCalledTimes(1);
    expect(global.fatal()).toBeNull();

    // Anti-boucle : moins de 15 s plus tard, on ne recharge plus en boucle, on signale l’erreur
    vi.advanceTimersByTime(3000);
    handler.handleError(errChunk);
    expect(handler.rechargements).toHaveBeenCalledTimes(1);
    expect(global.fatal()).not.toBeNull();
  });

  it('ne tente pas de recharger sur erreur de chunk quand le navigateur est hors ligne', () => {
    handler.enLigneSimule = false;
    handler.handleError(new TypeError('Failed to fetch dynamically imported module: /chunk-A.js'));

    expect(handler.rechargements).not.toHaveBeenCalled();
    expect(global.fatal()).not.toBeNull();
  });
});
