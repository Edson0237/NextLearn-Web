import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router';

type LegalDocKey = 'confidentialite' | 'conditions';

@Component({
  selector: 'nl-legal-document',
  standalone: true,
  imports: [TraductionPipe, CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-document.html',
  styleUrl: './legal-document.scss',
})
export class LegalDocument {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly doc = signal<LegalDocKey | null>(null);
  /** Clé de traduction du titre : le texte suit la langue choisie dans les Réglages. */
  protected readonly titleKey = signal('pwaDocumentInconnu');

  /**
   * L'URL du document, marquée sûre pour un contexte de ressource.
   *
   * Angular refuse une chaîne brute sur le `src` d'une `iframe` et lève
   * `NG0904` : le cadre restait vide et seul le titre s'affichait - sur les
   * deux textes que les magasins exigent de rendre lisibles dans
   * l'application.
   *
   * Le marquage ne vaut que parce que la valeur ne vient pas de l'extérieur :
   * `doc` est l'une des deux clés de la liste blanche ci-dessous, jamais le
   * paramètre d'URL tel quel.
   */
  protected readonly src = signal<SafeResourceUrl | null>(null);

  constructor() {
    const key = (this.route.snapshot.paramMap.get('doc') ?? '') as LegalDocKey;
    const connu = key === 'confidentialite' || key === 'conditions';
    this.doc.set(connu ? key : null);
    this.titleKey.set(
      key === 'confidentialite'
        ? 'legalConfidentialite'
        : key === 'conditions'
          ? 'legalConditions'
          : 'pwaDocumentInconnu',
    );
    if (connu) {
      this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(`/${key}/index.html`));
    }
  }

  protected goBack(): void {
    // L'historique plutôt qu'une destination fixe : ces textes s'ouvrent
    // aussi depuis l'inscription, où personne n'a encore de profil où
    // retourner.
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/app', AppRoutes.profil]);
  }
}
