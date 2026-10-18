import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ILLUSTRATION_PATHS, IllustrationName } from './illustration-paths';

/**
 * Une illustration d'écran vide — voir `illustration-paths.ts`.
 *
 * `bypassSecurityTrustHtml` est sûr ici précisément parce que le contenu
 * n'a rien d'externe : il vient d'un fichier TypeScript écrit à la
 * compilation, jamais d'une entrée utilisateur.
 */
@Component({
  selector: 'nl-illustration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.viewBox]="viewBox()" fill="currentColor" aria-hidden="true"
         [innerHTML]="markup()"></svg>
  `,
  styles: [':host { display: block; }'],
})
export class Illustration {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IllustrationName>();
  readonly size = input(160);

  private readonly entree = computed(() => ILLUSTRATION_PATHS[this.name()]);
  protected readonly viewBox = computed(() => this.entree()?.viewBox ?? '0 0 1 1');
  protected readonly markup = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.entree()?.markup ?? ''),
  );
}
