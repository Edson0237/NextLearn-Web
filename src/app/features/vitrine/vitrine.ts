import { Component, OnInit, HostListener } from '@angular/core';
import { Header } from './sections/header/header';
import { Accueil } from './sections/accueil/accueil';
import { About } from './sections/about/about';
import { Contact } from './sections/contact/contact';
import { Equipe } from './sections/equipe/equipe';
import { Footer } from './sections/footer/footer';
import { Fonctionnalite } from './sections/fonctionnalite/fonctionnalite';

/**
 * La page vitrine publique — ce qui vivait auparavant directement dans
 * `App`, avant que l'application (routes `/app/**`) ne partage le projet
 * avec elle. Le lustre décoratif (lueur du curseur, barre de progression du
 * défilement) lui est propre : une page d'application n'en a pas besoin, et
 * risquerait d'en hériter par erreur si elle était restée dans le composant
 * racine.
 */
@Component({
  selector: 'app-vitrine',
  imports: [Header, Accueil, About, Contact, Equipe, Footer, Fonctionnalite],
  templateUrl: './vitrine.html',
  styleUrl: './vitrine.scss',
})
export class Vitrine implements OnInit {
  private cursorGlow: HTMLElement | null = null;
  private scrollProgress: HTMLElement | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private glowX = 0;
  private glowY = 0;

  ngOnInit(): void {
    this.chargerFeuillesExternes();
    this.initializeCursorGlow();
    this.initializeScrollProgress();
  }

  /**
   * Google Fonts et Font Awesome, chargés ici plutôt que dans `index.html`.
   *
   * Les deux ne servent qu'à cette page, et ne sont utilisés par aucun écran
   * de l'application — qui auto-héberge ses polices et inline ses icônes.
   * Posés dans le `<head>`, ils devenaient deux requêtes tierces bloquantes
   * payées par tout le monde, y compris par quelqu'un qui ouvre
   * l'application installée sur son téléphone : deux points de panne hors
   * ligne et une adresse IP envoyée à deux CDN que la politique de
   * confidentialité ne mentionne pas.
   *
   * La vitrine étant une route paresseuse, les charger à son affichage ne
   * change rien pour elle et les retire du chemin critique de l'application.
   */
  private chargerFeuillesExternes(): void {
    const feuilles = [
      'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap',
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    ];
    for (const href of feuilles) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const lien = document.createElement('link');
      lien.rel = 'stylesheet';
      lien.href = href;
      // La page s'affiche sans attendre : ces feuilles habillent, elles ne
      // structurent pas.
      lien.crossOrigin = 'anonymous';
      document.head.appendChild(lien);
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;

    if (this.cursorGlow) {
      this.cursorGlow.classList.add('active');
    }
  }

  @HostListener('document:mouseleave')
  onMouseLeave(): void {
    if (this.cursorGlow) {
      this.cursorGlow.classList.remove('active');
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateScrollProgress();
  }

  private initializeCursorGlow(): void {
    this.cursorGlow = document.getElementById('cursorGlow');

    // Vérifier si le device supporte les pointeurs fins (souris)
    if (this.cursorGlow && window.matchMedia('(pointer: fine)').matches) {
      this.animateCursor();
    }
  }

  private animateCursor(): void {
    if (!this.cursorGlow) return;

    const animate = () => {
      this.glowX += (this.mouseX - this.glowX) * 0.08;
      this.glowY += (this.mouseY - this.glowY) * 0.08;

      this.cursorGlow!.style.left = this.glowX + 'px';
      this.cursorGlow!.style.top = this.glowY + 'px';

      requestAnimationFrame(animate);
    };

    animate();
  }

  private initializeScrollProgress(): void {
    this.scrollProgress = document.getElementById('scrollProgress');
    this.updateScrollProgress();
  }

  private updateScrollProgress(): void {
    if (!this.scrollProgress) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;

    this.scrollProgress.style.width = scrollPercent + '%';
  }
}
