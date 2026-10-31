import { Pipe, PipeTransform } from '@angular/core';
import { DocumentType, formatServeur, labelTypeDocument, typeConnu } from '../../../core/bibliotheque/document.model';
import { IconName } from '../icon/icon-paths';

/**
 * L'apparence d'un type de document : libellé, icône, teinte et fond.
 *
 * Elle vivait dans le modèle de données (`core`), qui importait pour cela les
 * noms d'icônes de l'interface — et sept écrans en recopiaient chacun quatre
 * méthodes d'enrobage. Le modèle ne dit plus que ce qu'est un type ; ce qui
 * s'en voit se décide ici, une seule fois.
 */
export interface PresentationType {
  readonly label: string;
  readonly icone: IconName;
  readonly couleur: string;
  readonly fond: string;
}

const hexValide = (c?: string): c is string => !!c && /^#[0-9a-f]{3,8}$/i.test(c);

/** L'icône d'un type. Un TP n'est ni un cours ni un document générique : chaque type a la sienne. */
export function iconeTypeDocument(type: DocumentType): IconName {
  switch (type) {
    case DocumentType.cours: return 'menu_book';
    case DocumentType.td: return 'edit_note';
    case DocumentType.tp: return 'science';
    case DocumentType.synthese: return 'summarize';
    case DocumentType.epreuve: return 'assignment';
    case DocumentType.annales: return 'history_edu';
    case DocumentType.corrige: return 'task_alt';
    case DocumentType.rapport: return 'article';
    case DocumentType.expose: return 'slideshow';
    default: return 'description';
  }
}

/** Le fond teinté assorti à la couleur du type. */
export function fondTypeDocument(type: DocumentType): string {
  if (type === DocumentType.autre) return 'var(--bg-secondary)';
  if (!typeConnu(type)) {
    const c = formatServeur(type)?.couleur;
    return hexValide(c) ? `color-mix(in srgb, ${c} 14%, var(--bg-primary))` : 'var(--bg-secondary)';
  }
  return `var(--type-${type}-soft)`;
}

/**
 * La teinte d'un type de document, **dans le thème actif** : des variables CSS
 * (`_tokens.scss`) à paire clair/sombre, jamais des valeurs figées — celles-ci
 * délavaient toute la bibliothèque en plein jour.
 */
export function couleurTypeDocument(type: DocumentType): string {
  if (type === DocumentType.autre) return 'var(--neutral)';
  if (!typeConnu(type)) {
    const c = formatServeur(type)?.couleur;
    // Mêlée au texte : la couleur de l'administration ignore le thème.
    return hexValide(c) ? `color-mix(in srgb, ${c} 75%, var(--text-primary))` : 'var(--neutral)';
  }
  return `var(--type-${type})`;
}

/** Tout ce qu'un écran affiche d'un type. `null` : « tous les types » (le premier onglet). */
export function presentationType(type: DocumentType | null): PresentationType {
  if (type === null) {
    return { label: 'Document', icone: 'grid_view', couleur: 'var(--primary)', fond: 'var(--primary-soft)' };
  }
  return {
    label: labelTypeDocument(type),
    icone: iconeTypeDocument(type),
    couleur: couleurTypeDocument(type),
    fond: fondTypeDocument(type),
  };
}

/** `{{ doc.type | typeDoc }}` — pour les gabarits ; pur, donc recalculé seulement si le type change. */
@Pipe({ name: 'typeDoc', standalone: true })
export class TypeDocumentPipe implements PipeTransform {
  transform(type: DocumentType | null): PresentationType {
    return presentationType(type);
  }
}
