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
  selector: 'app-accueil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accueil.html',
  styleUrl: './accueil.scss'
})
export class Accueil implements AfterViewInit, OnDestroy {

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
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
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