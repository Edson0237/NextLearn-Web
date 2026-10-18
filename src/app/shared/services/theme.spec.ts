import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme';

/**
 * Ce que ce test protège : la persistance elle-même, et le contrat
 * « système par défaut, choix explicite qui l'emporte toujours » — même
 * raisonnement que `ThemeModeNotifier` côté Flutter.
 */
describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('démarre sur « système » sans préférence enregistrée', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('system');
    expect(service.attribute()).toBeNull();
  });

  it('retient le choix explicite d’une visite à l’autre', () => {
    TestBed.inject(ThemeService).set('dark');

    // Un service neuf, comme au rechargement de la page.
    TestBed.resetTestingModule();
    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('dark');
    expect(service.attribute()).toBe('dark');
  });

  it('ignore une valeur corrompue dans le stockage', () => {
    localStorage.setItem('nl_theme_mode', 'violet');
    const service = TestBed.inject(ThemeService);

    expect(service.mode()).toBe('system');
  });
});
