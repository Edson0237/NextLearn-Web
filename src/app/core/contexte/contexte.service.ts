import { inject, Injectable, signal, computed } from '@angular/core';
import { ContexteRepository } from './contexte-repository';
import { ContexteEtudiant, CONTEXTE_OUVERT, typeVisible, fonctionnaliteOuverte } from './contexte.model';
import { DocumentType } from '../bibliotheque/document.model';

/**
 * État réactif du contexte étudiant — traduction de `contexteCourantProvider`.
 */
@Injectable({ providedIn: 'root' })
export class ContexteService {
  private readonly repo = inject(ContexteRepository);

  private readonly _contexte = signal<ContexteEtudiant>(CONTEXTE_OUVERT);
  readonly contexte = computed(() => this._contexte());
  readonly matieres = computed(() => this._contexte().matieres);
  readonly typesVisibles = computed(() => this._contexte().typesVisibles);
  readonly fonctionnalites = computed(() => this._contexte().fonctionnalites);

  constructor() {
    void this.charger();
  }

  async charger(): Promise<void> {
    const ctx = await this.repo.charger();
    this._contexte.set(ctx);
  }

  typeVisible(type: DocumentType): boolean {
    return typeVisible(this._contexte(), type);
  }

  fonctionnaliteOuverte(nom: string): boolean {
    return fonctionnaliteOuverte(this._contexte(), nom);
  }
}
