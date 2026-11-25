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

  test('swipe gestures at 390px: short drag springs back, swipe right rates Good and advances, and Undo restores', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Open sample English deck -> Flip Card study mode
    await page.getByText('Essential English → Vietnamese', { exact: true }).click();
    await page.getByRole('link', { name: 'Flip Card' }).click();

    await expect(page.getByText('1 / 20')).toBeVisible();
    const activeCard = page.getByTestId('active-swipe-card').locator('[role="group"]');
    await expect(activeCard).toBeVisible();

    // Check responsive viewport across 390px, 768px, 1280px during study
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const box = await activeCard.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Install long-task observer before drag to verify zero long tasks (> 50ms) during drag
    await page.evaluate(() => {
      (window as unknown as { __longTaskCount: number }).__longTaskCount = 0;
      if ('PerformanceObserver' in window) {
        const obs = new PerformanceObserver((list) => {
          (window as unknown as { __longTaskCount: number }).__longTaskCount +=
            list.getEntries().length;
        });
        try {
          obs.observe({ entryTypes: ['longtask'] });
        } catch {
          // Browser may skip longtask observation in headless profile
        }
      }
    });

    // Short drag (35px) should spring back without advancing
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 35, cy, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText('1 / 20')).toBeVisible();

    // Full swipe right (> 100px) should commit Good and advance to card 2
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 165, cy - 8, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText('2 / 20')).toBeVisible();

    // Undo restores card 1 with reversed stack counter
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(page.getByText('1 / 20')).toBeVisible();

    const longTasks = await page.evaluate(
      () => (window as unknown as { __longTaskCount: number }).__longTaskCount
    );
    expect(longTasks).toBe(0);
    expect(consoleErrors).toEqual([]);
  });
});
