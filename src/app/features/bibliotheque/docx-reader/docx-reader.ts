import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PdfReader } from '../pdf-reader/pdf-reader';

/**
 * DocxReader - Lecteur DOCX dédié pour NextLearn Web
 *
 * Encapsule et réutilise l'architecture éprouvée du lecteur de documents :
 * gestion de l'historique de navigation, reprise de page, session d'étude,
 * cache PWA hors ligne et sécurité des documents signés.
 */
@Component({
  selector: 'nl-docx-reader',
  standalone: true,
  imports: [PdfReader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nl-pdf-reader />`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class DocxReader {}
