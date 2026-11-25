import { z } from 'zod';
import {
  CHUNK_SIZE,
  normalizeTags,
  normalizeWordTypeValue,
  parseLessonValue,
  sanitizeCell,
  yieldToMain,
} from './normalize';
import type { DeckLanguage, VerbForms } from '@/types';
import type { ParsedCardRow, PasteParseError } from './types';

export interface ParseJsonOutput {
  rows: ParsedCardRow[];
  suggestedDeckName?: string;
  suggestedLanguage?: DeckLanguage;
  parseErrors: PasteParseError[];
}

const VerbFormsSchema = z
  .object({
    masu: z.string().optional(),
    te: z.string().optional(),
    ta: z.string().optional(),
    nai: z.string().optional(),
  })
  .optional();

const JsonCardSchema = z
  .object({
    term: z.string().optional(),
    meaning: z.string().optional(),
    kana: z.string().optional(),
    romaji: z.string().optional(),
    kanji: z.string().optional(),
    phonetic: z.string().optional(),
    partOfSpeech: z.string().optional(),
    wordType: z.string().optional(),
    lesson: z.union([z.number(), z.string()]).optional(),
    example: z.string().optional(),
    exampleTranslation: z.string().optional(),
    translation: z.string().optional(),
    notes: z.string().optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    verbForms: VerbFormsSchema,
  })
  .passthrough()
  .superRefine((card, ctx) => {
    const cleanTerm = sanitizeCell(card.term ?? '');
    const cleanKana = sanitizeCell(card.kana ?? '');
    const cleanMeaning = sanitizeCell(card.meaning ?? '');
    if (!cleanTerm && !cleanKana) {
      ctx.addIssue({
        code: 'custom',
        path: ['term'],
        message: 'term is required',
      });
    }
    if (!cleanMeaning) {
      ctx.addIssue({
        code: 'custom',
        path: ['meaning'],
        message: 'meaning is required',
      });
    }
  });

const JsonDeckObjectSchema = z
  .object({
    name: z.string().optional(),
    language: z.enum(['en', 'ja']).optional(),
    decks: z
      .array(
        z
          .object({
            name: z.string().optional(),
            language: z.enum(['en', 'ja']).optional(),
          })
          .passthrough()
      )
      .optional(),
    cards: z.array(JsonCardSchema),
  })
  .passthrough();

const JsonPayloadSchema = z.union([z.array(JsonCardSchema), JsonDeckObjectSchema]);

function formatZodPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'root';
  let result = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else if (typeof segment === 'string') {
      result += result ? `.${segment}` : segment;
    } else {
      result += result ? `.${String(segment)}` : String(segment);
    }
  }
  return result;
}

/**
 * Parse and validate pasted JSON payload (card array OR deck object / full backup cards).
 */
export async function parseJson(
  rawText: string,
  options?: { onProgress?: (progress: number) => void }
): Promise<ParseJsonOutput> {
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(rawText);
  } catch (err) {
    return {
      rows: [],
      parseErrors: [
        {
          path: 'json',
          message:
            err instanceof Error ? `Invalid JSON syntax: ${err.message}` : 'Invalid JSON syntax',
        },
      ],
    };
  }

  const validation = JsonPayloadSchema.safeParse(rawParsed);
  if (!validation.success) {
    const isArrayRoot = Array.isArray(rawParsed);
    // In union schemas, inspect unionErrors if top-level reports invalid_union
    const errors: PasteParseError[] = [];
    for (const issue of validation.error.issues) {
      if (issue.code === 'invalid_union' && 'errors' in issue && Array.isArray(issue.errors)) {
        const unionBranches = issue.errors as Array<
          Array<{ path: PropertyKey[]; message: string }>
        >;
        const targetBranch = isArrayRoot ? unionBranches[0] : unionBranches[1];
        const chosen = targetBranch ?? unionBranches[0] ?? [];
        for (const subIssue of chosen) {
          const pathStr = formatZodPath(subIssue.path);
          const msg = subIssue.message.startsWith(pathStr)
            ? subIssue.message
            : `${pathStr} ${subIssue.message}`.replace(/\.?\s+(is required)/, ' $1');
          errors.push({ path: pathStr, message: msg });
        }
      } else {
        const pathStr = formatZodPath(issue.path);
        const msg = `${pathStr}: ${issue.message}`;
        errors.push({ path: pathStr, message: msg });
      }
    }

    // Deduplicate identical messages while preserving order
    const seen = new Set<string>();
    const uniqueErrors = errors.filter((e) => {
      const key = `${e.path ?? ''}|${e.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      rows: [],
      parseErrors: uniqueErrors.length > 0 ? uniqueErrors : [{ message: 'Invalid JSON payload' }],
    };
  }

  const data = validation.data;
  const rawCards = Array.isArray(data) ? data : data.cards;
  const suggestedDeckName = Array.isArray(data)
    ? undefined
    : sanitizeCell(data.name ?? data.decks?.[0]?.name ?? '') || undefined;
  const suggestedLanguage = Array.isArray(data)
    ? undefined
    : (data.language ?? data.decks?.[0]?.language);

  const rows: ParsedCardRow[] = [];
  const total = rawCards.length;

  for (let i = 0; i < total; i++) {
    const c = rawCards[i];
    const cleanTerm = sanitizeCell(c.term ?? '');
    const cleanKana = sanitizeCell(c.kana ?? '');
    const cleanKanji = sanitizeCell(c.kanji ?? '');
    const verbForms: VerbForms | undefined = c.verbForms
      ? {
          masu: sanitizeCell(c.verbForms.masu ?? '') || undefined,
          te: sanitizeCell(c.verbForms.te ?? '') || undefined,
          ta: sanitizeCell(c.verbForms.ta ?? '') || undefined,
          nai: sanitizeCell(c.verbForms.nai ?? '') || undefined,
        }
      : undefined;

    rows.push({
      rowId: `row_${i + 1}`,
      rowIndex: i + 1,
      term: cleanTerm || cleanKana,
      meaning: sanitizeCell(c.meaning ?? ''),
      kana: cleanKana,
      romaji: sanitizeCell(c.romaji ?? ''),
      kanji: cleanKanji,
      phonetic: sanitizeCell(c.phonetic ?? ''),
      partOfSpeech: sanitizeCell(c.partOfSpeech ?? ''),
      wordType: normalizeWordTypeValue(c.wordType),
      lesson: parseLessonValue(c.lesson),
      example: sanitizeCell(c.example ?? ''),
      exampleTranslation: sanitizeCell(c.exampleTranslation ?? c.translation ?? ''),
      notes: sanitizeCell(c.notes ?? ''),
      tags: normalizeTags(c.tags),
      verbForms,
      issues: [],
      isDuplicateInPaste: false,
      isDuplicateInDeck: false,
      hasError: false,
    });

    if ((i + 1) % CHUNK_SIZE === 0) {
      options?.onProgress?.(Math.min(0.95, (i + 1) / Math.max(1, total)));
      await yieldToMain();
    }
  }

  options?.onProgress?.(1);
  return {
    rows,
    suggestedDeckName,
    suggestedLanguage,
    parseErrors: [],
  };
}
