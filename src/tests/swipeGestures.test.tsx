import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@/i18n';
import { db, getOrCreateSettings } from '@/db';
import { recordCardReview, undoCardReview, updateSettings } from '@/db/actions';
import { createInitialSRSFields } from '@/features/srs/sm2';
import * as tts from '@/features/tts';
import {
  computeBadgeOpacities,
  computeDragRotation,
  evaluateSwipeCommit,
  isDragPastSlop,
  resolveSwipeDirection,
} from '@/features/study/swipeDecision';
import { FlipCardMode } from '@/components/study/FlipCardMode';
import { SettingsPage } from '@/pages/SettingsPage';
import type { Card } from '@/types';

const now = 1_700_000_000_000;

function makeSampleCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'swipe-card-1',
    deckId: 'swipe-deck-1',
    term: 'resilient',
    meaning: 'kiên cường',
    phonetic: '/rɪˈzɪliənt/',
    partOfSpeech: 'adjective',
    example: 'Children are resilient.',
    exampleTranslation: 'Trẻ em rất kiên cường.',
    notes: '',
    imageUrl: '',
    tags: ['ielts'],
    ...createInitialSRSFields(now),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function resetSwipeTestDb() {
  await db.transaction('rw', [db.decks, db.cards, db.reviewLogs, db.settings], async () => {
    await db.decks.clear();
    await db.cards.clear();
    await db.reviewLogs.clear();
    await db.settings.clear();
  });
  await getOrCreateSettings();
}

describe('Swipe decision pure helpers', () => {
  it('resolves direction by dominant axis and supports disabling vertical swipes', () => {
    expect(resolveSwipeDirection(-120, 20, true)).toBe('left');
    expect(resolveSwipeDirection(130, -30, true)).toBe('right');
    expect(resolveSwipeDirection(20, -140, true)).toBe('up');
    expect(resolveSwipeDirection(-15, 115, true)).toBe('down');

    // When vertical swipes disabled, pure vertical drag does not trigger horizontal rating
    expect(resolveSwipeDirection(10, -140, false)).toBeNull();
    expect(resolveSwipeDirection(110, 20, false)).toBe('right');
  });

  it('commits on distance (> threshold) or velocity (> 500 px/s) and rejects small drags', () => {
    expect(
      evaluateSwipeCommit({
        offsetX: 60,
        offsetY: 10,
        velocityX: 120,
        velocityY: 0,
        threshold: 100,
        verticalEnabled: true,
        canRate: true,
      })
    ).toEqual({ shouldCommit: false, direction: null, rating: null });

    expect(
      evaluateSwipeCommit({
        offsetX: 115,
        offsetY: 12,
        velocityX: 150,
        velocityY: 0,
        threshold: 100,
        verticalEnabled: true,
        canRate: true,
      })
    ).toEqual({ shouldCommit: true, direction: 'right', rating: 3 });

    // Velocity flick with shorter distance
    expect(
      evaluateSwipeCommit({
        offsetX: -45,
        offsetY: 5,
        velocityX: -620,
        velocityY: 10,
        threshold: 100,
        verticalEnabled: true,
        canRate: true,
      })
    ).toEqual({ shouldCommit: true, direction: 'left', rating: 1 });

    // Respects custom threshold (60px)
    expect(
      evaluateSwipeCommit({
        offsetX: 0,
        offsetY: -70,
        velocityX: 0,
        velocityY: -200,
        threshold: 60,
        verticalEnabled: true,
        canRate: true,
      })
    ).toEqual({ shouldCommit: true, direction: 'up', rating: 4 });

    // Blocks commit when locked before flip
    expect(
      evaluateSwipeCommit({
        offsetX: 150,
        offsetY: 0,
        velocityX: 400,
        velocityY: 0,
        threshold: 100,
        verticalEnabled: true,
        canRate: false,
      })
    ).toEqual({
      shouldCommit: false,
      direction: 'right',
      rating: null,
      lockedReason: 'flip_required',
    });
  });

  it('computes tap slop, rotation clamping (±15deg), and badge fade curves (20px -> threshold)', () => {
    expect(isDragPastSlop(3, 4)).toBe(false); // hypot = 5 < 6
    expect(isDragPastSlop(6, 0)).toBe(true);

    expect(computeDragRotation(100)).toBe(5);
    expect(computeDragRotation(500)).toBe(15);
    expect(computeDragRotation(-500)).toBe(-15);

    expect(computeBadgeOpacities(15, 0, 100, true).right).toBe(0);
    expect(computeBadgeOpacities(60, 0, 100, true).right).toBeCloseTo(0.5, 5);
    expect(computeBadgeOpacities(120, 0, 100, true).right).toBe(1);
    expect(computeBadgeOpacities(0, -100, 100, false).up).toBe(0);
  });
});

describe('SwipeableCard + FlipCardMode + Undo integration', () => {
  beforeEach(async () => {
    await resetSwipeTestDb();
  });

  it('distinguishes tap (flips) from drag and lets keyboard arrow swipes invoke onRate', async () => {
    const onRate = vi.fn();
    const card = makeSampleCard();
    render(
      <FlipCardMode
        card={card}
        upcomingCards={[makeSampleCard({ id: 'swipe-card-2', term: 'ephemeral' })]}
        canGoPrev={false}
        canGoNext={true}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRate={onRate}
      />
    );

    const cardGroup = await screen.findByRole('group');
    expect(cardGroup.style.touchAction).toBe('none');

    // Small movement (<6px) followed by click flips instead of swiping
    fireEvent.pointerDown(cardGroup, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(cardGroup, {
      pointerId: 1,
      clientX: 103,
      clientY: 102,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(cardGroup, {
      pointerId: 1,
      clientX: 103,
      clientY: 102,
      pointerType: 'touch',
    });
    fireEvent.click(cardGroup);
    expect(onRate).not.toHaveBeenCalled();

    // ArrowRight performs animated Good swipe -> calls onRate(3, 'right')
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(onRate).toHaveBeenCalledWith(3, 'right'));
  });

  it('respects prefers-reduced-motion cleanly during animated rating', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const onRate = vi.fn();
      render(
        <FlipCardMode
          card={makeSampleCard()}
          canGoPrev={false}
          canGoNext={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRate={onRate}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      await waitFor(() => expect(onRate).toHaveBeenCalledWith(1, 'left'));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('blocks pre-flip rating when allowSwipeBeforeFlip is false until flipped', async () => {
    await updateSettings({ allowSwipeBeforeFlip: false, swipeVerticalEnabled: false });
    const onRate = vi.fn();

    render(
      <FlipCardMode
        card={makeSampleCard()}
        canGoPrev={false}
        canGoNext={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRate={onRate}
      />
    );

    const goodButton = await screen.findByRole('button', { name: /Good/ });
    await waitFor(() => expect(goodButton).toBeDisabled());

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onRate).not.toHaveBeenCalled();

    // Flip with Space, then ArrowUp should still ignore since vertical disabled, while ArrowRight succeeds
    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(goodButton).toBeEnabled());

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onRate).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(onRate).toHaveBeenCalledWith(3, 'right'));
  });

  it('undoCardReview reverts SM-2 state, review log entry, and XP inside Dexie transaction', async () => {
    const initial = makeSampleCard();
    await db.cards.put(initial);

    const res = await recordCardReview(initial, 3, 'flip', 1800);
    const updatedInDb = await db.cards.get(initial.id);
    expect(updatedInDb?.repetitions).toBe(1);
    expect(updatedInDb?.interval).toBe(1);
    expect(await db.reviewLogs.count()).toBe(1);

    await undoCardReview({
      previousCard: initial,
      reviewLogId: res.reviewLogId,
      xpEarned: res.xpEarned,
    });

    const restored = await db.cards.get(initial.id);
    expect(restored?.repetitions).toBe(0);
    expect(restored?.interval).toBe(0);
    expect(restored?.status).toBe('new');
    expect(restored?.dueDate).toBe(initial.dueDate);
    expect(await db.reviewLogs.count()).toBe(0);
    expect((await db.settings.get('default'))?.xp).toBe(0);
  });

  it('persists swipe settings toggles in SettingsPage', async () => {
    render(<SettingsPage />);

    const allowBeforeFlipSwitch = await screen.findByRole('switch', {
      name: 'Allow swipe before flip',
    });
    expect(allowBeforeFlipSwitch).toBeChecked();

    fireEvent.click(allowBeforeFlipSwitch);
    await waitFor(async () => {
      const stored = await db.settings.get('default');
      expect(stored?.allowSwipeBeforeFlip).toBe(false);
    });

    const thresholdSelect = screen.getByLabelText('Swipe sensitivity');
    fireEvent.change(thresholdSelect, { target: { value: '60' } });
    await waitFor(async () => {
      const stored = await db.settings.get('default');
      expect(stored?.swipeThreshold).toBe(60);
    });
  });

  it('keeps Previous & Next buttons available alongside swipe and auto-reads on card arrival', async () => {
    const autoReadSpy = vi.spyOn(tts, 'debouncedPlayTTS').mockImplementation(() => {});
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const card1 = makeSampleCard({ id: 'c1', term: 'resilient' });
    const card2 = makeSampleCard({ id: 'c2', term: 'pragmatic' });

    const { rerender } = render(
      <FlipCardMode
        card={card1}
        upcomingCards={[card2]}
        canGoPrev={false}
        canGoNext={true}
        ttsAutoplay={true}
        onPrev={onPrev}
        onNext={onNext}
        onRate={vi.fn()}
      />
    );

    const prevBtn = await screen.findByRole('button', { name: 'Previous' });
    const nextBtn = await screen.findByRole('button', { name: 'Next' });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    expect(autoReadSpy).toHaveBeenCalledWith(
      'resilient',
      expect.objectContaining({ lang: 'en-US' })
    );

    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);

    rerender(
      <FlipCardMode
        card={card2}
        upcomingCards={[]}
        canGoPrev={true}
        canGoNext={false}
        ttsAutoplay={true}
        onPrev={onPrev}
        onNext={onNext}
        onRate={vi.fn()}
      />
    );

    expect(autoReadSpy).toHaveBeenCalledWith(
      'pragmatic',
      expect.objectContaining({ lang: 'en-US' })
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrev).toHaveBeenCalledTimes(1);

    autoReadSpy.mockRestore();
  });
});
