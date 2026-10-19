import { DocumentType, documentDepuisApi, labelTypeDocument, typeDocumentDepuisApi } from './document.model';

describe('DocumentModel', () => {
  it('parse un document depuis l\'API et résout les références', () => {
    const doc = documentDepuisApi({
      _id: 'd1',
      titre: 'Thermo',
      type: 'COURS',
      matiereId: { _id: 'm1', nom: 'Thermodynamique' },
      enseignantId: 'e1',
      universiteId: { _id: 'u1', nom: 'ISJ' },
      niveau: 'N3',
      anneeAcademique: '2025-2026',
      tailleMb: 2.5,
      pages: 42,
      urlPdf: 'https://cdn.test/doc.pdf',
      vues: 10,
    });

    expect(doc.id).toBe('d1');
    expect(doc.type).toBe(DocumentType.cours);
    expect(doc.matiere).toBe('Thermodynamique');
    expect(doc.enseignant).toBe('Enseignant #e1');
    expect(doc.universite).toBe('ISJ');
    expect(doc.matiereId).toBe('m1');
  });

  it('tombe sur « autre » pour un type inconnu', () => {
    expect(typeDocumentDepuisApi('INCONNU')).toBe(DocumentType.autre);
  });

  it('fournit un libellé lisible pour chaque type connu', () => {
    expect(labelTypeDocument(DocumentType.cours)).toBe('Cours');
    expect(labelTypeDocument(DocumentType.epreuve)).toBe('Épreuve');
  });
});
