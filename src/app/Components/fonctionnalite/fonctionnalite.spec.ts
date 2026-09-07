import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Fonctionnalite } from './fonctionnalite';

describe('Fonctionnalite', () => {
  let component: Fonctionnalite;
  let fixture: ComponentFixture<Fonctionnalite>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Fonctionnalite],
    }).compileComponents();

    fixture = TestBed.createComponent(Fonctionnalite);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
