import type { BadgeDefinition, ReviewLog, ReviewRating, StudyMode } from '@/types';
import { DAY_MS } from '@/features/srs/sm2';
import { formatDateKey, startOfDayMs } from '@/lib/utils';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_review',
    icon: '🌱',
    titleKey: 'badges.firstReview.title',
    descriptionKey: 'badges.firstReview.desc',
  },
  {
    id: 'streak_3',
    icon: '🔥',
    titleKey: 'badges.streak3.title',
    descriptionKey: 'badges.streak3.desc',
  },
  {
    id: 'streak_7',
    icon: '⚡',
    titleKey: 'badges.streak7.title',
    descriptionKey: 'badges.streak7.desc',
  },
  {
    id: 'reviews_100',
    icon: '💯',
    titleKey: 'badges.reviews100.title',
    descriptionKey: 'badges.reviews100.desc',
  },
  {
    id: 'polyglot_modes',
    icon: '🎯',
    titleKey: 'badges.polyglotModes.title',
    descriptionKey: 'badges.polyglotModes.desc',
  },
  {
    id: 'sharp_ear',
    icon: '🎧',
    titleKey: 'badges.sharpEar.title',
    descriptionKey: 'badges.sharpEar.desc',
  },
  {
    id: 'speed_matcher',
    icon: '⏱️',
    titleKey: 'badges.speedMatcher.title',
    descriptionKey: 'badges.speedMatcher.desc',
  },
];

export function calculateXPForReview(rating: ReviewRating, mode: StudyMode): number {
  const base = rating === 1 ? 5 : rating === 2 ? 10 : rating === 3 ? 15 : 20;
  const modeBonus = mode === 'typing' || mode === 'listen' ? 5 : 0;
  return base + modeBonus;
}

export function calculateStreak(logs: ReviewLog[], now: number = Date.now()): number {
  if (logs.length === 0) return 0;

  const activeDays = new Set<string>();
  for (const log of logs) {
    activeDays.add(formatDateKey(log.reviewedAt));
  }

  const todayStart = startOfDayMs(now);
  const todayKey = formatDateKey(todayStart);
  const yesterdayKey = formatDateKey(todayStart - DAY_MS);

  // Streak is active if user studied today or yesterday
  let cursor = activeDays.has(todayKey)
    ? todayStart
    : activeDays.has(yesterdayKey)
      ? todayStart - DAY_MS
      : -1;

  if (cursor === -1) return 0;

  let streak = 0;
  while (activeDays.has(formatDateKey(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

export function evaluateUnlockedBadges(
  logs: ReviewLog[],
  currentlyUnlocked: string[],
  now: number = Date.now()
): string[] {
  const set = new Set(currentlyUnlocked);
  const streak = calculateStreak(logs, now);
  const modesUsed = new Set(logs.map((l) => l.mode));
  const listenCount = logs.filter((l) => l.mode === 'listen' && l.correct).length;
  const matchCount = logs.filter((l) => l.mode === 'match' && l.correct).length;

  if (logs.length >= 1) set.add('first_review');
  if (streak >= 3) set.add('streak_3');
  if (streak >= 7) set.add('streak_7');
  if (logs.length >= 100) set.add('reviews_100');
  if (modesUsed.size >= 5) set.add('polyglot_modes');
  if (listenCount >= 10) set.add('sharp_ear');
  if (matchCount >= 12) set.add('speed_matcher');

  return Array.from(set);
}
