import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { Icon } from '../icon/icon';

@Component({
  selector: 'nl-image-cropper',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-cropper.html',
  styleUrl: './image-cropper.scss',
})
export class ImageCropper implements OnInit, OnDestroy {
  readonly file = input.required<File>();
  readonly cropped = output<File>();
  readonly cancelled = output<void>();

  protected readonly previewCanvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly imageUrl = signal<string | null>(null);
  protected readonly zoom = signal<number>(1);
  protected readonly offsetX = signal<number>(0);
  protected readonly offsetY = signal<number>(0);
  protected readonly loading = signal<boolean>(true);
  protected readonly processing = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  private imageElement: HTMLImageElement | null = null;
  private isDragging = false;
  private startDragX = 0;
  private startDragY = 0;
  private initialOffsetX = 0;
  private initialOffsetY = 0;

  ngOnInit(): void {
    const f = this.file();
    if (!f) {
      this.error.set('Aucun fichier sélectionné.');
      return;
    }

    if (!f.type.startsWith('image/')) {
      this.error.set('Format de fichier invalide. Choisis une image.');
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      this.error.set('Image trop volumineuse (maximum 10 Mo).');
      return;
    }

    try {
      const url = URL.createObjectURL(f);
      this.imageUrl.set(url);
      const img = new Image();
      img.onload = () => {
        this.imageElement = img;
        this.loading.set(false);
        this.reinitialiserCadrage();
      };
      img.onerror = () => {
        this.error.set('Impossible de charger l’image.');
        this.loading.set(false);
      };
      img.src = url;
    } catch {
      this.error.set('Erreur de lecture de l’image.');
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    const url = this.imageUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private reinitialiserCadrage(): void {
    if (!this.imageElement) return;
    this.zoom.set(1);
    this.offsetX.set(0);
    this.offsetY.set(0);
  }

  protected onZoomSlider(e: Event): void {
    const val = Number((e.target as HTMLInputElement).value);
    this.zoom.set(Math.min(3, Math.max(0.5, val)));
  }

  protected zoomIn(): void {
    this.zoom.update((z) => Math.min(3, Number((z + 0.15).toFixed(2))));
  }

  protected zoomOut(): void {
    this.zoom.update((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
  }

  // ── Gestion du Drag / Pan (Souris & Tactile) ──────────────────────────────
  protected onPointerDown(e: MouseEvent | TouchEvent): void {
    this.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    this.startDragX = clientX;
    this.startDragY = clientY;
    this.initialOffsetX = this.offsetX();
    this.initialOffsetY = this.offsetY();
  }

  protected onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - this.startDragX;
    const deltaY = clientY - this.startDragY;

    this.offsetX.set(this.initialOffsetX + deltaX);
    this.offsetY.set(this.initialOffsetY + deltaY);
  }

  protected onPointerUp(): void {
    this.isDragging = false;
  }

  // ── Confirmation & Export Canvas 512x512 ──────────────────────────────────
  protected async confirmer(): Promise<void> {
    if (!this.imageElement) {
      this.cropped.emit(this.file());
      return;
    }

    this.processing.set(true);

    try {
      const OUTPUT_SIZE = 512;
      const VIEWPORT_SIZE = 280;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        this.cropped.emit(this.file());
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const img = this.imageElement;
      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;

      // Base scale pour que l'image tienne dans le viewport de 280px
      const baseScale = Math.max(VIEWPORT_SIZE / naturalWidth, VIEWPORT_SIZE / naturalHeight);
      const currentScale = baseScale * this.zoom();

      const displayedWidth = naturalWidth * currentScale;
      const displayedHeight = naturalHeight * currentScale;

      // Position centrée dans le viewport
      const centerOffsetX = (VIEWPORT_SIZE - displayedWidth) / 2 + this.offsetX();
      const centerOffsetY = (VIEWPORT_SIZE - displayedHeight) / 2 + this.offsetY();

      // Ratio d'export vers 512px
      const exportRatio = OUTPUT_SIZE / VIEWPORT_SIZE;

      ctx.drawImage(
        img,
        centerOffsetX * exportRatio,
        centerOffsetY * exportRatio,
        displayedWidth * exportRatio,
        displayedHeight * exportRatio,
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            this.cropped.emit(this.file());
            return;
          }
          const nomClean = this.file().name.replace(/\.[^/.]+$/, '') + '-recadre.jpg';
          const croppedFile = new File([blob], nomClean, { type: 'image/jpeg' });
          this.processing.set(false);
          this.cropped.emit(croppedFile);
        },
        'image/jpeg',
        0.88,
      );
    } catch {
      this.processing.set(false);
      this.cropped.emit(this.file());
    }
  }

  protected annuler(): void {
    this.cancelled.emit();
  }
}
