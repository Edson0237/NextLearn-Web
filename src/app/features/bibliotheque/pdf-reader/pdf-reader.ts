import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Icon } from '../../../shared/ui/icon/icon';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-pdf-reader',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-reader.html',
  styleUrl: './pdf-reader.scss',
})
export class PdfReader implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly url = signal<SafeResourceUrl | null>(null);
  protected readonly documentId = signal<string>('');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.documentId.set(id);
    if (!id) {
      this.error.set('Document non spécifié.');
      this.loading.set(false);
      return;
    }

    try {
      const fresh = await this.docsRepo.urlLecture(id);
      const finalUrl = fresh || this.route.snapshot.queryParamMap.get('url');
      if (finalUrl) {
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(finalUrl));
        void this.docsRepo.recordView(id);
      } else {
        const doc = await this.docsRepo.getById(id);
        if (doc?.urlPdf) {
          this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(doc.urlPdf));
          void this.docsRepo.recordView(id);
        } else {
          this.error.set('Impossible d\'obtenir l\'URL du document.');
        }
      }
    } catch (e) {
      this.error.set('Impossible d\'ouvrir le document.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.documentDetail.replace(':id', this.documentId())]);
  }

  protected openInNewTab(): void {
    const url = this.route.snapshot.queryParamMap.get('url') ?? '';
    if (url) window.open(url, '_blank');
  }
}
