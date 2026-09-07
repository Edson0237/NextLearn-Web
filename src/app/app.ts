import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './Components/header/header';
import { Accueil } from './Components/accueil/accueil';
import { About } from './Components/about/about';
import { Contact } from './Components/contact/contact';
import { Equipe } from './Components/equipe/equipe';
import { Footer } from './Components/footer/footer';
import { Fonctionnalite } from './Components/fonctionnalite/fonctionnalite';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Accueil, About, Contact, Equipe, Footer, Fonctionnalite],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private cursorGlow: HTMLElement | null = null;
  private scrollProgress: HTMLElement | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private glowX = 0;
  private glowY = 0;
 
  ngOnInit(): void {
    this.initializeCursorGlow();
    this.initializeScrollProgress();
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
