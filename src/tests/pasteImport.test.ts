import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import {
  detectFormat,
  detectLineSeparator,
  parsePastedContent,
  saveImportedDeckOrCards,
  swapAllRows,
  undoImport,
} from '@/lib/import';

async function resetTestDb() {
  await db.transaction('rw', [db.decks, db.cards, db.reviewLogs, db.importHistory], async () => {
    await db.decks.clear();
    await db.cards.clear();
    await db.reviewLogs.clear();
    await db.importHistory.clear();
  });
}

describe('Quick Import by Paste - format detection and parsers', () => {
  it('auto-detects supported formats', () => {
    expect(detectFormat('たべます - ăn\nのみます - uống')).toBe('lines');
    expect(detectFormat('term,meaning,lesson\napple,táo,1')).toBe('csv');
    expect(detectFormat('term\tmeaning\tlesson\napple\ttáo\t1')).toBe('tsv');
    expect(detectFormat('[{"term":"apple","meaning":"táo"}]')).toBe('json');
    expect(detectFormat('#separator:tab\n#html:true\nたべる\tăn')).toBe('anki');
    expect(detectFormat('| term | meaning |\n| --- | --- |\n| apple | táo |')).toBe('markdown');
  });

  it('splits simple lines only on the FIRST detected separator (edge case with hyphens & commas)', async () => {
    const dashText = `up-to-date - cập nhật - phiên bản mới nhất
part-time - bán thời gian - ngoài giờ`;
    expect(detectLineSeparator(dashText.split('\n'))).toBe(' - ');

    const dashRes = await parsePastedContent(dashText);
    expect(dashRes.detectedFormat).toBe('lines');
    expect(dashRes.rows).toHaveLength(2);
    expect(dashRes.rows[0].term).toBe('up-to-date');
    expect(dashRes.rows[0].meaning).toBe('cập nhật - phiên bản mới nhất');

    const commaText = `resilient, kiên cường, bền bỉ
pragmatic, thực tế, hiệu quả`;
    const commaRes = await parsePastedContent(commaText);
    expect(commaRes.detectedSeparator).toBe(',');
    expect(commaRes.rows[0].term).toBe('resilient');
    expect(commaRes.rows[0].meaning).toBe('kiên cường, bền bỉ');
  });

  it('handles Unicode NFC normalization, full-width spaces/punctuation, empty lines, and # deck header', async () => {
    // Uses NFD decomposed 'e' + circumflex 'e\u0302' and full-width colon '：' + ideographic space '\u3000'
    const text = `# Minna\u3000Bài 28\n\n  te\u0302n：nhận xét  \n\n  tuổi\u3000：\u3000năm sinh `;
    const res = await parsePastedContent(text);
    expect(res.suggestedDeckName).toBe('Minna Bài 28');
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].term).toBe('tên');
    expect(res.rows[0].meaning).toBe('nhận xét');
    expect(res.rows[1].term).toBe('tuổi');
    expect(res.rows[1].meaning).toBe('năm sinh');
  });

  it('parses CSV with quoted commas, escaped quotes, and multi-line cells', async () => {
    const csv = [
      'term,meaning,kana,romaji,kanji,example,translation,wordType,lesson,tags',
      '"apple, red","táo đỏ, ""giòn""\ndòng hai",,,,"Say ""hello""","Nói ""xin chào""",noun,2,"fruit, daily"',
    ].join('\n');

    const res = await parsePastedContent(csv);
    expect(res.detectedFormat).toBe('csv');
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.term).toBe('apple, red');
    expect(row.meaning).toBe('táo đỏ, "giòn"\ndòng hai');
    expect(row.example).toBe('Say "hello"');
    expect(row.exampleTranslation).toBe('Nói "xin chào"');
    expect(row.lesson).toBe(2);
    expect(row.tags).toEqual(['fruit', 'daily']);
  });

  it('parses Anki plain text with #separator:tab, strips HTML tags safely, converts <br> to newline, decodes entities', async () => {
    const anki = [
      '#separator:tab',
      '#html:true',
      '#deck:Anki Japanese Deck',
      '<b>たべます</b>\tăn<br><i>dùng bữa</i> &amp; thưởng thức\t<div>毎朝&nbsp;食べます</div><script>alert(1)</script>',
    ].join('\n');

    const res = await parsePastedContent(anki);
    expect(res.detectedFormat).toBe('anki');
    expect(res.suggestedDeckName).toBe('Anki Japanese Deck');
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.kana).toBe('たべます');
    expect(row.romaji).toBe('tabemasu');
    expect(row.meaning).toBe('ăn\ndùng bữa & thưởng thức');
    expect(row.example).toBe('毎朝 食べます');
    expect(row.example).not.toContain('alert(1)');
    expect(row.example).not.toContain('<');
  });

  it('parses Markdown tables and ignores divider rows', async () => {
    const md = `| kana | kanji | meaning |
| --- | --- | --- |
| みず | 水 | nước |
| ほん | 本 | sách |`;
    const res = await parsePastedContent(md);
    expect(res.detectedFormat).toBe('markdown');
    expect(res.detectedLanguage).toBe('ja');
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].kana).toBe('みず');
    expect(res.rows[0].kanji).toBe('水');
    expect(res.rows[0].romaji).toBe('mizu');
  });

  it('validates JSON with zod and reports exact path errors such as cards[3].meaning', async () => {
    const badJson = JSON.stringify({
      name: 'Broken Deck',
      language: 'en',
      cards: [
        { term: 'one', meaning: 'một' },
        { term: 'two', meaning: 'hai' },
        { term: 'three', meaning: 'ba' },
        { term: 'four' },
      ],
    });

    const badRes = await parsePastedContent(badJson);
    expect(badRes.detectedFormat).toBe('json');
    expect(badRes.parseErrors.length).toBeGreaterThan(0);
    expect(badRes.parseErrors.some((e) => e.message.includes('cards[3].meaning'))).toBe(true);

    const goodJson = JSON.stringify([
      { kana: 'たべる', kanji: '食べる', meaning: 'ăn', lesson: 'Bài 6', tags: ['verb'] },
    ]);
    const goodRes = await parsePastedContent(goodJson);
    expect(goodRes.parseErrors).toHaveLength(0);
    expect(goodRes.detectedLanguage).toBe('ja');
    expect(goodRes.rows[0].romaji).toBe('taberu');
    expect(goodRes.rows[0].lesson).toBe(6);
  });

  it('supports smart Japanese enrichment (romaji->kana, auto romaji, kanji preservation & missing kana warning) and swapAll', async () => {
    const text = `たべます - ăn
taberu - ăn cơm
食べる - ăn uống`;
    const res = await parsePastedContent(text, {
      languageOverride: 'ja',
      batchLesson: 28,
      batchTags: ['minna'],
    });

    expect(res.rows[0].kana).toBe('たべます');
    expect(res.rows[0].romaji).toBe('tabemasu');
    expect(res.rows[0].lesson).toBe(28);
    expect(res.rows[0].tags).toEqual(['minna']);

    // Romaji-only converted to hiragana
    expect(res.rows[1].kana).toBe('たべる');
    expect(res.rows[1].romaji).toBe('taberu');

    // Kanji without kana triggers warning while keeping kanji populated
    expect(res.rows[2].kanji).toBe('食べる');
    expect(res.rows[2].kana).toBe('');
    expect(res.rows[2].issues.some((i) => i.code === 'missing_kana_for_kanji')).toBe(true);

    const swapped = swapAllRows(res.rows);
    expect(swapped[0].term).toBe('ăn');
    expect(swapped[0].meaning).toBe('たべます');
  });

  it('flags intra-paste duplicates, existing deck duplicates, and errors cleanly', async () => {
    const res = await parsePastedContent('hello - xin chào\nhello - chào lại\nbadline', {
      existingCards: [{ id: 'existing-1', term: 'hello' }],
    });

    expect(res.totals.total).toBe(3);
    expect(res.totals.errors).toBe(1);
    expect(res.totals.valid).toBe(2);
    expect(res.totals.inDeckDuplicates).toBe(2);
    expect(res.totals.inPasteDuplicates).toBe(1);
  });

  it('parses 5,000 rows in chunks with progress callbacks', async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `word${i} - nghĩa ${i}`).join('\n');
    const progressValues: number[] = [];
    const res = await parsePastedContent(lines, {
      onProgress: (p) => progressValues.push(p),
    });

    expect(res.rows).toHaveLength(5000);
    expect(res.totals.valid).toBe(5000);
    expect(progressValues.length).toBeGreaterThan(2);
    expect(progressValues[progressValues.length - 1]).toBe(1);
  });
});

describe('Quick Import by Paste - IndexedDB transaction, rollback, and undo', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('imports into a new deck with SM-2 defaults and undoes cleanly (removing created cards and deck)', async () => {
    const parsed = await parsePastedContent('# Minna Bài 1\nみず - nước\nほん - sách');
    const saved = await saveImportedDeckOrCards({
      rows: parsed.rows,
      format: parsed.detectedFormat,
      duplicateStrategy: 'skip',
      target: {
        mode: 'new',
        name: parsed.suggestedDeckName ?? 'New Deck',
        emoji: '🇯🇵',
        color: '#4f46e5',
        language: 'ja',
      },
    });

    expect(saved.importedCount).toBe(2);
    const storedCards = await db.cards.where('deckId').equals(saved.deck.id).toArray();
    expect(storedCards).toHaveLength(2);
    expect(storedCards[0].status).toBe('new');
    expect(storedCards[0].repetitions).toBe(0);

    const undone = await undoImport(saved.historyEntry.id);
    expect(undone.undone).toBe(true);
    expect(undone.deletedCards).toBe(2);
    expect(undone.deletedDeck).toBe(true);

    expect(await db.cards.count()).toBe(0);
    expect(await db.decks.count()).toBe(0);
  });

  it('overwrites existing duplicates in a deck and restores originals on undo', async () => {
    const initialParsed = await parsePastedContent('apple - quả táo\nbook - quyển sách');
    const initialSave = await saveImportedDeckOrCards({
      rows: initialParsed.rows,
      format: 'lines',
      duplicateStrategy: 'skip',
      target: {
        mode: 'new',
        name: 'Existing Deck',
        emoji: '📘',
        color: '#4f46e5',
        language: 'en',
      },
    });

    const existingCards = await db.cards.where('deckId').equals(initialSave.deck.id).toArray();
    const secondParsed = await parsePastedContent('apple - trái táo đỏ\ncherry - quả anh đào', {
      existingCards,
    });

    const secondSave = await saveImportedDeckOrCards({
      rows: secondParsed.rows,
      format: 'lines',
      duplicateStrategy: 'overwrite',
      target: {
        mode: 'existing',
        deckId: initialSave.deck.id,
      },
    });

    expect(secondSave.updatedCount).toBe(1);
    expect(secondSave.importedCount).toBe(1);

    const afterOverwrite = await db.cards.where('deckId').equals(initialSave.deck.id).toArray();
    expect(afterOverwrite).toHaveLength(3);
    expect(afterOverwrite.find((c) => c.term === 'apple')?.meaning).toBe('trái táo đỏ');

    const undone = await undoImport(secondSave.historyEntry.id);
    expect(undone.undone).toBe(true);
    expect(undone.deletedCards).toBe(1);
    expect(undone.restoredCards).toBe(1);
    expect(undone.deletedDeck).toBe(false);

    const afterUndo = await db.cards.where('deckId').equals(initialSave.deck.id).toArray();
    expect(afterUndo).toHaveLength(2);
    expect(afterUndo.find((c) => c.term === 'apple')?.meaning).toBe('quả táo');
  });

  it('rolls back entire transaction atomically if an error occurs mid-import', async () => {
    const parsed = await parsePastedContent('one - một\ntwo - hai');

    await expect(
      saveImportedDeckOrCards({
        rows: parsed.rows,
        format: 'lines',
        duplicateStrategy: 'skip',
        target: {
          mode: 'new',
          name: 'Rollback Deck',
          emoji: '📘',
          color: '#4f46e5',
          language: 'en',
        },
        __simulateFailureBeforeCommit: true,
      })
    ).rejects.toThrow();

    expect(await db.decks.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
    expect(await db.importHistory.count()).toBe(0);
  });
});
