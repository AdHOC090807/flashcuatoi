import { useCallback, useMemo } from 'react';
import {
  DIRECTION_TO_RATING,
  RATING_TO_DIRECTION,
  computeFlyOutVector,
  evaluateSwipeCommit,
  type SwipeCommitDecision,
  type SwipeDirection,
} from '@/features/study/swipeDecision';
import type { ReviewRating } from '@/types';

export interface UseSwipeDecisionConfig {
  swipeEnabled: boolean;
  allowSwipeBeforeFlip: boolean;
  isFlipped: boolean;
  threshold: number;
  verticalEnabled: boolean;
  hapticsEnabled: boolean;
}

export function useSwipeDecision(config: UseSwipeDecisionConfig) {
  const canRate = config.isFlipped || config.allowSwipeBeforeFlip;

  const evaluate = useCallback(
    (
      offsetX: number,
      offsetY: number,
      velocityX: number,
      velocityY: number
    ): SwipeCommitDecision => {
      if (!config.swipeEnabled) {
        return { shouldCommit: false, direction: null, rating: null };
      }
      return evaluateSwipeCommit({
        offsetX,
        offsetY,
        velocityX,
        velocityY,
        threshold: config.threshold,
        verticalEnabled: config.verticalEnabled,
        canRate,
      });
    },
    [config.swipeEnabled, config.threshold, config.verticalEnabled, canRate]
  );

  const triggerHaptic = useCallback(() => {
    if (!config.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore on unsupported mobile browsers (e.g. iOS Safari)
      }
    }
  }, [config.hapticsEnabled]);

  const directionToRating = useCallback(
    (direction: SwipeDirection): ReviewRating => DIRECTION_TO_RATING[direction],
    []
  );

  const ratingToDirection = useCallback(
    (rating: ReviewRating): SwipeDirection => RATING_TO_DIRECTION[rating],
    []
  );

  const getFlyOutTarget = useCallback((direction: SwipeDirection, currentX = 0, currentY = 0) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return computeFlyOutVector(direction, vw, vh, currentX, currentY);
  }, []);

  return useMemo(
    () => ({
      canRate,
      evaluate,
      triggerHaptic,
      directionToRating,
      ratingToDirection,
      getFlyOutTarget,
    }),
    [canRate, evaluate, triggerHaptic, directionToRating, ratingToDirection, getFlyOutTarget]
  );
}
