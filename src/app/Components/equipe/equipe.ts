import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-equipe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './equipe.html',
  styleUrl: './equipe.scss'
})
export class Equipe implements AfterViewInit, OnDestroy {

  // Carrousel des fondateurs
  slides = [0, 1, 2];
  currentSlide = 0;
  private autoPlayInterval?: ReturnType<typeof setInterval>;
  private touchStartX = 0;

  // Formulaire de notification iOS
  notifySubmitted = false;

  // Modales
  showSpamAlert = false;
  showIosAlert = false;
  private pendingDownloadUrl = '';

  private isBrowser: boolean;
  private observer?: IntersectionObserver;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const revealElements = this.elementRef.nativeElement.querySelectorAll('.animate-on-scroll');
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.1 }
    );
    revealElements.forEach((el) => this.observer!.observe(el));

    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.stopAutoPlay();
  }

  // ============================================
  // CARROUSEL FONDATEURS
  // ============================================
  goToSlide(index: number): void {
    this.currentSlide = ((index % this.slides.length) + this.slides.length) % this.slides.length;
    this.restartAutoPlay();
  }

  nextSlide(): void {
    this.goToSlide(this.currentSlide + 1);
  }

  prevSlide(): void {
    this.goToSlide(this.currentSlide - 1);
  }

  private startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayInterval = setInterval(() => this.nextSlideSilent(), 4000);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
  }

  private restartAutoPlay(): void {
    this.startAutoPlay();
  }

  // Avance automatique sans relancer l'intervalle (utilisé par le timer lui-même)
  private nextSlideSilent(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
    this.stopAutoPlay();
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.currentSlide = (this.currentSlide + 1) % this.slides.length;
      } else {
        this.currentSlide = ((this.currentSlide - 1) + this.slides.length) % this.slides.length;
      }
    }
    this.startAutoPlay();
  }

  // ============================================
  // FORMULAIRE NOTIFICATION iOS
  // ============================================
  onNotifySubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
    const email = emailInput?.value.trim();
    if (email) {
      this.notifySubmitted = true;
    }
  }

  // ============================================
  // TÉLÉCHARGEMENT ANDROID – alerte spam avant redirection
  // ============================================
  onAndroidDownloadClick(event: Event): void {
    event.preventDefault();
    const anchor = event.currentTarget as HTMLAnchorElement;
    this.pendingDownloadUrl = anchor.getAttribute('href') || '';
    this.showSpamAlert = true;
  }

  confirmSpamAlert(): void {
    this.showSpamAlert = false;
    if (this.pendingDownloadUrl && this.pendingDownloadUrl !== '#') {
      window.location.href = this.pendingDownloadUrl;
    }
  }

  closeSpamAlert(): void {
    this.showSpamAlert = false;
  }

  onSpamOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeSpamAlert();
    }
  }

  // ============================================
  // BOUTON iOS – alerte "version à venir"
  // ============================================
  onIosClick(event: Event): void {
    event.preventDefault();
    this.showIosAlert = true;
  }

  confirmIosAlert(): void {
    this.showIosAlert = false;
    window.open('https://frontend-v1-nextlearn-mobile.vercel.app/', '_blank', 'noopener,noreferrer');
  }

  closeIosAlert(): void {
    this.showIosAlert = false;
  }

  onIosOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeIosAlert();
    }
  }
}