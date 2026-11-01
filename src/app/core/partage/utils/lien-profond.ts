import { API_BASE_URL } from '../../network/config/api-config';

/**
 * Les liens partageables vers un contenu - traduction de `LienProfond`
 * (`lib/core/partage/lien_profond.dart`).
 *
 * La PWA partageait `window.location.href`, c'est-à-dire une URL qui lui est
 * propre. Un téléphone équipé de l'application mobile ne la reconnaissait pas
 * et l'ouvrait dans un navigateur ; et un lien reçu depuis l'application
 * (`.../d/<id>`) n'était compris par aucun écran de la PWA. Deux formats pour
 * un même geste : le lien ne survivait pas au passage d'une plateforme à
 * l'autre.
 *
 * Le format est donc repris tel quel, hôte compris - l'API sert déjà
 * `/.well-known/assetlinks.json` et une page de secours sur `/d/:id`, ce qui
 * fait de cet hôte le seul que les systèmes associent à l'application.
 *
 * Le lien ne porte **que l'identifiant**. Ni titre, ni matière, ni école : un
 * lien voyage sur des messageries, se recopie, s'archive.
 */
export abstract class LienProfond {
  /** Segment qui distingue un lien de document. Court : un lien long se fait tronquer. */
  static readonly segmentDocument = 'd';

  private static get base(): string {
    return API_BASE_URL.replace(/\/+$/, '');
  }

  /** Le lien à partager pour ce document. */
  static document(id: string): string {
    return `${this.base}/${this.segmentDocument}/${id}`;
  }

  /**
   * L'identifiant de document porté par ce chemin, s'il en porte un.
   *
   * Rend `null` pour tout le reste : le routeur n'a pas à deviner, et un
   * chemin inconnu doit suivre son cours normal plutôt que d'ouvrir une fiche
   * au hasard.
   */
  static documentDepuisChemin(chemin: string): string | null {
    const segments = chemin.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== this.segmentDocument) return null;
    const id = segments[1].trim();
    return id.length > 0 ? id : null;
  }
}
