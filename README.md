# Benz Tech — Mercedes-Benz Warranty Story Assistant

Professional PWA for authorized Mercedes-Benz technicians. Scan repair orders, document diagnostics, generate natural-paragraph warranty stories, and pass BenzBot 2.0 audits.

## Features

- **RO Scan + Prefill** — Grok vision or on-device OCR extracts vehicle info and labeled complaints (A/B/C…)
- **Stable Text Editing** — Customer Complaint and Technician Story fields with cursor-safe controlled inputs
- **Template Library** — Customer Pay templates insert exact saved text (no AI rewrite); warranty templates available for one-click insert
- **Natural Story Generation** — Grok writes flowing paragraph stories without visible "Customer Complaint / Cause / Correction" headers
- **BenzBot 2.0 Auditor** — AI scores stories and shows an **Add Technician Details** section with specific missing data prompts
- **PWA** — Add to Home Screen with correct Benz Tech icon on iOS and Android

## Quick Start

```bash
npm install
npm run dev
```

Add your xAI Grok API key in Settings (encrypted with passphrase).

## Build

```bash
npm run build
npm run preview
```

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- IndexedDB (local RO storage)
- vite-plugin-pwa
- xAI Grok API (story generation, BenzBot 2.0 audit, RO vision OCR)