import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { GlobalErrorService } from './core/error-handling/services/global-error.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('affiche FatalError avec un bouton retour opérationnel en cas d’erreur fatale', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as { rechargerPage: () => void };
    const global = TestBed.inject(GlobalErrorService);
    const router = TestBed.inject(Router);
    const reloadSpy = vi.spyOn(app, 'rechargerPage').mockImplementation(() => undefined);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    global.signaler(new Error('Crash critique'));
    fixture.detectChanges();

    const bouton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('nl-fatal-error button');
    expect(bouton).not.toBeNull();

    bouton!.click();
    fixture.detectChanges();

    expect(global.fatal()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('nl-fatal-error')).toBeNull();
    expect(reloadSpy.mock.calls.length + backSpy.mock.calls.length + navigateSpy.mock.calls.length).toBeGreaterThan(0);

    reloadSpy.mockRestore();
    backSpy.mockRestore();
    navigateSpy.mockRestore();
  });
});
