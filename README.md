# LexiCards

> Offline-first vocabulary learning web application powered by **SM-2 spaced repetition**, 5 interactive study modes, rich analytics, and bilingual English/Vietnamese UI.

## Features

- **Deck Management**: Create, rename, color-code, add emoji icons, tag, search, filter, and sort vocabulary decks.
- **Full Card CRUD**: Term, meaning, IPA phonetic, part of speech, example sentence & translation, notes, optional image URL, tags, bulk add, bulk delete, move between decks, and live duplicate detection.
- **5 Study Modes**:
  - **Flip Card**: Smooth 3D card flip (`Space` to flip, `1-4` to rate, arrow keys to navigate, respects `prefers-reduced-motion`).
  - **Quiz**: Auto-generated 4-option multiple choice from the deck with keyboard shortcuts (`1-4`).
  - **Typing**: Tolerant answer checker normalizing case, accents/diacritics, and minor typos via Levenshtein distance.
  - **Matching**: Timed pairs board with accuracy tracking and SRS credit.
  - **Listening**: Web Speech API audio playback with selectable Pick Meaning or Type Word modes.
- **SM-2 Spaced Repetition**: Pure deterministic SM-2 scheduler managing ease factor, intervals, repetitions, lapses, and daily New / Learning / Due queues.
- **Statistics & Gamification**: Recharts daily activity & retention curve, 12-week study heatmap, hardest cards list, per-deck mastery progress, daily streak, SVG goal ring, XP, and achievement badges.
- **Import / Export & Backup**: Drag-and-drop CSV, Anki TSV, and JSON importer with live preview, column mapping, and duplicate strategies; plus CSV/TSV export and full JSON backup/restore.
- **Bilingual & Accessible**: English & Vietnamese (`react-i18next`), Light/Dark/System themes, semantic HTML, ARIA attributes, WCAG AA contrast, and offline-ready PWA (`vite-plugin-pwa`).
- **Optional AI Assist**: Disabled by default; stores an OpenAI-compatible API key strictly locally in IndexedDB to auto-fill meaning, IPA, and examples when enabled.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6
- **Styling & UI**: Tailwind CSS, Radix UI primitives, Lucide icons
- **State & Storage**: Zustand, Dexie (IndexedDB)
- **Charts & i18n**: Recharts, i18next / react-i18next
- **PWA**: `vite-plugin-pwa` (Workbox)
- **Testing & Tooling**: Vitest, React Testing Library, Playwright, ESLint, Prettier

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. On first launch, LexiCards seeds a sample deck of **20 essential English → Vietnamese words** and presents a quick onboarding tour.

## Available Scripts

| Script                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Start Vite development server                     |
| `npm run build`        | Type-check (`tsc -b`) and build production bundle |
| `npm run preview`      | Preview production build locally                  |
| `npm run lint`         | Run ESLint across the codebase                    |
| `npm run format`       | Format files with Prettier                        |
| `npm run format:check` | Check formatting without modifying files          |
| `npm test`             | Run Vitest unit & component tests                 |
| `npm run test:e2e`     | Run Playwright end-to-end smoke tests             |

## Project Structure

```text
src/
├── components/   # UI primitives, layout shell, deck/card modals, study modes, onboarding
├── db/           # Dexie schema, CRUD/SRS actions, 20-word EN->VI seed data
├── features/     # Pure SM-2 engine, TTS, AI assist, gamification, import/export
├── hooks/        # Theme & online status hooks
├── i18n/         # English and Vietnamese locale bundles
├── lib/          # Utilities, text normalization, Levenshtein distance
├── pages/        # Route pages (Dashboard, Decks, DeckDetail, Study, Stats, ImportExport, Settings, 404)
├── store/        # Zustand stores (UI state, toasts)
├── tests/        # Vitest tests & Playwright E2E smoke suite
└── types/        # Strict TypeScript domain definitions
```

## How SM-2 Spaced Repetition Works

Each card tracks `easeFactor` (default `2.5`, minimum `1.3`), `interval` (days), `repetitions`, and `lapses`:

1. **Again (`1`)**: Resets repetitions to `0`, increments lapses, reduces ease factor by `0.2`, and schedules re-learning in `1m`.
2. **Hard (`2`)**: Grows interval conservatively (`1d` → `3d` → `interval × 1.2`) and adjusts ease factor by `-0.15`.
3. **Good (`3`)**: Standard SM-2 progression (`1d` → `6d` → `interval × easeFactor`).
4. **Easy (`4`)**: Accelerated progression (`4d` → `8d` → `interval × easeFactor × 1.3`) and increases ease factor by `+0.15`.

Daily study queues prioritize due **Learning** cards, then due **Review** cards, followed by **New** cards capped by your configurable `dailyNewLimit`.

## Roadmap

- Custom audio recording attachments per card
- Cloze deletion card template support
- Optional encrypted peer-to-peer / WebDAV sync

## License

[MIT](./LICENSE)
