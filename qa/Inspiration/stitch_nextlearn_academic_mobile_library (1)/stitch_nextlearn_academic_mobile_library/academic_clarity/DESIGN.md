---
name: Academic Clarity
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434655'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005e6e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00788c'
  on-tertiary-container: '#d7f6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an academic environment tailored for higher education students navigating dense curricula on mobile screens. The aesthetic synthesizes contemporary academic rigor with the speed and crisp feedback of high-performance mobile tools.

The interface projects authority, mental focus, and momentum:
- **Tone:** Intellectual, encouraging, organized, and razor-sharp.
- **Target Audience:** Undergraduate and graduate students (L1 to M2) preparing for exams, reviewing course materials, and cross-referencing past papers.
- **Visual Style:** Contemporary Minimalist with structured typographic authority and tonal layering. Interfaces rely on immaculate slate surfaces, high-contrast typography, crisp micro-badges, and vibrant cobalt focal points to structure information without cognitive clutter.

## Colors

The palette balances deep contrast with active accents to maintain high legibility under varying study conditions.

- **Primary (`#2563EB` - Cobalt Vibrant):** Applied strictly to primary actions, active navigation items, progress rings, and interactive focal points.
- **Secondary (`#0F172A` - Deep Midnight Blue):** Serves as the structural anchor for all primary headlines, core metadata labels, and high-emphasis textual content.
- **Tertiary (`#06B6D4` - Soft Cyan):** Used for micro-badges, download confirmations, active filter tags, and visual accents denoting verified or newly updated academic resources.
- **Neutral Surface (`#F8FAFC` - Immaculate Cloud):** Base canvas background, creating an open, distraction-free environment that maximizes contrast against pure white (`#FFFFFF`) card surfaces.
- **Functional Semantics:**
  - Cours (Lectures): `#2563EB` with an 8% alpha tint background.
  - TD/TP (Workshops): `#06B6D4` with an 8% alpha tint background.
  - Épreuves (Exams): `#D97706` (Amber) for heightened awareness.
  - Corrigés (Answer Keys): `#059669` (Emerald) for resolution and clarity.

## Typography

The typography leverages **Plus Jakarta Sans** uniformly across headlines, body copy, and UI metadata. Its geometric construction, combined with generous x-height and open counters, guarantees legibility on compact smartphone viewports without sacrificing academic gravitas.

- **Hierarchical Discipline:**
  - `display-lg` and `headline-lg` anchor high-level views (e.g., Library Overview, Course Catalog).
  - `headline-sm` titles document cards and structured syllabus rows.
  - `body-md` handles standard descriptions and file metadata snippets.
  - `label-md` and `label-sm` are strictly uppercase or capitalized for micro-badges (e.g., "L3", "CORRIGÉ", "TD/TP"), enforcing rapid scannability during fast thumb-driven navigation.

## Layout & Spacing

This design system is optimized for a native mobile canvas (~390px viewport width) while gracefully scaling up to larger tablets.

- **Grid Architecture:** A 4-column fluid mobile grid with `12px` (`0.75rem`) gutters and `16px` (`1rem`) outer canvas margins.
- **Vertical Rhythm:** Rooted in a strict 4px/8px modular scale.
  - Micro gaps between badges, avatars, and file indicators: `space-xs` (4px) to `space-sm` (8px).
  - Internal card padding: `space-lg` (16px).
  - Section separation: `space-xl` (24px).
- **Mobile Adaptations:** The bottom viewport reserves an 80px safe-area offset for the floating native bottom navigation bar to prevent sticky content collision.

## Elevation & Depth

Visual hierarchy is established using layered planar surfaces combined with soft, directional lighting rather than high-contrast structural borders:

- **Base Layer (Canvas):** Tone `#F8FAFC`, flat and grounding.
- **Card Tier (Level 1):** Solid `#FFFFFF` surfaces with subtle ambient shadows:
  - Shadow configuration: `0px 2px 8px rgba(15, 23, 42, 0.04), 0px 1px 2px rgba(15, 23, 42, 0.02)`.
  - Border reinforcement: 1px continuous border with `#E2E8F0` to maintain definition on low-brightness displays.
- **Elevated Interactive Tier (Level 2):** Modals, search overlays, and contextual filter drawers:
  - Shadow configuration: `0px 8px 24px rgba(15, 23, 42, 0.08), 0px 2px 6px rgba(15, 23, 42, 0.04)`.
- **Bottom Navigation Bar (Floating Tier):**
  - Frosted surface utilizing background blur (`backdrop-filter: blur(16px)`) with `rgba(255, 255, 255, 0.85)` fill, anchored by a hairline top border of `rgba(226, 232, 240, 0.6)`.

## Shapes

The geometric framework balances approachable modern design with academic precision.

- **Standard Containers & Cards:** `0.5rem` (8px) for document cards, syllabus blocks, and search input modules.
- **Micro-Badges & Tags:** Fully pill-shaped (`rounded-full` / `9999px`) to visually differentiate metadata tokens (e.g., academic levels, document classifications) from surrounding card containers.
- **Action Buttons & Modals:** `0.5rem` for compact primary triggers, stepping up to `1rem` (16px) for bottom sheets and floating action modules.

## Components

### Micro-Badges & Status Chips
- **Academic Level Badges (L1, L2, L3, M1, M2):**
  - Height: 22px; padding: 0 8px; pill-shaped.
  - Surface: Subtle Slate (`#F1F5F9`); Text: `#0F172A` (`label-sm`).
  - Active/Selected state: Background `#0F172A`, text `#FFFFFF`.
- **Document Type Badges:**
  - *Cours:* `#EFF6FF` background, `#2563EB` text and icon.
  - *TD/TP:* `#ECFEFF` background, `#0891B2` text and icon.
  - *Épreuves:* `#FFFBEB` background, `#D97706` text and icon.
  - *Corrigés:* `#ECFDF5` background, `#059669` text and icon.

### Academic Document Cards
- Structured layout with an icon thumbnail representing file type (PDF, docx, slide deck) on the left (40x40px, rounded-md, muted background).
- Right stack: Title in `headline-sm` (`#0F172A`), subtitle metadata row (`body-sm`) containing file size, semester (e.g., "S1 - 2024"), and rating.
- Footer row within card: Horizontal flex layout housing level chip, type chip, and quick-download icon button.

### Form Inputs & Search Module
- **Search Bar:** Height 44px, background `#FFFFFF`, border `1px solid #E2E8F0`, interior search icon in `#64748B`.
- Text placeholder in `body-md` (`#94A3B8`). Focus state illuminates border to `#2563EB` with an ambient ring: `0 0 0 3px rgba(37, 99, 235, 0.12)`.

### Buttons
- **Primary Action (Download, Consult):** Height 44px (touch target minimum 48px area via transparent margin); background `#2563EB`; text `#FFFFFF` (`label-lg`); radius 8px.
- **Secondary Action (Filter, Share):** Height 44px; background `#FFFFFF`; border `1px solid #CBD5E1`; text `#0F172A`.

### Bottom Navigation Bar
- Fixed at screen bottom, native-styled 64px container (excluding home indicator safe margin).
- 4 primary destinations: *Bibliothèque*, *Filières*, *Téléchargements*, *Profil*.
- Active icon states highlighted in `#2563EB` with an active indicator dot beneath; inactive icons in `#64748B`.