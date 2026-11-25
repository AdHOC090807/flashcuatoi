import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moveCardsToDeck } from '@/db/actions';
import { useToastStore } from '@/store/useToastStore';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { Deck } from '@/types';

interface MoveCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardIds: string[];
  currentDeckId: string;
  decks: Deck[];
  onMoved: () => void;
}

export function MoveCardModal({
  open,
  onOpenChange,
  cardIds,
  currentDeckId,
  decks,
  onMoved,
}: MoveCardModalProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);
  const availableDecks = decks.filter((d) => d.id !== currentDeckId);
  const [targetId, setTargetId] = useState(availableDecks[0]?.id ?? '');

  const handleMove = async () => {
    const chosen = targetId || availableDecks[0]?.id;
    if (!chosen) return;
    await moveCardsToDeck(cardIds, chosen);
    pushToast({
      title: t('cards.moveToDeck'),
      description: `${cardIds.length} ${t('common.cards')}`,
      variant: 'success',
    });
    onMoved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('cards.moveToDeck')} className="max-w-md">
        {availableDecks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create another deck first to move cards.</p>
        ) : (
          <div className="space-y-4">
            <select
              value={targetId || availableDecks[0].id}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {availableDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleMove}>{t('common.confirm')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
