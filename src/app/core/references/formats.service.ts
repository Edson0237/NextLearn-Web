import { Injectable, inject, signal } from '@angular/core';
import { ReferencesRepository } from './references-repository';
import { DocumentType, enregistrerFormatsServeur } from '../bibliotheque/document.model';

/** Un format de ressource tel que l'administration le propose. */
export interface FormatPropose {
  readonly type: DocumentType;
  readonly label: string;
}

/**
 * Les formats de ressource **actifs**, lus sur le serveur (`content_types`).
 *
 * Les écrans portaient chacun leur liste - huit tuiles à l'accueil, dix puces
 * en bibliothèque, quatre dans le formulaire de contribution. Un format
 * désactivé ou ajouté dans l'administration n'y changeait rien, et le
 * formulaire en montrait moins que le catalogue. Ici une seule source ; les
 * listes écrites dans les écrans ne servent plus que de repli tant que le
 * serveur n'a pas répondu (`null`).
 */
@Injectable({ providedIn: 'root' })
export class FormatsService {
  private readonly repo = inject(ReferencesRepository);

  private readonly _formats = signal<readonly FormatPropose[] | null>(null);
  /** `null` tant que le serveur n'a pas répondu. */
  readonly formats = this._formats.asReadonly();

  constructor() {
    void this.charger();
  }

  async charger(): Promise<void> {
    try {
      const brut = await this.repo.getTypesContenu();
      // Les formats que l'application ne nomme pas (créés dans l'administration)
      // sont gardés : ils s'affichent avec le libellé et la couleur du serveur,
      // et l'icône générique d'un document.
      enregistrerFormatsServeur(brut.map((t) => ({ slug: t.value, label: t.label, couleur: t.couleur })));
      const liste = brut
        .map((t) => ({ type: t.value.toLowerCase() as DocumentType, label: t.label }))
        .filter((f) => f.type !== DocumentType.autre);
      if (liste.length > 0) this._formats.set(liste);
    } catch {
      // Hors ligne : on garde les listes de repli.
    }
  }

  /** Ce format est-il proposé ? Vrai tant qu'on ne sait pas. */
  actif(type: DocumentType): boolean {
    const f = this._formats();
    return f === null || f.some((x) => x.type === type);
  }

  libelle(type: DocumentType): string | undefined {
    return this._formats()?.find((f) => f.type === type)?.label;
  }
}
