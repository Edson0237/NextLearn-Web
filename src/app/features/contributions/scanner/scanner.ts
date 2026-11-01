import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TraductionPipe } from '../../../core/i18n';
import { tr } from '../../../core/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AppRoutes } from '../../../core/router';
import { Numerisation, PageNumerisee, ScanTransfert } from '../../../core/scan/numerisation';
import { assemblerPdf } from '../../../core/scan/pdf-assembleur';
import { ReferencesRepository } from '../../../core/references';

/**
 * Numériser un document - traduction de `ScannerService` / `_scanner` de
 * l'application (`lib/core/scan/`, `depot_form_page.dart`).
 *
 * On photographie les pages une à une (ou on les prend dans la galerie), on les
 * retourne si besoin, puis on les réunit en **un seul PDF** qui rejoint le
 * formulaire de dépôt comme s'il avait été importé : même contrôle de taille,
 * même envoi, rien en aval ne sait d'où vient le fichier.
 */
@Component({
  selector: 'nl-scanner',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scanner.html',
  styleUrl: './scanner.scss',
})
export class Scanner implements OnDestroy {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly refs = inject(ReferencesRepository);
  private readonly relais = inject(ScanTransfert);
  protected readonly num = inject(Numerisation);

  protected readonly pages = signal<readonly PageNumerisee[]>([]);
  protected readonly occupe = signal(false);
  protected readonly assemblage = signal(false);
  protected readonly nombre = computed(() => this.pages().length);
  private tailleMaxMo = 50;

  constructor() {
    void this.refs.getLimitesFichier().then((l) => (this.tailleMaxMo = l.maxFileSizeMb)).catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.pages().forEach((p) => this.num.liberer(p));
  }

  protected retour(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }

  /** Ajoute les photos choisies (caméra ou galerie), dans l'ordre où elles arrivent. */
  protected async surFichiers(e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const fichiers = [...(champ.files ?? [])];
    champ.value = ''; // permet de reprendre la même photo
    if (fichiers.length === 0) return;
    this.occupe.set(true);
    try {
      for (const f of fichiers) {
        if (!f.type.startsWith('image/')) {
          this.toast.erreur(tr('scanImageSeulement', 'Choisis une photo : le scanner ne lit que des images.'));
          continue;
        }
        const page = await this.num.creer(f);
        this.pages.update((l) => [...l, page]);
      }
    } catch {
      this.toast.erreur(tr('scanEchoue', 'Numérisation impossible. Réessaie.'));
    } finally {
      this.occupe.set(false);
    }
  }

  protected async tourner(page: PageNumerisee): Promise<void> {
    const neuve = await this.num.retoucher(page, page.rotation + 1);
    this.pages.update((l) => l.map((p) => (p.id === page.id ? neuve : p)));
  }

  protected retirer(page: PageNumerisee): void {
    this.num.liberer(page);
    this.pages.update((l) => l.filter((p) => p.id !== page.id));
  }

  protected monter(i: number): void {
    this.pages.update((l) => {
      if (i <= 0) return l;
      const copie = [...l];
      [copie[i - 1], copie[i]] = [copie[i], copie[i - 1]];
      return copie;
    });
  }

  /** Bascule le traitement « document » et refait toutes les pages. */
  protected async basculerAmelioration(): Promise<void> {
    this.num.ameliorer.update((v) => !v);
    this.occupe.set(true);
    try {
      const refaites = await Promise.all(this.pages().map((p) => this.num.retraiter(p)));
      this.pages.set(refaites);
    } finally {
      this.occupe.set(false);
    }
  }

  protected async terminer(): Promise<void> {
    if (this.nombre() === 0 || this.assemblage()) return;
    this.assemblage.set(true);
    try {
      const pdf = assemblerPdf(this.pages().map((p) => this.num.versJpeg(p)));
      if (pdf.length > this.tailleMaxMo * 1024 * 1024) {
        this.toast.erreur(`Le document dépasse ${this.tailleMaxMo} Mo. Retire quelques pages ou désactive le traitement.`);
        return;
      }
      const copie = new Uint8Array(pdf); // détache le tampon : `File` attend un ArrayBuffer
      this.relais.deposer(new File([copie], `scan-${Date.now()}.pdf`, { type: 'application/pdf' }));
      void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
    } catch {
      this.toast.erreur(tr('scanEchoue', 'Numérisation impossible. Réessaie.'));
    } finally {
      this.assemblage.set(false);
    }
  }
}
