import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function startOfDayMs(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function formatDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[n];
}

export function isTolerantMatch(
  userInput: string,
  expected: string
): { isMatch: boolean; isExact: boolean; distance: number } {
  const cleanInput = normalizeText(userInput);
  // Support multiple meanings separated by / or ; or ,
  const candidates = expected
    .split(/[;/]/)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (candidates.length === 0) {
    return { isMatch: false, isExact: false, distance: cleanInput.length };
  }

  let bestDistance = Infinity;
  for (const target of candidates) {
    if (cleanInput === target) {
      return { isMatch: true, isExact: true, distance: 0 };
    }
    const dist = levenshteinDistance(cleanInput, target);
    if (dist < bestDistance) bestDistance = dist;

    const maxAllowed = target.length <= 4 ? 0 : target.length <= 8 ? 1 : 2;
    if (dist <= maxAllowed && cleanInput.length > 0) {
      return { isMatch: true, isExact: false, distance: dist };
    }
  }

  return { isMatch: false, isExact: false, distance: bestDistance };
}
