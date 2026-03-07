# PRD: Frontend Brand Styling — Bespoke Look & Feel

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-03-07  
**Reference:** [Ikigai Labs (ikigailabs.xyz-test)](https://github.com/IkigaiLabsETH/ikigailabs.xyz-test) — styling patterns only

---

## 1. Executive Summary

Define and implement a **bespoke visual identity** for the unified Dexter + AI Hedge Fund frontend. This PRD focuses exclusively on **styling**: Tailwind config, CSS, fonts, colors, logo, and component aesthetics. No feature or architecture changes.

**Goal:** Replace generic UI (e.g. default shadcn) with a distinctive, on-brand look that feels intentional and professional for financial research.

---

## 2. Reference Analysis (Ikigai Labs)

Scanned [ikigailabs.xyz-test](https://github.com/IkigaiLabsETH/ikigailabs.xyz-test) for styling patterns. Key findings:

### 2.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| **Primary** | `#F9D401` | Accent, highlights, body text on dark |
| **Secondary** | `#313459` | Secondary UI, links |
| **Accent** | `#A1100F` | CTAs, emphasis, hover states |
| **Tertiary** | `#DB7D2F` | Orange accent |
| **Background** | `#121212` | Dark base |
| **Text** | `gray-300` | Body copy |
| **Shadow** | `rgba(127,29,29,1)` | Red-tinted hover shadow |

### 2.2 Typography

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| **Headings** | Epilogue | 100–900 | Variable, `tracking-tighter`, `leading-none` |
| **Body** | Satoshi | 300–900 | Variable, default body |
| **Display** | Boska | 200–900 | Variable, hero/emphasis |

**Font loading:** `@font-face` with woff2/woff/ttf, `font-display: swap`.

### 2.3 Design Language

- **Neo-brutalist:** Sharp corners, offset box shadows, bold borders
- **Shadows:** `shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]` — hard offset, no blur
- **Hover:** `-translate-x-2 -translate-y-2` with shadow shift
- **Borders:** `border-2 border-black` (or `border-white` on dark)
- **No rounded corners:** `rounded-none` for buttons, cards, toasts

### 2.4 Components

- **Tabs:** `.tab` — white bg, black border, shadow; `.tab.active` — black bg, yellow text
- **Hover:** `hover:border-red hover:-translate-x-2 hover:-translate-y-2 hover:shadow-[8px_8px_0px_0px_rgba(127,29,29,1)]`
- **Toasts:** `rounded-none border-2 border-black satoshi font-bold`

### 2.5 Assets

- `/public/assets/fonts/` — epilogue, boska, satoshi (variable)
- `/public/assets/images/` — logo SVG, loaders, social icons

---

## 3. Proposed Brand Styling for Dexter

### 3.1 Target

- **Frontend:** Unified app (Dexter + AI Hedge Fund) — [stocks](https://github.com/eliza420ai-beep/stocks) or similar
- **Stack:** Next.js, Tailwind, shadcn/ui (or equivalent)

### 3.2 Design Principles

1. **Distinctive, not generic** — Avoid generic AI/chat UI look
2. **Professional** — Financial research context; trustworthy, not playful
3. **Dark-first** — Default dark theme; light optional
4. **Readable** — High contrast for data tables and charts

### 3.3 Color System

```js
// tailwind.config.js — extend theme.colors
colors: {
  brand: {
    primary: '#F9D401',   // Accent
    secondary: '#313459', // Secondary
    accent: '#A1100F',    // CTAs, emphasis
    tertiary: '#DB7D2F',  // Optional
  },
  surface: {
    dark: '#121212',
    card: '#1a1a1a',
    border: '#2a2a2a',
  },
}
```

**Semantic mapping:**

- **Primary actions:** `bg-brand-primary text-black`
- **Secondary actions:** `bg-brand-secondary text-white`
- **Links / hover:** `text-brand-primary hover:text-brand-accent`
- **Background:** `bg-surface-dark`
- **Cards:** `bg-surface-card border-surface-border`

### 3.4 Typography

| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| **Headings** | Epilogue | system-ui | h1–h4, section titles |
| **Body** | Satoshi | system-ui | Paragraphs, chat, tables |
| **Display** | Boska | Epilogue | Hero, large numbers |

**Font sources:** Google Fonts (Epilogue) or self-hosted (Satoshi, Boska — license permitting). Fallback to `system-ui` if unavailable.

**Tailwind:**

```js
fontFamily: {
  sans: ['Satoshi', 'system-ui', 'sans-serif'],
  heading: ['Epilogue', 'system-ui', 'sans-serif'],
  display: ['Boska', 'Epilogue', 'system-ui', 'sans-serif'],
}
```

### 3.5 Component Styling

| Component | Styling |
|-----------|---------|
| **Buttons (primary)** | `bg-brand-primary text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-1 hover:-translate-y-1 rounded-none font-bold` |
| **Buttons (secondary)** | `bg-transparent border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-black` |
| **Cards** | `bg-surface-card border border-surface-border rounded-lg` (or `rounded-none` for brutalist) |
| **Inputs** | `border-2 border-surface-border focus:border-brand-primary rounded-none` |
| **Chat bubbles** | User: `bg-brand-secondary`; Assistant: `bg-surface-card border` |
| **Tabs** | Brutalist style: `.tab` / `.tab.active` |

### 3.6 Logo & Favicon

- **Logo:** SVG preferred; light and dark variants
- **Favicon:** 32×32, 16×16
- **Placement:** Header, loading states, empty states

### 3.7 Dark / Light Mode

- **Default:** Dark (`#121212`)
- **Light:** Optional; `bg-gray-50`, `text-gray-900`, invert brand colors for contrast
- **Toggle:** `darkMode: 'class'` in Tailwind

---

## 4. Implementation Scope

### 4.1 Phase 1: Foundation

- [ ] `tailwind.config.js` — colors, fonts, extend theme
- [ ] `globals.css` — `@font-face`, base layer (body, headings, links)
- [ ] Dark mode CSS variables

### 4.2 Phase 2: Components

- [ ] Button variants (primary, secondary, ghost)
- [ ] Card, Input, Textarea
- [ ] Tab styling
- [ ] Chat message bubbles

### 4.3 Phase 3: Layout & Assets

- [ ] Header / nav with logo
- [ ] Footer
- [ ] Favicon

### 4.4 Phase 4: Polish

- [ ] Loading states (spinner, skeleton)
- [ ] Toast / notification styling
- [ ] Chart colors (if applicable)

---

## 5. File Checklist

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Brand colors, fonts, extend |
| `app/globals.css` | Font faces, base styles |
| `public/assets/fonts/` | Epilogue, Satoshi, Boska (if self-hosted) |
| `public/assets/images/` | Logo, favicon |
| `components/ui/*` | Override shadcn or custom variants |

---

## 6. Reference

- **Ikigai Labs repo:** https://github.com/IkigaiLabsETH/ikigailabs.xyz-test
- **Deployed:** ikigailabs-xyz-test.vercel.app
- **Tailwind:** `@tailwindcss/forms` for form styling

---

## 7. Non-Goals

- **No feature changes** — only UI/styling
- **No backend changes** — Dexter API, Hedge Fund API unchanged
- **No accessibility regressions** — maintain WCAG contrast

---

## 8. Success Criteria

- [ ] Unified frontend has a distinct, recognizable brand look
- [ ] Typography and colors are consistent across pages
- [ ] Dark mode is default and readable
- [ ] Components feel cohesive and intentional
