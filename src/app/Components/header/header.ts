import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header implements OnInit, OnDestroy {

  isScrolled = false;
  isMenuOpen = false;
  activeSection = 'hero';

  private isBrowser: boolean;
  private sectionIds = ['hero', 'features-v1', 'founders', 'contact', 'about', 'download'];

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.updateNavbarState();
      this.updateActiveSection();
    }
  }

  ngOnDestroy(): void {
    // Sécurité : on remet le scroll du body si le composant est détruit menu ouvert
    if (this.isBrowser) {
      document.body.style.overflow = '';
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateNavbarState();
    this.updateActiveSection();
  }

  private updateNavbarState(): void {
    this.isScrolled = window.scrollY > 50;
  }

  private updateActiveSection(): void {
    const scrollPos = window.scrollY + 150;

    for (const id of this.sectionIds) {
      const section = document.getElementById(id);
      if (!section) continue;

      const top = section.offsetTop;
      const height = section.offsetHeight;

      if (scrollPos >= top && scrollPos < top + height) {
        this.activeSection = id;
        break;
      }
    }
  }

  toggleMobileMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMobileMenu(): void {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  onNavLinkClick(event: Event, targetId: string): void {
    event.preventDefault();
    this.closeMobileMenu();

    const target = document.querySelector(targetId);
    if (!target) return;

    const navbar = document.querySelector('.navbar') as HTMLElement | null;
    const offset = navbar ? navbar.offsetHeight : 0;
    const pos = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top: pos, behavior: 'smooth' });
  }
}