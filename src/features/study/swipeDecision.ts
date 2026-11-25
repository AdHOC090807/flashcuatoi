import type { ReviewRating } from '@/types';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export const DEFAULT_DRAG_SLOP_PX = 6;
export const DEFAULT_SWIPE_THRESHOLD_PX = 100;
export const DEFAULT_VELOCITY_THRESHOLD_PX_S = 500;
export const BADGE_FADE_START_PX = 20;
export const MAX_DRAG_ROTATION_DEG = 15;

export const DIRECTION_TO_RATING: Record<SwipeDirection, ReviewRating> = {
  left: 1,
  down: 2,
  right: 3,
  up: 4,
};

export const RATING_TO_DIRECTION: Record<ReviewRating, SwipeDirection> = {
  1: 'left',
  2: 'down',
  3: 'right',
  4: 'up',
};

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export interface SwipeCommitInput {
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
  threshold?: number;
  velocityThreshold?: number;
  verticalEnabled: boolean;
  canRate: boolean;
}

export interface SwipeCommitDecision {
  shouldCommit: boolean;
  direction: SwipeDirection | null;
  rating: ReviewRating | null;
  lockedReason?: 'flip_required';
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Determine whether pointer movement exceeded tap-vs-drag threshold (~6px).
 */
export function isDragPastSlop(dx: number, dy: number, slopPx = DEFAULT_DRAG_SLOP_PX): boolean {
  return Math.hypot(dx, dy) >= slopPx;
}

/**
 * Rotation = x / 20 degrees, clamped to ±15 degrees.
 */
export function computeDragRotation(offsetX: number, maxDeg = MAX_DRAG_ROTATION_DEG): number {
  if (!Number.isFinite(offsetX)) return 0;
  return Math.max(-maxDeg, Math.min(maxDeg, offsetX / 20));
}

/**
 * Resolve dominant drag direction from displacement and optional velocity fallback.
 */
export function resolveSwipeDirection(
  offsetX: number,
  offsetY: number,
  verticalEnabled: boolean,
  velocityX = 0,
  velocityY = 0
): SwipeDirection | null {
  const absX = Math.abs(offsetX);
  const absY = Math.abs(offsetY);
  const absVx = Math.abs(velocityX);
  const absVy = Math.abs(velocityY);

  if (!verticalEnabled) {
    if (absX === 0 && absVx === 0) return null;
    if (absX > 0) {
      if (absY > absX * 1.25 && absVx <= absVy) return null;
      return offsetX > 0 ? 'right' : 'left';
    }
    if (absVx > absVy) {
      return velocityX > 0 ? 'right' : 'left';
    }
    return null;
  }

  if (absX === 0 && absY === 0) {
    if (absVx === 0 && absVy === 0) return null;
    if (absVx >= absVy) {
      return velocityX > 0 ? 'right' : 'left';
    }
    return velocityY < 0 ? 'up' : 'down';
  }

  if (absX >= absY) {
    return offsetX >= 0 ? 'right' : 'left';
  }
  return offsetY < 0 ? 'up' : 'down';
}

/**
 * Compute proportional badge opacities (0 at 20px -> 1 at threshold) for the dominant axis.
 */
export function computeBadgeOpacities(
  offsetX: number,
  offsetY: number,
  threshold = DEFAULT_SWIPE_THRESHOLD_PX,
  verticalEnabled = true,
  fadeStartPx = BADGE_FADE_START_PX
): Record<SwipeDirection, number> {
  const result: Record<SwipeDirection, number> = {
    left: 0,
    right: 0,
    up: 0,
    down: 0,
  };

  const direction = resolveSwipeDirection(offsetX, offsetY, verticalEnabled);
  if (!direction) return result;

  const axisDistance =
    direction === 'left' || direction === 'right' ? Math.abs(offsetX) : Math.abs(offsetY);
  const denom = Math.max(1, threshold - fadeStartPx);
  result[direction] = clamp01((axisDistance - fadeStartPx) / denom);

  return result;
}

/**
 * Evaluate whether a released drag should commit a SM-2 rating or spring back to center.
 * Commit threshold: |offset| > threshold (default 100px) OR |velocity| > 500 px/s in dominant direction.
 */
export function evaluateSwipeCommit(input: SwipeCommitInput): SwipeCommitDecision {
  const threshold = input.threshold ?? DEFAULT_SWIPE_THRESHOLD_PX;
  const velocityThreshold = input.velocityThreshold ?? DEFAULT_VELOCITY_THRESHOLD_PX_S;

  const direction = resolveSwipeDirection(
    input.offsetX,
    input.offsetY,
    input.verticalEnabled,
    input.velocityX,
    input.velocityY
  );

  if (!direction) {
    return { shouldCommit: false, direction: null, rating: null };
  }

  const dominantOffset =
    direction === 'left' || direction === 'right'
      ? Math.abs(input.offsetX)
      : Math.abs(input.offsetY);
  const dominantVelocity =
    direction === 'left' || direction === 'right'
      ? Math.abs(input.velocityX)
      : Math.abs(input.velocityY);

  const passesDistance = dominantOffset > threshold;
  const passesVelocity = dominantVelocity > velocityThreshold;

  if (!passesDistance && !passesVelocity) {
    return { shouldCommit: false, direction: null, rating: null };
  }

  if (!input.canRate) {
    return {
      shouldCommit: false,
      direction,
      rating: null,
      lockedReason: 'flip_required',
    };
  }

  return {
    shouldCommit: true,
    direction,
    rating: DIRECTION_TO_RATING[direction],
  };
}

/**
 * Calculate release velocity (px/s) from recent pointer trajectory samples.
 */
export function computeVelocityPxPerSec(samples: ReadonlyArray<PointerSample>): {
  vx: number;
  vy: number;
} {
  if (samples.length < 2) return { vx: 0, vy: 0 };

  const last = samples[samples.length - 1];
  let anchor = samples[0];

  for (let i = samples.length - 2; i >= 0; i--) {
    anchor = samples[i];
    if (last.t - anchor.t >= 35) break;
  }

  const dtMs = last.t - anchor.t;
  if (dtMs < 8) return { vx: 0, vy: 0 };

  return {
    vx: ((last.x - anchor.x) / dtMs) * 1000,
    vy: ((last.y - anchor.y) / dtMs) * 1000,
  };
}

/**
 * Compute off-screen fly-out target coordinates and continuing exit rotation.
 */
export function computeFlyOutVector(
  direction: SwipeDirection,
  viewportWidth = 800,
  viewportHeight = 800,
  currentX = 0,
  currentY = 0
): { targetX: number; targetY: number; extraRotateDeg: number } {
  const safeW = Math.max(420, viewportWidth);
  const safeH = Math.max(420, viewportHeight);

  switch (direction) {
    case 'left':
      return {
        targetX: -(safeW + 260),
        targetY: Math.max(-180, Math.min(180, currentY * 1.4)),
        extraRotateDeg: -10,
      };
    case 'right':
      return {
        targetX: safeW + 260,
        targetY: Math.max(-180, Math.min(180, currentY * 1.4)),
        extraRotateDeg: 10,
      };
    case 'up':
      return {
        targetX: Math.max(-160, Math.min(160, currentX * 1.2)),
        targetY: -(safeH + 260),
        extraRotateDeg: currentX >= 0 ? 4 : -4,
      };
    case 'down':
      return {
        targetX: Math.max(-160, Math.min(160, currentX * 1.2)),
        targetY: safeH + 260,
        extraRotateDeg: currentX >= 0 ? 4 : -4,
      };
  }
}
