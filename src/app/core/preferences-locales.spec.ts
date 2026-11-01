import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HistoriqueRecherches } from './recherche/historique-recherches';
import { EchelleTexte, PreferencesAccessibilite } from './preferences/preferences-accessibilite';
import { TraductionService } from './i18n';

/**
 * Les trois réglages que la PWA gardait sur l'appareil sans jamais les
 * appliquer : l'historique de recherche (absent), l'accessibilité et la langue
 * (« bientôt disponible »). Chacun a une règle qui se vérifie sans navigateur.
 */
describe('préférences locales', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  describe('historique de recherche', () => {
    it('garde les plus récentes en tête, sans doublon', () => {
      const h = TestBed.inject(HistoriqueRecherches);
      h.retenir('thermodynamique');
      h.retenir('algèbre');
      h.retenir('THERMODYNAMIQUE');

      expect(h.recentes()).toEqual(['THERMODYNAMIQUE', 'algèbre']);
    });

    it('ignore ce qui est trop court pour être une recherche', () => {
      const h = TestBed.inject(HistoriqueRecherches);
      h.retenir('a');
      h.retenir('  ');
      expect(h.recentes()).toHaveLength(0);
    });

    it('plafonne la liste', () => {
      const h = TestBed.inject(HistoriqueRecherches);
      for (let i = 0; i < 30; i++) h.retenir(`recherche ${i}`);
      expect(h.recentes()).toHaveLength(HistoriqueRecherches.capacite);
      expect(h.recentes()[0]).toBe('recherche 29');
      expect(h.aAfficher()).toHaveLength(HistoriqueRecherches.nombreAffiche);
    });

    it('oublie une entrée à la demande', () => {
      const h = TestBed.inject(HistoriqueRecherches);
      h.retenir('analyse');
      h.retenir('physique');
      h.oublier('analyse');
      expect(h.recentes()).toEqual(['physique']);
    });
  });

  describe('accessibilité', () => {
    it('le choix explicite l’emporte sur le réglage du système', () => {
      // Le système réclame moins de mouvement…
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } as unknown as MediaQueryList);

      const a = TestBed.inject(PreferencesAccessibilite);
      expect(a.mouvementReduit()).toBe(true);

      // …et l'utilisateur dit explicitement le contraire : c'est lui qui
      // décide, exactement comme `AppMotion.reduireLeMouvement`.
      a.definirReduction(false);
      expect(a.mouvementReduit()).toBe(false);

      // Revenir à « suivre le système » rend la main au téléphone.
      a.definirReduction(null);
      expect(a.mouvementReduit()).toBe(true);
    });

    it('retient l’échelle de texte choisie et l’applique au document', () => {
      const a = TestBed.inject(PreferencesAccessibilite);
      a.definirEchelle(EchelleTexte.tresGrande);
      expect(a.echelleTexte()).toBe(EchelleTexte.tresGrande);

      // L'effet qui pose la taille de base n'a lieu qu'au tour suivant : sans
      // ce déclenchement, on testerait le DOM avant qu'il ait changé.
      TestBed.tick();
      expect(document.documentElement.style.fontSize).toBe('130%');
    });
  });

  describe('traductions', () => {
    it('remplace les paramètres et choisit la bonne forme plurielle', () => {
      const t = TestBed.inject(TraductionService);
      // On alimente le dictionnaire comme le ferait le chargement du
      // catalogue, sans dépendre du réseau.
      (t as unknown as { messages: { set: (v: Record<string, string>) => void } }).messages.set({
        profilFichiers: '{nombre, plural, =0{Aucun fichier} =1{1 fichier} other{{nombre} fichiers}}',
        sessionsActifMinutes: 'Actif il y a {minutes} min',
      });

      expect(t.t('profilFichiers', { nombre: 0 })).toBe('Aucun fichier');
      expect(t.t('profilFichiers', { nombre: 1 })).toBe('1 fichier');
      expect(t.t('profilFichiers', { nombre: 7 })).toBe('7 fichiers');
      expect(t.t('sessionsActifMinutes', { minutes: 12 })).toBe('Actif il y a 12 min');
    });

    it('affiche le texte de secours plutôt qu’une clé technique', () => {
      const t = TestBed.inject(TraductionService);
      expect(t.t('cleQuiNExistePas', undefined, 'Texte de secours')).toBe('Texte de secours');
    });
  });
});
