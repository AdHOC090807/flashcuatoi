# Contributing to LexiCards

Thank you for your interest in contributing to **LexiCards**!

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local dev server:
   ```bash
   npm run dev
   ```

## Quality Checks

Before opening a pull request, please ensure all checks pass:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation updates
- `test:` unit, component, or e2e tests
- `ci:` GitHub Actions or tooling changes
- `chore:` maintenance and dependencies
- `refactor:` code refactoring without behavioral changes

## Code Guidelines

- Keep TypeScript strict — **no `any`**.
- Keep SM-2 spaced repetition logic pure and unit-tested under `src/features/srs/`.
- Add translations for both English (`src/i18n/locales/en.json`) and Vietnamese (`src/i18n/locales/vi.json`).
- Respect accessibility (keyboard navigation, ARIA labels, WCAG AA contrast) and `prefers-reduced-motion`.
