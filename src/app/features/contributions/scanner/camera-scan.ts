import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { COTE_TEMPS_REEL, DetectionTempsReel, Numerisation, Quad, StabilisateurCoins } from '../../../core/scan';
import { Icon } from '../../../shared/ui/icon/icon';

type EtatCamera = 'demarrage' | 'prete' | 'refusee' | 'indisponible' | 'interrompue';

/**
 * La caméra en direct du scanner : flux vidéo, contour de la page repéré en
 * temps réel, déclencheur manuel.
 *
 * La détection est une aide, jamais une condition : le bouton de capture est
 * toujours actif. Si le navigateur n'offre pas la caméra (page non sécurisée,
 * navigateur ancien) ou si l'accès est refusé, le composant le dit et laisse
 * l'écran proposer l'appareil photo du système.
 */
@Component({
  selector: 'nl-camera-scan',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cam">
      <div class="cam__scene">
        <video #video class="cam__video" playsinline muted autoplay></video>
        @if (etat() === 'prete') {
          <button type="button" class="cam__auto" role="switch" [attr.aria-checked]="num.autoCadrage()" (click)="basculerAuto()">
            <nl-icon [name]="num.autoCadrage() ? 'check_circle' : 'radio_button_unchecked'" [size]="16" />
            {{ 'scanCadrageAuto' | t }}
          </button>
        }
        @if (coins(); as c) {
          <svg class="cam__contour" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            <polygon [attr.points]="points(c)" />
          </svg>
        }
        @switch (etat()) {
          @case ('demarrage') { <p class="cam__message" role="status">{{ 'scanCameraDemarrage' | t }}</p> }
          @case ('refusee') { <p class="cam__message" role="alert">{{ 'scanCameraRefusee' | t }}</p> }
          @case ('indisponible') { <p class="cam__message" role="alert">{{ 'scanCameraIndisponible' | t }}</p> }
          @case ('interrompue') {
            <p class="cam__message" role="status">{{ 'scanCameraInterrompue' | t }}</p>
          }
        }
      </div>
      <p class="cam__statut" role="status">
        @if (etat() === 'prete') {
          @if (!num.autoCadrage()) { {{ 'scanCadrageAutoOff' | t }} }
          @else { {{ (coins() ? 'scanPageReperee' : 'scanCherchePage') | t }} }
        }
      </p>
      <div class="cam__barre">
        <button type="button" class="cam__secondaire" (click)="fermer.emit()">{{ 'actionAnnuler' | t }}</button>
        @if (etat() === 'prete') {
          <button type="button" class="cam__declencheur" (click)="capturer()" [disabled]="capture()" [attr.aria-label]="'scanCapturer' | t">
            <span></span>
          </button>
        } @else if (etat() === 'interrompue') {
          <button type="button" class="cam__declencheur cam__declencheur--reprise" (click)="demarrer()" [attr.aria-label]="'scanCameraReprendre' | t">
            <nl-icon name="refresh" [size]="26" />
          </button>
        } @else {
          <button type="button" class="cam__secondaire cam__secondaire--plein" (click)="systeme.emit()">{{ 'scanUtiliserAppareilPhoto' | t }}</button>
        }
        <span class="cam__espace"></span>
      </div>
    </div>
  `,
  styleUrl: './camera-scan.scss',
})
export class CameraScan implements OnInit {
  protected readonly num = inject(Numerisation);
  private readonly detection = inject(DetectionTempsReel);
  private readonly stabilisateur = new StabilisateurCoins();
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  /** Une photo prise. */
  readonly photo = output<File>();
  readonly fermer = output<void>();
  /** La caméra n'est pas utilisable : l'écran propose l'appareil photo du système. */
  readonly systeme = output<void>();

  protected readonly etat = signal<EtatCamera>('demarrage');
  protected readonly coins = signal<Quad | null>(null);
  protected readonly capture = signal(false);

  private flux: MediaStream | null = null;
  private minuterie: ReturnType<typeof setTimeout> | undefined;

  private readonly surVisibilite = (): void => {
    // Un appel, un changement d'application : le système coupe la caméra. On
    // libère proprement, et on laisse la personne la reprendre.
    if (document.visibilityState === 'hidden' && this.flux) {
      this.arreter();
      this.etat.set('interrompue');
    }
  };

  constructor() {
    document.addEventListener('visibilitychange', this.surVisibilite);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', this.surVisibilite);
      this.arreter();
    });
  }

  ngOnInit(): void {
    void this.demarrer();
  }

  protected async demarrer(): Promise<void> {
    this.arrete = false;
    this.etat.set('demarrage');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.etat.set('indisponible');
      return;
    }
    try {
      this.flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      const v = this.video().nativeElement;
      v.srcObject = this.flux;
      await v.play();
      this.etat.set('prete');
      this.boucle();
      // Si le système coupe le flux (autre application), on le sait.
      this.flux.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.arreter();
        this.etat.set('interrompue');
      });
    } catch (e) {
      const nom = (e as DOMException)?.name;
      this.etat.set(nom === 'NotAllowedError' || nom === 'SecurityError' ? 'refusee' : 'indisponible');
    }
  }

  /**
   * Une mesure à la fois, au rythme du flux vidéo plutôt qu'à heure fixe, et jamais en
   * retard : si la précédente n'est pas finie, l'image est sautée. Le dessin à
   * 160 px et la détection (dans un Worker) coûtent quelques millisecondes ; le fil
   * principal n'est plus sollicité que pour copier une petite image.
   */
  private boucle(): void {
    if (this.arrete) return;
    const planifier = (): void => {
      const v = this.video().nativeElement;
      if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => void this.mesurer(planifier));
      else this.minuterie = setTimeout(() => void this.mesurer(planifier), 120);
    };
    planifier();
  }

  private derniereMesure = 0;
  private arrete = false;
  private petit: HTMLCanvasElement | null = null;

  private async mesurer(suite: () => void): Promise<void> {
    if (this.arrete) return;
    const v = this.video().nativeElement;
    const maintenant = performance.now();
    // Six mesures par seconde suffisent à suivre une page : au-delà, on ne gagne que de la chauffe.
    if (this.num.autoCadrage() && v.readyState >= 2 && maintenant - this.derniereMesure >= 160) {
      this.derniereMesure = maintenant;
      const image = this.imageReduite(v);
      const promesse = image ? this.detection.detecter(image) : undefined;
      if (promesse) {
        const mesure = await promesse;
        if (this.arrete) return;
        this.coins.set(this.stabilisateur.mettre(mesure, performance.now()));
      }
    } else if (!this.num.autoCadrage() && this.coins()) {
      this.stabilisateur.reinitialiser();
      this.coins.set(null);
    }
    suite();
  }

  /** L'image de la caméra ramenée à la définition de détection, sur un canevas réutilisé. */
  private imageReduite(v: HTMLVideoElement): ImageData | null {
    if (!v.videoWidth) return null;
    const echelle = COTE_TEMPS_REEL / Math.max(v.videoWidth, v.videoHeight);
    const w = Math.max(1, Math.round(v.videoWidth * echelle));
    const h = Math.max(1, Math.round(v.videoHeight * echelle));
    this.petit ??= document.createElement('canvas');
    if (this.petit.width !== w || this.petit.height !== h) {
      this.petit.width = w;
      this.petit.height = h;
    }
    const ctx = this.petit.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  protected basculerAuto(): void {
    this.num.definirAutoCadrage(!this.num.autoCadrage());
    if (!this.num.autoCadrage()) {
      this.stabilisateur.reinitialiser();
      this.coins.set(null);
    }
  }

  protected points(c: Quad): string {
    return c.map((p) => `${p.x},${p.y}`).join(' ');
  }

  protected capturer(): void {
    const v = this.video().nativeElement;
    if (!v.videoWidth || this.capture()) return;
    this.capture.set(true);
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        this.capture.set(false);
        if (blob) this.photo.emit(new File([blob], `page-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }

  private arreter(): void {
    this.arrete = true;
    clearTimeout(this.minuterie);
    this.minuterie = undefined;
    this.detection.arreter();
    this.stabilisateur.reinitialiser();
    this.flux?.getTracks().forEach((t) => t.stop());
    this.flux = null;
    this.coins.set(null);
  }
}
