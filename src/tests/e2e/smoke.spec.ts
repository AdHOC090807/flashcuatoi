import { expect, test } from '@playwright/test';

test.describe('LexiCards smoke tests', () => {
  test('loads seeded sample deck, dismisses tour, creates deck and studies flip mode', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Onboarding tour appears on first run
    await expect(page.getByText('Welcome to LexiCards!')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Sample deck should appear on dashboard
    await expect(page.getByText('Essential English → Vietnamese', { exact: true })).toBeVisible();

    // Navigate to Decks and create a new deck
    await page.getByRole('link', { name: 'Decks' }).first().click();
    await page.getByRole('button', { name: 'New Deck' }).click();
    await page.getByLabel('Deck Name *').fill('Travel Phrases');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Travel Phrases' })).toBeVisible();

    // Open sample deck and launch Flip study mode
    await page.getByText('Essential English → Vietnamese', { exact: true }).click();
    await page.getByRole('link', { name: 'Flip Card' }).click();

    // Flip card and rate Good
    await page.getByRole('button', { name: 'Show Answer', exact: true }).click();
    await page.getByRole('button', { name: /Good/ }).click();

    // Switch to Typing mode and check Settings & Import/Export & 404
    await page.getByRole('tab', { name: 'Typing' }).click();
    await expect(page.getByPlaceholder('Type your answer...')).toBeVisible();

    // Verify Japanese starter deck, lessons, romaji typing, and Kana Trainer
    await page.goto('/decks');
    await expect(page.getByText('Beginner Japanese → Vietnamese', { exact: true })).toBeVisible();
    await page.getByText('Beginner Japanese → Vietnamese', { exact: true }).click();
    await expect(page.getByText('Lessons', { exact: true })).toBeVisible();
    // Kanji should be hidden by default
    await expect(page.getByText('たべる')).toBeVisible();
    await expect(page.getByText('食べる')).toHaveCount(0);

    await page.getByRole('link', { name: 'Typing' }).click();
    await expect(page.getByPlaceholder('e.g. たべる or taberu')).toBeVisible();

    await page.goto('/kana');
    await expect(page.getByRole('heading', { name: 'Kana Trainer' })).toBeVisible();
    await expect(page.getByText('あ', { exact: true })).toBeVisible();

    await page.goto('/import-export');
    await expect(page.getByRole('heading', { name: 'Import & Export' })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.goto('/non-existent-route');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('renders cleanly across mobile (360px), tablet (768px), and desktop (1280px)', async ({
    page,
  }) => {
    await page.goto('/stats');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole('heading', { name: 'Learning Statistics' })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    }
  });
});
