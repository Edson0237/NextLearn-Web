import { Pipe, PipeTransform, inject } from '@angular/core';
import { TraductionService } from '../services/traduction.service';

/**
 * `{{ 'authEmail' | t }}` - le texte d'une clé, dans la langue courante.
 *
 * Volontairement **impur** : la langue change sans rechargement, et un tube
 * pur garderait la valeur calculée au premier rendu. Le coût est négligeable
 * ici (une lecture de dictionnaire), et c'est le prix d'un sélecteur de langue
 * qui agit tout de suite plutôt qu'à la prochaine visite.
 *
 * Deuxième argument : les paramètres (`{ nombre: 3 }`). Troisième : le texte
 * de secours, affiché tant que la clé n'existe pas - c'est ce qui permet de
 * migrer les écrans un par un sans jamais montrer d'identifiant technique.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TraductionPipe implements PipeTransform {
  private readonly traductions = inject(TraductionService);

  transform(cle: string, params?: Record<string, string | number>, secours?: string): string {
    return this.traductions.t(cle, params, secours);
  }
}
