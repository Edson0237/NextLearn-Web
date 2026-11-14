import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TraductionPipe, tr } from '../../../core/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { AppRoutes } from '../../../core/router';
import { assemblerPdf, ModeScan, Numerisation, PageNumerisee, Quad, Reglages, ScanTransfert, verifierPdf } from '../../../core/scan';
import { ReferencesRepository } from '../../../core/references';
import { CameraScan } from './camera-scan';
import { Recadrage } from './recadrage';

type Etape = 'pages' | 'edition' | 'apercu';

interface ResumePdf {
  readonly pages: number;
  readonly octets: number;
}

/**
 * Numériser un document.
 *
 * Trois façons d'entrer - la caméra (avec repérage de la page en direct), des
 * photos de la galerie, un PDF déjà prêt -, puis, pour les photos : cadrage de
 * chaque page (automatique, ou à la main), mode et lisibilité, ordre des
 * pages, aperçu du PDF final. Le PDF rejoint ensuite le formulaire de dépôt
 * comme s'il avait été importé : même contrôle de taille, même envoi.
 */
@Component({
  selector: 'nl-scanner',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar, CameraScan, Recadrage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scanner.html',
  styleUrl: './scanner.scss',
})
export class Scanner implements OnDestroy {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly refs = inject(ReferencesRepository);
  private readonly relais = inject(ScanTransfert);
  private readonly actions = inject(FeuilleActionService);
  protected readonly num = inject(Numerisation);

  protected readonly pages = signal<readonly PageNumerisee[]>([]);
  protected readonly etape = signal<Etape>('pages');
  protected readonly camera = signal(false);
  protected readonly occupe = signal(false);
  protected readonly assemblage = signal(false);
  protected readonly nombre = computed(() => this.pages().length);
  protected readonly resume = signal<ResumePdf | null>(null);
  protected readonly modes: readonly { code: ModeScan; cle: string }[] = [
    { code: 'couleur', cle: 'scanModeCouleur' },
    { code: 'gris', cle: 'scanModeGris' },
    { code: 'nb', cle: 'scanModeNb' },
  ];

  /** La page ouverte dans l'éditeur, et ce qu'elle était avant, pour pouvoir annuler. */
  protected readonly editeeId = signal<number | null>(null);
  protected readonly editee = computed(() => this.pages().find((p) => p.id === this.editeeId()) ?? null);
  private avant: { coins: Quad; detectee: boolean; reglages: Reglages } | null = null;
  private minuterieRendu: ReturnType<typeof setTimeout> | undefined;
  private retoucheEnAttente: Parameters<Numerisation['retoucher']>[1] | null = null;
  private rendu = 0;

  private pdf: Uint8Array | null = null;
  private tailleMaxMo = 50;
  private readonly champSysteme = viewChild<ElementRef<HTMLInputElement>>('champSysteme');
  private readonly recadrage = viewChild(Recadrage);

  constructor() {
    void this.refs.getLimitesFichier().then((l) => (this.tailleMaxMo = l.maxFileSizeMb)).catch(() => undefined);
  }

  ngOnDestroy(): void {
    clearTimeout(this.minuterieRendu);
    this.pages().forEach((p) => this.num.liberer(p));
  }

  protected async retour(): Promise<void> {
    if (this.etape() === 'edition') return this.fermerEdition(true);
    if (this.etape() === 'apercu') {
      this.etape.set('pages');
      return;
    }
    if (this.nombre() > 0) {
      const quitter = await this.actions.confirmer({
        title: tr('scanQuitterTitre', 'Quitter le scanner ?'),
        description: tr('scanQuitterAide', 'Les pages numérisées seront perdues.'),
        confirmLabel: tr('scanQuitter', 'Quitter'),
        cancelLabel: tr('scanRester', 'Rester'),
        destructive: true,
      });
      if (!quitter) return;
    }
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }

  // ── Entrées : caméra, galerie, PDF ───────────────────────────────────────

  protected ouvrirCamera(): void {
    this.camera.set(true);
  }

  /** La caméra intégrée n'est pas utilisable : on passe par l'appareil photo du système. */
  protected utiliserSysteme(): void {
    this.camera.set(false);
    setTimeout(() => this.champSysteme()?.nativeElement.click());
  }

  protected async surPhotoCamera(fichier: File): Promise<void> {
    this.camera.set(false);
    await this.ajouter([fichier]);
  }

  protected async surFichiers(e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const fichiers = [...(champ.files ?? [])];
    champ.value = ''; // permet de reprendre la même photo
    await this.ajouter(fichiers);
  }

  private async ajouter(fichiers: File[]): Promise<void> {
    if (fichiers.length === 0) return;
    this.occupe.set(true);
    try {
      for (const f of fichiers) {
        const estImage = f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);
        if (!estImage) {
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

  /** Un PDF déjà prêt : contrôlé, puis confié au formulaire sans passer par les pages. */
  protected async surPdf(e: Event): Promise<void> {
    const champ = e.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (!fichier) return;
    if (fichier.size > this.tailleMaxMo * 1024 * 1024) {
      this.toast.erreur(`Le fichier dépasse ${this.tailleMaxMo} Mo.`);
      return;
    }
    const entete = new TextDecoder('latin1').decode(await fichier.slice(0, 5).arrayBuffer());
    if (entete !== '%PDF-') {
      this.toast.erreur(tr('scanPdfInvalide', 'Ce fichier n’est pas un PDF valide.'));
      return;
    }
    this.relais.deposer(fichier);
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }

  // ── Pages : tourner, ordonner, retirer ───────────────────────────────────

  protected async tourner(page: PageNumerisee): Promise<void> {
    await this.appliquer(page, { rotation: page.rotation + 1 });
  }

  protected retirer(page: PageNumerisee): void {
    this.num.liberer(page);
    this.pages.update((l) => l.filter((p) => p.id !== page.id));
    this.pdf = null;
  }

  protected deplacer(i: number, sens: -1 | 1): void {
    this.pages.update((l) => {
      const j = i + sens;
      if (j < 0 || j >= l.length) return l;
      const copie = [...l];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });
    this.pdf = null;
  }

  private async appliquer(page: PageNumerisee, retouche: Parameters<Numerisation['retoucher']>[1]): Promise<void> {
    this.occupe.set(true);
    try {
      const neuve = await this.num.retoucher(page, retouche);
      this.pages.update((l) => l.map((p) => (p.id === page.id ? neuve : p)));
      this.pdf = null;
    } catch {
      this.toast.erreur(tr('scanEchoue', 'Numérisation impossible. Réessaie.'));
    } finally {
      this.occupe.set(false);
    }
  }

  // ── Édition d'une page : cadrage, mode, lisibilité ───────────────────────

  protected ouvrirEdition(page: PageNumerisee): void {
    this.avant = { coins: page.coins, detectee: page.detectee, reglages: page.reglages };
    this.editeeId.set(page.id);
    this.etape.set('edition');
  }

  /** « Valider » garde les retouches ; « annuler » remet la page comme elle était. */
  protected async fermerEdition(annuler: boolean): Promise<void> {
    clearTimeout(this.minuterieRendu);
    const enAttente = this.retoucheEnAttente;
    this.retoucheEnAttente = null;
    const page = this.editee();
    if (annuler && page && this.avant) await this.appliquer(page, this.avant);
    else if (!annuler && page && enAttente) await this.appliquer(page, enAttente);
    this.editeeId.set(null);
    this.avant = null;
    this.etape.set('pages');
  }

  protected surCoins(coins: Quad): void {
    this.reporterRendu({ coins, detectee: false });
  }

  protected surReglage(partiel: Partial<Reglages>): void {
    const page = this.editee();
    if (page) this.reporterRendu({ reglages: { ...page.reglages, ...partiel } });
  }

  protected surCurseur(champ: 'luminosite' | 'contraste', e: Event): void {
    this.surReglage({ [champ]: Number((e.target as HTMLInputElement).value) });
  }

  protected appliquerATous(): void {
    const page = this.editee();
    if (!page) return;
    this.num.reglagesParDefaut.set(page.reglages);
    void Promise.all(
      this.pages()
        .filter((p) => p.id !== page.id)
        .map((p) => this.num.retoucher(p, { reglages: page.reglages })),
    ).then((neuves) => {
      const parId = new Map(neuves.map((p) => [p.id, p]));
      this.pages.update((l) => l.map((p) => parId.get(p.id) ?? p));
      this.toast.succes(tr('scanReglagesAppliques', 'Réglages appliqués à toutes les pages.'));
    });
  }

  /** Relance la détection sur la photo entière. */
  protected redetecter(): void {
    const page = this.editee();
    if (!page) return;
    const coins = this.num.detecter(page.source);
    if (!coins) {
      this.toast.info(tr('scanDetectionEchec', 'Page non repérée : place les coins à la main.'));
      return;
    }
    this.recadrage()?.appliquerCoins(coins);
    this.reporterRendu({ coins, detectee: true });
  }

  /** Les curseurs et les poignées bougent vite : on ne refait le rendu qu'une fois le geste posé. */
  private reporterRendu(retouche: Parameters<Numerisation['retoucher']>[1]): void {
    clearTimeout(this.minuterieRendu);
    this.retoucheEnAttente = { ...this.retoucheEnAttente, ...retouche };
    const sequence = ++this.rendu;
    this.minuterieRendu = setTimeout(async () => {
      const aAppliquer = this.retoucheEnAttente ?? retouche;
      this.retoucheEnAttente = null;
      const page = this.editee();
      if (!page) return;
      try {
        const neuve = await this.num.retoucher(page, aAppliquer);
        if (sequence === this.rendu) this.pages.update((l) => l.map((p) => (p.id === page.id ? neuve : p)));
        else this.num.liberer({ ...neuve, source: { close() {} } as ImageBitmap });
      } catch {
        this.toast.erreur(tr('scanEchoue', 'Numérisation impossible. Réessaie.'));
      }
    }, 250);
  }

  // ── Aperçu et envoi ──────────────────────────────────────────────────────

  /** Assemble le PDF, le vérifie, et le montre avant de le confier au formulaire. */
  protected async apercu(): Promise<void> {
    if (this.nombre() === 0 || this.assemblage()) return;
    this.assemblage.set(true);
    try {
      const pdf = assemblerPdf(this.pages().map((p) => this.num.versJpeg(p)));
      const rapport = verifierPdf(pdf, this.nombre());
      if (!rapport.valide) {
        this.toast.erreur(tr('scanPdfIllisible', 'Le PDF n’a pas pu être assemblé correctement. Réessaie.'));
        return;
      }
      if (pdf.length > this.tailleMaxMo * 1024 * 1024) {
        this.toast.erreur(`Le document dépasse ${this.tailleMaxMo} Mo. Retire quelques pages ou choisis le noir et blanc.`);
        return;
      }
      this.pdf = pdf;
      this.resume.set({ pages: rapport.pages, octets: pdf.length });
      this.etape.set('apercu');
    } catch {
      this.toast.erreur(tr('scanEchoue', 'Numérisation impossible. Réessaie.'));
    } finally {
      this.assemblage.set(false);
    }
  }

  protected taille(octets: number): string {
    return octets >= 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;
  }

  protected utiliser(): void {
    if (!this.pdf) return;
    const copie = new Uint8Array(this.pdf); // détache le tampon : `File` attend un ArrayBuffer
    this.relais.deposer(new File([copie], `scan-${Date.now()}.pdf`, { type: 'application/pdf' }));
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }
}
