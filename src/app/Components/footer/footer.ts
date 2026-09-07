import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {

  onAnchorClick(event: Event, targetId: string): void {
    event.preventDefault();

    const target = document.querySelector(targetId);
    if (!target) return;

    const navbar = document.querySelector('.navbar') as HTMLElement | null;
    const offset = navbar ? navbar.offsetHeight : 0;
    const pos = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top: pos, behavior: 'smooth' });
  }
}