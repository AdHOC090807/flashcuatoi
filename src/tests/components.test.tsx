import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/i18n';
import { FlipCardMode } from '@/components/study/FlipCardMode';
import { TypingMode } from '@/components/study/TypingMode';
import { DeckCard } from '@/components/decks/DeckCard';
import { createInitialSRSFields } from '@/features/srs/sm2';
import type { Card, Deck } from '@/types';

const now = 1_700_000_000_000;

const sampleCard: Card = {
  id: 'c1',
  deckId: 'd1',
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
};

const sampleDeck: Deck = {
  id: 'd1',
  name: 'Essential English',
  description: 'Core vocabulary',
  color: '#4f46e5',
  emoji: '📘',
  tags: ['english'],
  createdAt: now,
  updatedAt: now,
};

describe('UI Components', () => {
  it('FlipCardMode flips on Space and rates on number keys', () => {
    const onRate = vi.fn();
    render(
      <FlipCardMode
        card={sampleCard}
        canGoPrev={false}
        canGoNext={false}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onRate={onRate}
      />
    );

    expect(screen.getByRole('heading', { name: 'resilient' })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Space' });
    expect(screen.getByText('Good')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '3' });
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('TypingMode accepts tolerant answers with minor typos', () => {
    const onAnswered = vi.fn();
    render(<TypingMode card={sampleCard} onAnswered={onAnswered} />);

    const input = screen.getByPlaceholderText('Type your answer...');
    fireEvent.change(input, { target: { value: 'resilent' } });
    fireEvent.submit(input.closest('form')!);

    expect(screen.getByText(/Close enough/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onAnswered).toHaveBeenCalledWith(3, true);
  });

  it('DeckCard displays deck counts and links', () => {
    render(
      <MemoryRouter>
        <DeckCard
          deck={sampleDeck}
          counts={{
            newCount: 5,
            learningCount: 2,
            dueCount: 3,
            totalCount: 10,
            masteredCount: 1,
          }}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Essential English')).toBeInTheDocument();
    expect(screen.getByText(/New: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Due: 3/)).toBeInTheDocument();
  });
});
