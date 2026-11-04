import { describe, expect, it } from 'vitest';
import {
  detecterFormatDocument,
  detecterFormatParEntete,
  detecterFormatParMime,
  detecterFormatParUrl,
} from '../utils/detection-format';

describe('detection-format', () => {
  describe('detecterFormatParEntete', () => {
    it('détecte la signature magique PDF (%PDF)', () => {
      const entetePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
      expect(detecterFormatParEntete(entetePdf)).toBe('pdf');
    });

    it('détecte la signature magique DOCX (PK\\x03\\x04)', () => {
      const enteteZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      expect(detecterFormatParEntete(enteteZip)).toBe('docx');
    });

    it('renvoie inconnu si l’en-tête est tronqué ou non reconnu', () => {
      expect(detecterFormatParEntete(new Uint8Array([0x00, 0x01]))).toBe('inconnu');
      expect(detecterFormatParEntete(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('inconnu');
    });
  });

  describe('detecterFormatParMime', () => {
    it('détecte application/pdf', () => {
      expect(detecterFormatParMime('application/pdf')).toBe('pdf');
      expect(detecterFormatParMime('application/pdf; charset=binary')).toBe('pdf');
    });

    it('détecte les types MIME DOCX / Word', () => {
      expect(
        detecterFormatParMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).toBe('docx');
      expect(detecterFormatParMime('application/docx')).toBe('docx');
      expect(detecterFormatParMime('application/msword')).toBe('docx');
    });

    it('renvoie inconnu pour un type non supporté ou vide', () => {
      expect(detecterFormatParMime('')).toBe('inconnu');
      expect(detecterFormatParMime('image/png')).toBe('inconnu');
      expect(detecterFormatParMime(null)).toBe('inconnu');
    });
  });

  describe('detecterFormatParUrl', () => {
    it('détecte .pdf même avec query params', () => {
      expect(detecterFormatParUrl('https://cdn.example.com/cours/algebre.pdf')).toBe('pdf');
      expect(detecterFormatParUrl('https://cdn.example.com/doc.pdf?token=abc&v=2')).toBe('pdf');
      expect(detecterFormatParUrl('/chemin/local/fichier.PDF#page=2')).toBe('pdf');
    });

    it('détecte .docx et .doc même avec query params', () => {
      expect(detecterFormatParUrl('https://cdn.example.com/epreuve.docx')).toBe('docx');
      expect(detecterFormatParUrl('https://cdn.example.com/epreuve.DOCX?sig=xyz')).toBe('docx');
      expect(detecterFormatParUrl('/fichiers/examen.doc')).toBe('docx');
    });

    it('renvoie inconnu si pas d’extension identifiable', () => {
      expect(detecterFormatParUrl('https://cdn.example.com/document/12345')).toBe('inconnu');
      expect(detecterFormatParUrl(null)).toBe('inconnu');
      expect(detecterFormatParUrl('')).toBe('inconnu');
    });
  });

  describe('detecterFormatDocument', () => {
    it('donne la priorité à la signature binaire', () => {
      const enteteDocx = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      // Même si l'URL est trompeuse, les octets priment
      expect(
        detecterFormatDocument({
          url: 'https://site.com/faux.pdf',
          octets: enteteDocx,
        }),
      ).toBe('docx');
    });

    it('utilise le MIME si pas d’octets', () => {
      expect(
        detecterFormatDocument({
          url: 'https://site.com/telecharger?id=42',
          typeMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ).toBe('docx');
    });

    it('utilise l’URL si ni octets ni MIME concluants', () => {
      expect(
        detecterFormatDocument({
          url: 'https://site.com/cours.docx',
        }),
      ).toBe('docx');
    });

    it('replie par défaut sur pdf', () => {
      expect(
        detecterFormatDocument({
          url: 'https://site.com/ressource-opaque',
        }),
      ).toBe('pdf');
    });
  });
});
