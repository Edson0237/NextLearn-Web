import { Injectable, inject, signal } from '@angular/core';
import { FavorisRepository } from '../../core/bibliotheque';
import { ToastService } from '../ui/toast/toast';
import { tr } from '../../core/i18n';

/**
 * Les ressources mises en favoris, partagées par tous les écrans.
 *
 * Le favori ne se gérait que depuis la fiche d'une ressource : pour en
 * ajouter un depuis une liste, il fallait ouvrir la fiche. Les cartes ont
 * maintenant leur bouton, et il leur faut un état commun - sinon le cœur
 * d'une carte resterait vide pendant que la fiche, ouverte juste après, le
 * montre plein.
 *
 * La bascule est optimiste (le doigt n'attend pas le réseau) et revient en
 * arrière, avec un message, si le serveur refuse.
 */
@Injectable({ providedIn: 'root' })
export class FavorisEtat {
  private readonly repo = inject(FavorisRepository);
  private readonly toast = inject(ToastService);

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  readonly ids = this._ids.asReadonly();
  private charge: Promise<void> | null = null;

  /** Charge la liste une fois ; les appels suivants attendent le même chargement. */
  charger(): Promise<void> {
    return (this.charge ??= this.repo
      .getFavorites()
      .then((docs) => this._ids.set(new Set(docs.map((d) => d.id))))
      .catch(() => {
        // Hors ligne ou non connecté : on réessaiera au prochain appel.
        this.charge = null;
      }));
  }

  estFavori(id: string): boolean {
    return this._ids().has(id);
  }

  /** À appeler quand la session change : les favoris d'un autre compte ne sont pas les siens. */
  oublier(): void {
    this.charge = null;
    this._ids.set(new Set());
  }

  async basculer(id: string): Promise<void> {
    const avant = this._ids();
    const etaitFavori = avant.has(id);
    const apres = new Set(avant);
    if (etaitFavori) apres.delete(id); else apres.add(id);
    this._ids.set(apres);
    try {
      if (etaitFavori) await this.repo.removeFavorite(id);
      else await this.repo.addFavorite(id);
      this.toast.succes(
        etaitFavori
          ? tr('pwaFavoriRetire', 'Retiré des favoris.')
          : tr('pwaFavoriAjoute', 'Ajouté aux favoris.'),
      );
    } catch {
      this._ids.set(avant);
      this.toast.erreur(tr('pwaFavoriNonEnregistre', 'Le favori n’a pas pu être enregistré.'));
    }
  }
}
