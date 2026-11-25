# LexiCards

> Offline-first vocabulary learning web application powered by **SM-2 spaced repetition**, multi-mode practice, Japanese kana/lesson support, rich analytics, and bilingual English/Vietnamese UI.

## Features

- **English & Japanese Decks**: Create `en` or `ja` decks with color accents, emoji icons, tags, search, filter, and sort.
- **Full Card CRUD**:
  - **English**: Term, meaning, IPA phonetic, part of speech, example sentence & translation, notes, image URL, tags.
  - **Japanese (`deck.language === 'ja'`)**: Kana primary term, auto-generated editable Romaji (`wanakana`), optional Kanji (hidden by default; renders `<ruby>` furigana when enabled in Settings), word type, Lesson (`1..50`), and optional verb conjugations (`ます / て / た / ない`).
- **Study Modes**:
  - **Flip Card**: Smooth 3D card flip (`Space` to flip, `1-4` to rate, arrow keys to navigate, respects `prefers-reduced-motion`).
  - **Quiz**: Auto-generated 4-option multiple choice (for Japanese decks, prioritizes same `wordType` and similar kana length).
  - **Typing**: Tolerant answer checker — English normalizes case/accents/minor typos; Japanese accepts **kana OR romaji** with long-vowel (`ou`/`oo`/`ō`/`ー`), small `っ`, `ん`/`n'`, and hiragana–katakana equivalence.
  - **Matching**: Timed pairs board with accuracy tracking and SRS credit.
  - **Listening**: Web Speech API (`en-US` / `ja-JP` auto-voice) with speed slider, replay, autoplay toggle, and Pick / Type sub-modes.
  - **Conjugation Drill**: Verb conjugation quiz (`ます / て / た / ない`) for Japanese verb cards.
- **Kana Trainer (`/kana`)**: Interactive Hiragana & Katakana charts, selectable row groups (Basic, Dakuten, Handakuten, Yoon), Flashcards, and Quiz with `ja-JP` TTS.
- **Lessons (`Bài 1..50`)**: Group Japanese vocabulary by lesson with per-lesson progress bars and a **"Study lessons X to Y"** combined queue.
- **SM-2 Spaced Repetition**: Pure deterministic SM-2 scheduler managing ease factor, intervals, repetitions, lapses, and daily New / Learning / Due queues.
- **Statistics & Gamification**: Recharts daily activity & retention curve, 12-week study heatmap, hardest cards list, per-deck mastery progress, daily streak, SVG goal ring, XP, and achievement badges.
- **Quick Import by Paste (`/import/paste`)**: Click **"Paste to create / Dán để tạo bộ thẻ"** on the Decks or Deck Detail pages to paste raw vocabulary lists, CSV/TSV, JSON (`zod`-validated), Anki plain-text exports (with HTML tag cleanup), or Markdown tables. Includes auto-detected formats & separators, 300ms debounced inline preview (virtualized for >200 rows), smart Japanese Kana/Romaji/Kanji mapping via `wanakana`, optional AI auto-fill, atomic Dexie transactions, and 30-second Undo toast + import history.
- **Import / Export & Backup**: Drag-and-drop CSV, Anki TSV, and JSON importer with live preview, Anki Japanese presets, column mapping, duplicate strategies, CSV/TSV export, and full JSON backup/restore (backward-compatible with v1 backups).
- **Bilingual, Accessible & Offline-First**: English & Vietnamese (`react-i18next`), Light/Dark/System themes, self-hosted Noto Sans JP (`@fontsource/noto-sans-jp`), `lang="ja"` markup, WCAG AA contrast, and PWA (`vite-plugin-pwa`).
- **Optional AI Assist**: Disabled by default; stores an OpenAI-compatible API key strictly locally in IndexedDB to auto-fill card fields when enabled.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6
- **Styling & UI**: Tailwind CSS, Radix UI primitives, Lucide icons, `@fontsource/noto-sans-jp`
- **State, Storage & Japanese**: Zustand, Dexie v4 (IndexedDB with v1→v2 migration), `wanakana`
- **Charts & i18n**: Recharts, i18next / react-i18next
- **PWA**: `vite-plugin-pwa` (Workbox)
- **Testing & Tooling**: Vitest, React Testing Library, Playwright, ESLint, Prettier

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. On first launch, LexiCards seeds both a **20-word English → Vietnamese** starter deck and a **20-word Beginner Japanese → Vietnamese** starter deck (across Lessons 1–4), and presents a quick onboarding tour. Existing users can also add the Japanese starter deck anytime from **Settings**.

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
├── components/   # UI primitives, layout shell, deck/card modals, JapaneseTerm, study modes, onboarding
├── db/           # Dexie v2 schema & v1->v2 migration, CRUD/SRS actions, EN & JA seed data
├── features/     # Pure SM-2 engine, Japanese engine + kanaData, TTS, AI assist, gamification, import/export
├── hooks/        # Theme & online status hooks
├── i18n/         # English and Vietnamese locale bundles
├── lib/          # Utilities, text normalization, Levenshtein distance
├── pages/        # Dashboard, Decks, DeckDetail (with Lessons), Study, KanaTrainer, Stats, ImportExport, Settings, 404
├── store/        # Zustand stores (UI state, toasts)
├── tests/        # Vitest tests (SM-2, Japanese, Dexie migration, components) & Playwright E2E suite
└── types/        # Strict TypeScript domain definitions
```

## How SM-2 Spaced Repetition Works

Each card tracks `easeFactor` (default `2.5`, minimum `1.3`), `interval` (days), `repetitions`, and `lapses`:

1. **Again (`1`)**: Resets repetitions to `0`, increments lapses, reduces ease factor by `0.2`, and schedules re-learning in `1m`.
2. **Hard (`2`)**: Grows interval conservatively (`1d` → `3d` → `interval × 1.2`) and adjusts ease factor by `-0.15`.
3. **Good (`3`)**: Standard SM-2 progression (`1d` → `6d` → `interval × easeFactor`).
4. **Easy (`4`)**: Accelerated progression (`4d` → `8d` → `interval × easeFactor × 1.3`) and increases ease factor by `+0.15`.

Daily study queues prioritize due **Learning** cards, then due **Review** cards, followed by **New** cards capped by your configurable `dailyNewLimit`.

## Quick Import by Paste

Open the **Paste to create / Dán để tạo bộ thẻ** dialog from the **Decks** or **Deck Detail** page, or visit `/import/paste` directly:

1. **Auto-detected formats**:
   - **Simple lines**: `term - meaning` (auto-detects `\t`, `" - "`, `" = "`, `;`, `|`, `,`, `:`; splits on the first separator only; start line 1 with `# Deck Name` to auto-name a new deck).
   - **CSV / TSV**: Header-mapped (`term`, `meaning`, `kana`, `romaji`, `kanji`, `example`, `translation`, `wordType`, `lesson`, `tags`) with quoted commas, escaped quotes, and multi-line cells (`papaparse`).
   - **JSON**: Card array or `{ name, language, cards: [...] }` validated via `zod` with exact path errors (e.g. `cards[3].meaning`).
   - **Anki Plain Text**: Supports `#separator:tab` / `#columns:` / `#deck:` headers, converts `<br>` to newlines, strips HTML tags, and decodes HTML entities safely.
   - **Markdown Tables**: Parses `| col1 | col2 |` tables automatically.
2. **Japanese Smart Parsing (`ja`)**: Auto-generates Romaji with `wanakana`, converts Romaji-only terms into Hiragana, preserves Kanji in the optional field, and warns when Kanji is missing a Kana reading.
3. **Preview, Transactions & Undo**: Edit cells inline, remap columns, swap `term ↔ meaning`, apply batch Lesson/Tags, save up to 5,000+ cards in a single all-or-nothing Dexie transaction, and undo any import for 30s from the toast or anytime via **Import history**.

## Roadmap

- Custom audio recording attachments per card
- Cloze deletion card template support
- Optional encrypted peer-to-peer / WebDAV sync

## Deploy the TTS proxy

LexiCards includes a Cloudflare Worker proxy under `worker/` so the deployed GitHub Pages site can use ElevenLabs TTS across devices without exposing your API key or requiring users to enter one.

1. Authenticate Wrangler with your Cloudflare account:
   ```bash
   cd worker
   npm install
   npx wrangler login
   ```
2. Store your ElevenLabs API key as a Worker secret (never in `wrangler.toml` or git):
   ```bash
   npx wrangler secret put ELEVENLABS_API_KEY
   ```
3. Verify `ALLOWED_ORIGINS` and `DEFAULT_VOICE_ID` under `[vars]` in `worker/wrangler.toml`:
   ```toml
   [vars]
   ALLOWED_ORIGINS = "https://adhoc090807.github.io,http://localhost:5173"
   DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
   ```
4. Deploy the Worker and copy the deployed `https://<name>.<subdomain>.workers.dev` URL:
   ```bash
   npx wrangler deploy
   ```
5. Save the public Worker URL as a GitHub Actions **repository variable** (not a secret) so GitHub Pages builds bake it into `VITE_TTS_PROXY_URL`:
   ```bash
   gh variable set VITE_TTS_PROXY_URL --body https://<your-worker-url>.workers.dev
   ```
6. Re-run the **Deploy to GitHub Pages** workflow (or push to `main`). Once set, **Settings → TTS Provider** defaults to `ElevenLabs Proxy` and automatically falls back to browser Web Speech if offline or rate-limited.

## License

[MIT](./LICENSE)
