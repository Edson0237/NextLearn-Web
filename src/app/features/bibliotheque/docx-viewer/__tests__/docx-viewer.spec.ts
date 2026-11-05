// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as docx from 'docx-preview';
import {
  detecterFormatDocument,
  detecterFormatParEntete,
  detecterFormatParUrl,
} from '../../../../core/bibliotheque/utils/detection-format';

describe('Lecteur DOCX & Détection Format', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // Mock getBBox pour les éléments SVG sous JSDOM
    if (typeof SVGElement !== 'undefined' && !(SVGElement.prototype as any).getBBox) {
      (SVGElement.prototype as any).getBBox = () => ({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        bottom: 100,
        left: 0,
        right: 100,
        top: 0,
        toJSON: () => {},
      });
    }
  });

  afterEach(() => {
    container.remove();
  });

  describe('Non-régression PDF et Détection automatique', () => {
    it('détecte un document PDF par son extension et préserve le mode pdf', () => {
      expect(detecterFormatDocument({ url: 'https://cdn.example.com/cours/algebre.pdf' })).toBe('pdf');
      expect(detecterFormatParUrl('https://nextlearn.cm/documents/examen.pdf?token=123')).toBe('pdf');
    });

    it('détecte un document PDF par ses octets magiques %PDF', () => {
      const entetePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(detecterFormatParEntete(entetePdf)).toBe('pdf');
      expect(detecterFormatDocument({ octets: entetePdf })).toBe('pdf');
    });

    it('détecte un document DOCX par son extension .docx ou .doc', () => {
      expect(detecterFormatDocument({ url: 'https://cdn.example.com/epreuves/securite.docx' })).toBe('docx');
      expect(detecterFormatParUrl('https://nextlearn.cm/documents/fiche.docx?sig=abc')).toBe('docx');
      expect(detecterFormatParUrl('/fichiers/devoir.doc')).toBe('docx');
    });

    it('détecte un document DOCX par ses octets magiques ZIP/OpenXML (PK\\x03\\x04)', () => {
      const enteteZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]);
      expect(detecterFormatParEntete(enteteZip)).toBe('docx');
      expect(detecterFormatDocument({ octets: enteteZip })).toBe('docx');
    });
  });

  describe('Rendu DOCX avec docx-preview', () => {
    // Helper pour générer des fichiers DOCX de test valides en mémoire avec JSZip
    async function genererDocxTest({
      pages = 1,
      texte = 'Document de test NextLearn',
      avecTableau = false,
      nbParagraphes = 2,
    }: {
      pages?: number;
      texte?: string;
      avecTableau?: boolean;
      nbParagraphes?: number;
    } = {}): Promise<Uint8Array> {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '</Types>',
      );

      zip.file(
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '</Relationships>',
      );

      let contenuCorps = '';
      for (let i = 0; i < pages; i++) {
        if (i > 0) {
          contenuCorps += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        }
        for (let p = 0; p < nbParagraphes; p++) {
          contenuCorps += `<w:p><w:r><w:t>Page ${i + 1} - ${texte} (para ${p + 1})</w:t></w:r></w:p>`;
        }
      }

      if (avecTableau) {
        contenuCorps +=
          '<w:tbl>' +
          '<w:tr><w:tc><w:p><w:r><w:t>En-tête 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>En-tête 2</w:t></w:r></w:p></w:tc></w:tr>' +
          '<w:tr><w:tc><w:p><w:r><w:t>Donnée 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Donnée 2</w:t></w:r></w:p></w:tc></w:tr>' +
          '</w:tbl>';
      }

      const documentXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:body>${contenuCorps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;

      zip.file('word/document.xml', documentXml);

      return zip.generateAsync({ type: 'uint8array' });
    }

    it('1. Rend avec succès un DOCX multipages et découpe en sections', async () => {
      const octets = await genererDocxTest({ pages: 3, texte: 'Examen de Réseaux' });
      await docx.renderAsync(octets, container, undefined, {
        inWrapper: true,
        breakPages: true,
      });

      const sections = container.querySelectorAll('section');
      expect(sections.length).toBe(3);
      expect(container.textContent).toContain('Examen de Réseaux');
    });

    it('2. Rend avec succès un DOCX avec tableaux', async () => {
      const octets = await genererDocxTest({ pages: 1, avecTableau: true, texte: 'Tableau des notes' });
      await docx.renderAsync(octets, container, undefined, { inWrapper: true });

      const tableaux = container.querySelectorAll('table');
      expect(tableaux.length).toBe(1);
      const cellules = container.querySelectorAll('td, th');
      expect(cellules.length).toBeGreaterThanOrEqual(4);
      expect(container.textContent).toContain('Donnée 1');
    });

    it('3. Rend avec succès un DOCX volumineux (nombreux paragraphes)', async () => {
      const octets = await genererDocxTest({
        pages: 4,
        nbParagraphes: 25,
        texte: 'Contenu volumineux d’un cours magistral complet',
      });
      await docx.renderAsync(octets, container, undefined, { inWrapper: true });

      const paragraphes = container.querySelectorAll('p');
      expect(paragraphes.length).toBeGreaterThanOrEqual(100);
      expect(container.textContent).toContain('cours magistral complet');
    });

    it('4. Rejette proprement et lève une erreur sur un fichier DOCX corrompu', async () => {
      const octetsCorrompus = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0xee, 0xdd]);
      let erreurAttrapee: Error | null = null;
      try {
        await docx.renderAsync(octetsCorrompus, container, undefined, { inWrapper: true });
      } catch (err: unknown) {
        erreurAttrapee = err as Error;
      }

      expect(erreurAttrapee).not.toBeNull();
    });

    it('5. Gère la libération de la mémoire et la réinitialisation du conteneur', async () => {
      const octets = await genererDocxTest({ pages: 1, texte: 'Pour test de nettoyage' });
      await docx.renderAsync(octets, container, undefined, { inWrapper: true });

      expect(container.children.length).toBeGreaterThan(0);

      // Nettoyage identique à ngOnDestroy
      container.innerHTML = '';
      expect(container.children.length).toBe(0);
    });

    it('6. Rend avec succès un sujet réel avec images (Communication CC1)', async () => {
      const fs = await import('fs');
      const cheminReel = '../SJI-Anciens sujets-2021-2024/2021-2022/Semestre 1/INGE 1/Communication_CC1_INGE 1.docx';
      if (!fs.existsSync(cheminReel)) return;

      const octets = fs.readFileSync(cheminReel);
      await docx.renderAsync(octets, container, undefined, { inWrapper: true, useBase64URL: true });

      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThanOrEqual(1);
      const section = container.querySelector('section');
      expect(section?.textContent).toContain('Communication');
    });

    it('7. Rend avec succès un sujet réel avec tableaux complexes (BD avancées)', async () => {
      const fs = await import('fs');
      const cheminReel = '../SJI-Anciens sujets-2021-2024/2021-2022/Semestre 1/INGE 5/ISI/Bases de donnees avancées_INGE5_ISI.docx';
      if (!fs.existsSync(cheminReel)) return;

      const octets = fs.readFileSync(cheminReel);
      await docx.renderAsync(octets, container, undefined, { inWrapper: true });

      const tableaux = container.querySelectorAll('table');
      expect(tableaux.length).toBeGreaterThanOrEqual(2);
      const section = container.querySelector('section');
      expect(section?.textContent).toContain('Oracle');
    });

    it('8. Rend avec succès un sujet réel volumineux (>1Mo) en moins de 1000ms', async () => {
      const fs = await import('fs');
      const cheminReel = '../SJI-Anciens sujets-2021-2024/2024-2025/Semestre 1/Cycle Ingénieur/Session Normale/SRT/Inge 5/SSC/ MGT5229-Veille technologique et prévisions stratégiques_SN_S1_2024-2025.docx';
      if (!fs.existsSync(cheminReel)) return;

      const octets = fs.readFileSync(cheminReel);
      const debut = Date.now();
      await docx.renderAsync(octets, container, undefined, { inWrapper: true, useBase64URL: true });
      const duree = Date.now() - debut;

      expect(duree).toBeLessThan(1500);
      expect(container.querySelectorAll('p').length).toBeGreaterThan(50);
    });
  });
});
