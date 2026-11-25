import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_DRAG_SLOP_PX,
  DIRECTION_TO_RATING,
  computeBadgeOpacities,
  computeDragRotation,
  computeFlyOutVector,
  computeVelocityPxPerSec,
  isDragPastSlop,
  type PointerSample,
  type SwipeDirection,
} from '@/features/study/swipeDecision';
import { useSwipeDecision } from '@/hooks/useSwipeDecision';
import { cn } from '@/lib/utils';
import type { ReviewRating } from '@/types';

export interface SwipeCommand {
  id: number;
  direction: SwipeDirection;
}

interface SwipeableCardProps {
  cardId: string;
  stackDepth: 0 | 1 | 2;
  flipped: boolean;
  onFlip: () => void;
  swipeEnabled: boolean;
  allowSwipeBeforeFlip: boolean;
  threshold: number;
  verticalEnabled: boolean;
  hapticsEnabled: boolean;
  enteringFromDirection?: SwipeDirection | null;
  swipeCommand?: SwipeCommand | null;
  onAnimatingChange?: (animating: boolean) => void;
  onCommitRating: (rating: ReviewRating, direction: SwipeDirection) => void;
  onLockedSwipeAttempt?: () => void;
  ariaLabel: string;
  ariaDescriptionId?: string;
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
}

const STACK_TRANSFORMS: Record<0 | 1 | 2, { scale: number; y: number; opacity: number }> = {
  0: { scale: 1, y: 0, opacity: 1 },
  1: { scale: 0.95, y: 8, opacity: 0.8 },
  2: { scale: 0.9, y: 16, opacity: 0.55 },
};

function findVerticalScrollableAncestor(
  target: EventTarget | null,
  boundary: HTMLElement | null
): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 2
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function canScrollVertically(el: HTMLElement, dy: number): boolean {
  if (dy < 0) {
    // Finger moving up -> scrolling down towards bottom
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  // Finger moving down -> scrolling up towards top
  return el.scrollTop > 1;
}

export function SwipeableCard({
  cardId,
  stackDepth,
  flipped,
  onFlip,
  swipeEnabled,
  allowSwipeBeforeFlip,
  threshold,
  verticalEnabled,
  hapticsEnabled,
  enteringFromDirection,
  swipeCommand,
  onAnimatingChange,
  onCommitRating,
  onLockedSwipeAttempt,
  ariaLabel,
  ariaDescriptionId,
  frontContent,
  backContent,
}: SwipeableCardProps) {
  const { t } = useTranslation();
  const framerReducedMotion = useReducedMotion();
  const prefersReducedMotion =
    Boolean(framerReducedMotion) ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const isTopCard = stackDepth === 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  const { canRate, evaluate, triggerHaptic, getFlyOutTarget } = useSwipeDecision({
    swipeEnabled,
    allowSwipeBeforeFlip,
    isFlipped: flipped,
    threshold,
    verticalEnabled,
    hapticsEnabled,
  });

  // Motion values updated 1:1 on pointer move with zero React state updates
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragScale = useMotionValue(1);
  const dragOpacity = useMotionValue(1);
  const exitRotateOffset = useMotionValue(0);

  const rotate = useTransform([x, exitRotateOffset], (values: number[]) => {
    const [latestX = 0, extra = 0] = values;
    if (prefersReducedMotion) return 0;
    return computeDragRotation(latestX) + extra;
  });

  const leftBadgeOpacity = useTransform(
    [x, y],
    (values: number[]) =>
      computeBadgeOpacities(values[0] ?? 0, values[1] ?? 0, threshold, verticalEnabled).left
  );
  const rightBadgeOpacity = useTransform(
    [x, y],
    (values: number[]) =>
      computeBadgeOpacities(values[0] ?? 0, values[1] ?? 0, threshold, verticalEnabled).right
  );
  const upBadgeOpacity = useTransform(
    [x, y],
    (values: number[]) =>
      computeBadgeOpacities(values[0] ?? 0, values[1] ?? 0, threshold, verticalEnabled).up
  );
  const downBadgeOpacity = useTransform(
    [x, y],
    (values: number[]) =>
      computeBadgeOpacities(values[0] ?? 0, values[1] ?? 0, threshold, verticalEnabled).down
  );

  // Gesture tracking refs (never cause renders)
  const pointerStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    lastY: number;
    isDragging: boolean;
    scrollCaptured: boolean;
    scrollableEl: HTMLElement | null;
    samples: PointerSample[];
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastY: 0,
    isDragging: false,
    scrollCaptured: false,
    scrollableEl: null,
    samples: [],
  });

  const animatingRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const lastHandledCommandIdRef = useRef<number | null>(null);
  const mountedEntranceRef = useRef<string | null>(null);

  const springBack = useCallback(() => {
    exitRotateOffset.set(0);
    setOverlayVisible(false);
    if (prefersReducedMotion) {
      x.set(0);
      y.set(0);
      dragScale.set(1);
      dragOpacity.set(1);
      return;
    }
    void animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 });
    void animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 });
    void animate(dragScale, 1, { type: 'spring', stiffness: 320, damping: 24 });
    dragOpacity.set(1);
  }, [dragOpacity, dragScale, exitRotateOffset, prefersReducedMotion, x, y]);

  const flyOutAndCommit = useCallback(
    async (direction: SwipeDirection) => {
      if (animatingRef.current || !canRate) return;
      animatingRef.current = true;
      setOverlayVisible(true);
      onAnimatingChange?.(true);
      triggerHaptic();

      const rating = DIRECTION_TO_RATING[direction];

      try {
        if (prefersReducedMotion) {
          await Promise.race([
            animate(dragOpacity, 0, { duration: 0.12 }).finished,
            new Promise<void>((resolve) => setTimeout(resolve, 180)),
          ]);
          onCommitRating(rating, direction);
          return;
        }

        const { targetX, targetY, extraRotateDeg } = getFlyOutTarget(direction, x.get(), y.get());
        const duration = 0.26;
        const ease = [0.22, 1, 0.36, 1] as const;

        if (Math.abs(x.get()) < 10 && Math.abs(y.get()) < 10) {
          dragScale.set(0.98);
        }

        await Promise.race([
          Promise.all([
            animate(x, targetX, { duration, ease }).finished,
            animate(y, targetY, { duration, ease }).finished,
            animate(exitRotateOffset, extraRotateDeg, { duration, ease }).finished,
            animate(dragOpacity, 0, { duration: 0.24, ease: 'easeIn' }).finished,
          ]),
          new Promise<void>((resolve) => setTimeout(resolve, 340)),
        ]);

        onCommitRating(rating, direction);
      } finally {
        animatingRef.current = false;
        setOverlayVisible(false);
        onAnimatingChange?.(false);
      }
    },
    [
      canRate,
      dragOpacity,
      dragScale,
      exitRotateOffset,
      getFlyOutTarget,
      onAnimatingChange,
      onCommitRating,
      prefersReducedMotion,
      triggerHaptic,
      x,
      y,
    ]
  );

  // Reverse animation when restored via Undo
  useEffect(() => {
    if (!isTopCard) {
      x.set(0);
      y.set(0);
      dragScale.set(1);
      dragOpacity.set(1);
      exitRotateOffset.set(0);
      return;
    }

    const entranceKey = `${cardId}-${enteringFromDirection ?? 'none'}`;
    if (mountedEntranceRef.current === entranceKey) return;
    mountedEntranceRef.current = entranceKey;

    animatingRef.current = false;
    onAnimatingChange?.(false);

    if (enteringFromDirection && !prefersReducedMotion) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const from = computeFlyOutVector(enteringFromDirection, vw, vh);
      x.set(from.targetX * 0.55);
      y.set(from.targetY * 0.55);
      dragOpacity.set(0.15);
      exitRotateOffset.set(from.extraRotateDeg);

      void animate(x, 0, { type: 'spring', stiffness: 300, damping: 26 });
      void animate(y, 0, { type: 'spring', stiffness: 300, damping: 26 });
      void animate(exitRotateOffset, 0, { type: 'spring', stiffness: 300, damping: 26 });
      void animate(dragOpacity, 1, { duration: 0.2 });
    } else if (enteringFromDirection && prefersReducedMotion) {
      x.set(0);
      y.set(0);
      dragOpacity.set(0);
      exitRotateOffset.set(0);
      void animate(dragOpacity, 1, { duration: 0.14 });
    } else {
      x.set(0);
      y.set(0);
      dragScale.set(1);
      dragOpacity.set(1);
      exitRotateOffset.set(0);
    }
  }, [
    cardId,
    dragOpacity,
    dragScale,
    enteringFromDirection,
    exitRotateOffset,
    isTopCard,
    onAnimatingChange,
    prefersReducedMotion,
    x,
    y,
  ]);

  // Execute programmatic swipe commands (rating buttons or arrow keys)
  useEffect(() => {
    if (!isTopCard || !swipeCommand) return;
    if (lastHandledCommandIdRef.current === swipeCommand.id) return;
    lastHandledCommandIdRef.current = swipeCommand.id;
    void flyOutAndCommit(swipeCommand.direction);
  }, [flyOutAndCommit, isTopCard, swipeCommand]);

  // Abort active drag cleanly if window blurs mid-drag
  useEffect(() => {
    if (!isTopCard) return;
    const handleBlur = () => {
      if (pointerStateRef.current.active) {
        pointerStateRef.current.active = false;
        pointerStateRef.current.isDragging = false;
        pointerStateRef.current.pointerId = null;
        springBack();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isTopCard, springBack]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTopCard || animatingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [data-no-swipe="true"]')) {
      return;
    }

    const scrollableEl = findVerticalScrollableAncestor(e.target, cardRef.current);
    pointerStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      isDragging: false,
      scrollCaptured: false,
      scrollableEl,
      samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current;
    if (!isTopCard || !state.active || state.pointerId !== e.pointerId || animatingRef.current) {
      return;
    }

    if (state.scrollCaptured) {
      if (state.scrollableEl) {
        const deltaStepY = e.clientY - state.lastY;
        state.scrollableEl.scrollTop -= deltaStepY;
      }
      state.lastY = e.clientY;
      return;
    }

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const now = performance.now();

    state.samples.push({ x: e.clientX, y: e.clientY, t: now });
    if (state.samples.length > 12) {
      state.samples.shift();
    }

    if (!state.isDragging) {
      if (!isDragPastSlop(dx, dy, DEFAULT_DRAG_SLOP_PX)) {
        return;
      }

      if (!swipeEnabled) {
        state.active = false;
        return;
      }

      // Start swipe ONLY if inner card content isn't being scrolled vertically
      if (
        state.scrollableEl &&
        Math.abs(dy) > Math.abs(dx) &&
        canScrollVertically(state.scrollableEl, dy)
      ) {
        state.scrollCaptured = true;
        return;
      }

      state.isDragging = true;
      suppressNextClickRef.current = true;
      setOverlayVisible(true);
      if (!prefersReducedMotion) {
        dragScale.set(0.98);
      }

      try {
        cardRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events in tests may not support setPointerCapture
      }
    }

    if (prefersReducedMotion) {
      return;
    }

    x.set(dx);
    y.set(dy);
  };

  const finishPointerGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = pointerStateRef.current;
    if (!state.active || state.pointerId !== e.pointerId) return;

    try {
      if (cardRef.current?.hasPointerCapture?.(e.pointerId)) {
        cardRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic capture cleanup errors
    }

    const wasDragging = state.isDragging;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const samples = state.samples;

    pointerStateRef.current.active = false;
    pointerStateRef.current.pointerId = null;
    pointerStateRef.current.isDragging = false;
    pointerStateRef.current.scrollCaptured = false;

    if (!wasDragging) return;

    // Reset synthetic click suppression after browser dispatches pointerup click
    setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 60);

    if (cancelled) {
      springBack();
      return;
    }

    const { vx, vy } = computeVelocityPxPerSec(samples);
    const decision = evaluate(dx, dy, vx, vy);

    if (decision.shouldCommit && decision.direction) {
      void flyOutAndCommit(decision.direction);
      return;
    }

    if (decision.lockedReason === 'flip_required') {
      onLockedSwipeAttempt?.();
    }

    springBack();
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTopCard || animatingRef.current) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [data-no-swipe="true"]')) {
      return;
    }
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onFlip();
  };

  const stackPose = STACK_TRANSFORMS[stackDepth];

  return (
    <motion.div
      data-testid={isTopCard ? 'active-swipe-card' : `stack-card-${stackDepth}`}
      data-stack-depth={stackDepth}
      initial={false}
      animate={stackPose}
      transition={
        prefersReducedMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 320, damping: 26 }
      }
      style={{
        zIndex: 30 - stackDepth * 10,
      }}
      aria-hidden={!isTopCard}
      className={cn('absolute inset-0', isTopCard ? 'pointer-events-auto' : 'pointer-events-none')}
    >
      <motion.div
        ref={cardRef}
        role={isTopCard ? 'group' : undefined}
        tabIndex={isTopCard ? 0 : -1}
        aria-label={isTopCard ? ariaLabel : undefined}
        aria-describedby={isTopCard ? ariaDescriptionId : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPointerGesture(e, false)}
        onPointerCancel={(e) => finishPointerGesture(e, true)}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (!isTopCard) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            onFlip();
          }
        }}
        style={{
          x: isTopCard ? x : 0,
          y: isTopCard ? y : 0,
          scale: isTopCard ? dragScale : 1,
          opacity: isTopCard ? dragOpacity : 1,
          rotate: isTopCard ? rotate : 0,
          touchAction: isTopCard && swipeEnabled ? 'none' : 'auto',
          willChange: isTopCard ? 'transform' : undefined,
        }}
        className={cn(
          'swipe-card-surface perspective-1000 relative h-full w-full rounded-2xl',
          isTopCard &&
            'cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <div className={cn('flip-card-inner rounded-2xl', flipped && 'is-flipped')}>
          {/* Front Face */}
          <div className="flip-card-face flex flex-col justify-between overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-card p-6 shadow-md sm:p-8">
            {frontContent}
          </div>

          {/* Back Face */}
          <div className="flip-card-face flip-card-back flex flex-col justify-between overflow-y-auto overflow-x-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-md sm:p-8">
            {backContent}
          </div>
        </div>

        {/* Swipe Feedback Overlays (Opacity driven by motion values -> zero re-renders during drag) */}
        {isTopCard && swipeEnabled && overlayVisible && (
          <>
            {/* RIGHT = Good (Green) */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: rightBadgeOpacity }}
              className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.28)]"
            >
              <div className="absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-emerald-500 bg-emerald-500/15 px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-emerald-600 backdrop-blur-sm dark:text-emerald-300">
                {t('study.swipeBadges.3')}
              </div>
            </motion.div>

            {/* LEFT = Again (Red) */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: leftBadgeOpacity }}
              className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.28)]"
            >
              <div className="absolute right-5 top-5 rotate-12 rounded-lg border-2 border-rose-500 bg-rose-500/15 px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-rose-600 backdrop-blur-sm dark:text-rose-300">
                {t('study.swipeBadges.1')}
              </div>
            </motion.div>

            {/* UP = Easy (Blue) */}
            {verticalEnabled && (
              <motion.div
                aria-hidden="true"
                style={{ opacity: upBadgeOpacity }}
                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-sky-500 shadow-[0_0_24px_rgba(14,165,233,0.28)]"
              >
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg border-2 border-sky-500 bg-sky-500/15 px-3.5 py-1 text-sm font-extrabold uppercase tracking-wider text-sky-600 backdrop-blur-sm dark:text-sky-300">
                  {t('study.swipeBadges.4')}
                </div>
              </motion.div>
            )}

            {/* DOWN = Hard (Orange) */}
            {verticalEnabled && (
              <motion.div
                aria-hidden="true"
                style={{ opacity: downBadgeOpacity }}
                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.28)]"
              >
                <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-lg border-2 border-orange-500 bg-orange-500/15 px-3.5 py-1 text-sm font-extrabold uppercase tracking-wider text-orange-600 backdrop-blur-sm dark:text-orange-300">
                  {t('study.swipeBadges.2')}
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
