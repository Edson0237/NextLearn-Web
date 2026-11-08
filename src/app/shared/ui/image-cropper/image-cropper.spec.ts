import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { ImageCropper } from './image-cropper';

describe('ImageCropper', () => {
  function creerCropper(file: File) {
    TestBed.configureTestingModule({
      imports: [ImageCropper],
    });
    const fixture = TestBed.createComponent(ImageCropper);
    fixture.componentRef.setInput('file', file);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('rejette les fichiers non-images avec un message explicite', () => {
    const textFile = new File(['hello'], 'document.txt', { type: 'text/plain' });
    const { component } = creerCropper(textFile);

    expect(component['error']()).toBe('Format de fichier invalide. Choisis une image.');
  });

  it('rejette les images trop volumineuses (> 10 Mo)', () => {
    const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    const { component } = creerCropper(largeFile);

    expect(component['error']()).toBe('Image trop volumineuse (maximum 10 Mo).');
  });

  it('ajuste le zoom avec zoomIn et zoomOut dans les limites autorisées [0.5, 3]', () => {
    const validFile = new File(['dummy'], 'avatar.jpg', { type: 'image/jpeg' });
    const { component } = creerCropper(validFile);

    expect(component['zoom']()).toBe(1);

    component['zoomIn']();
    expect(component['zoom']()).toBe(1.15);

    component['zoomOut']();
    expect(component['zoom']()).toBe(1);

    // Zoom out limite
    for (let i = 0; i < 10; i++) component['zoomOut']();
    expect(component['zoom']()).toBe(0.5);

    // Zoom in limite
    for (let i = 0; i < 25; i++) component['zoomIn']();
    expect(component['zoom']()).toBe(3);
  });

  it('émet l’événement cancelled lors de l’appel à annuler()', () => {
    const validFile = new File(['dummy'], 'avatar.jpg', { type: 'image/jpeg' });
    const { component } = creerCropper(validFile);

    let cancelEmitted = false;
    component.cancelled.subscribe(() => {
      cancelEmitted = true;
    });

    component['annuler']();
    expect(cancelEmitted).toBe(true);
  });
});
