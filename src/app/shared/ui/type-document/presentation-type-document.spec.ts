import { DocumentType, enregistrerFormatsServeur, typeDocumentDepuisApi } from '../../../core/bibliotheque';
import { couleurTypeDocument, fondTypeDocument, iconeTypeDocument, presentationType, TypeDocumentPipe } from './presentation-type-document';

describe('présentation d’un type de document', () => {
  afterEach(() => enregistrerFormatsServeur([]));

  it('couleur : une variable de thème, pas un hexadécimal figé', () => {
    expect(couleurTypeDocument(DocumentType.cours)).toBe('var(--type-cours)');
    expect(couleurTypeDocument(DocumentType.autre)).toBe('var(--neutral)');
  });

  it('un format créé dans l’administration prend la couleur du serveur, mêlée au texte', () => {
    const type = typeDocumentDepuisApi('MEMOIRE');
    expect(couleurTypeDocument(type)).toBe('var(--neutral)');
    enregistrerFormatsServeur([{ slug: 'MEMOIRE', label: 'Mémoire', couleur: '#0ea5e9' }]);
    expect(couleurTypeDocument(type)).toContain('#0ea5e9');
    expect(fondTypeDocument(type)).toContain('#0ea5e9');
  });

  it('un format dont la couleur serveur est invalide retombe sur le neutre', () => {
    const type = typeDocumentDepuisApi('MEMOIRE');
    enregistrerFormatsServeur([{ slug: 'MEMOIRE', label: 'Mémoire', couleur: 'rouge' }]);
    expect(couleurTypeDocument(type)).toBe('var(--neutral)');
    expect(fondTypeDocument(type)).toBe('var(--bg-secondary)');
  });

  it('chaque type connu a son icône, un TP n’a pas celle d’un cours', () => {
    expect(iconeTypeDocument(DocumentType.tp)).toBe('science');
    expect(iconeTypeDocument(DocumentType.tp)).not.toBe(iconeTypeDocument(DocumentType.cours));
    expect(iconeTypeDocument(DocumentType.autre)).toBe('description');
  });

  it('« tous les types » (null) a sa présentation propre', () => {
    expect(presentationType(null)).toEqual({ label: 'Document', icone: 'grid_view', couleur: 'var(--primary)', fond: 'var(--primary-soft)' });
  });

  it('le tube rend les quatre attributs d’un coup', () => {
    expect(new TypeDocumentPipe().transform(DocumentType.cours)).toEqual({
      label: 'Cours', icone: 'menu_book', couleur: 'var(--type-cours)', fond: 'var(--type-cours-soft)',
    });
  });
});
