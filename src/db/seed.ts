import { db, DEFAULT_SETTINGS } from '@/db';
import { createInitialSRSFields } from '@/features/srs/sm2';
import type { Card, Deck, JapaneseWordType, VerbForms } from '@/types';

export const SAMPLE_DECK_ID = 'deck_essential_en_vi';
export const SAMPLE_JA_DECK_ID = 'deck_essential_ja_vi';

interface SeedWord {
  term: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  notes: string;
  tags: string[];
}

interface SeedJapaneseWord {
  kana: string;
  romaji: string;
  kanji?: string;
  meaning: string;
  wordType: JapaneseWordType;
  lesson: number;
  example: string;
  exampleTranslation: string;
  notes: string;
  tags: string[];
  verbForms?: VerbForms;
}

export const SAMPLE_WORDS: SeedWord[] = [
  {
    term: 'resilient',
    meaning: 'kiên cường, mau phục hồi',
    phonetic: '/rɪˈzɪliənt/',
    partOfSpeech: 'adjective',
    example: 'Children are often remarkably resilient after setbacks.',
    exampleTranslation: 'Trẻ em thường có khả năng phục hồi đáng kinh ngạc sau vấp ngã.',
    notes: 'Commonly paired with "spirit", "economy", or "community".',
    tags: ['ielts', 'character'],
  },
  {
    term: 'ubiquitous',
    meaning: 'có mặt ở khắp nơi, phổ biến',
    phonetic: '/juːˈbɪkwɪtəs/',
    partOfSpeech: 'adjective',
    example: 'Smartphones have become ubiquitous in modern daily life.',
    exampleTranslation:
      'Điện thoại thông minh đã trở nên phổ biến khắp nơi trong đời sống hiện đại.',
    notes: 'Formal synonym of "everywhere".',
    tags: ['academic', 'technology'],
  },
  {
    term: 'eloquent',
    meaning: 'hùng biện, lưu loát, truyền cảm',
    phonetic: '/ˈeləkwənt/',
    partOfSpeech: 'adjective',
    example: 'She gave an eloquent speech about climate action.',
    exampleTranslation: 'Cô ấy đã có một bài phát biểu đầy truyền cảm về hành động khí hậu.',
    notes: 'Noun form: eloquence.',
    tags: ['communication', 'ielts'],
  },
  {
    term: 'ephemeral',
    meaning: 'phù du, ngắn ngủi, chóng tàn',
    phonetic: '/ɪˈfemərəl/',
    partOfSpeech: 'adjective',
    example: 'Fame on social media is often ephemeral.',
    exampleTranslation: 'Sự nổi tiếng trên mạng xã hội thường rất chóng tàn.',
    notes: 'Antonym: permanent, enduring.',
    tags: ['advanced', 'literature'],
  },
  {
    term: 'pragmatic',
    meaning: 'thực tế, thực dụng',
    phonetic: '/præɡˈmætɪk/',
    partOfSpeech: 'adjective',
    example: 'We need a pragmatic approach to solve this budget issue.',
    exampleTranslation:
      'Chúng ta cần một cách tiếp cận thực tế để giải quyết vấn đề ngân sách này.',
    notes: 'Focuses on practical results rather than theory.',
    tags: ['business', 'work'],
  },
  {
    term: 'meticulous',
    meaning: 'tỉ mỉ, kỹ lưỡng',
    phonetic: '/məˈtɪkjələs/',
    partOfSpeech: 'adjective',
    example: 'The watchmaker was meticulous about every tiny gear.',
    exampleTranslation: 'Người thợ đồng hồ rất tỉ mỉ với từng bánh răng nhỏ.',
    notes: 'Similar to thorough, scrupulous.',
    tags: ['work', 'character'],
  },
  {
    term: 'mitigate',
    meaning: 'giảm nhẹ, làm dịu bớt',
    phonetic: '/ˈmɪtɪɡeɪt/',
    partOfSpeech: 'verb',
    example: 'Planting trees helps mitigate the effects of urban heat.',
    exampleTranslation: 'Trồng cây giúp giảm nhẹ tác động của nhiệt độ đô thị.',
    notes: 'Often used with "risk", "damage", "impact".',
    tags: ['academic', 'environment'],
  },
  {
    term: 'catalyst',
    meaning: 'chất xúc tác, nhân tố thúc đẩy',
    phonetic: '/ˈkætəlɪst/',
    partOfSpeech: 'noun',
    example: 'The new library served as a catalyst for community learning.',
    exampleTranslation: 'Thư viện mới đóng vai trò là chất xúc tác cho việc học tập cộng đồng.',
    notes: 'Used both in chemistry and figuratively.',
    tags: ['science', 'business'],
  },
  {
    term: 'ambiguous',
    meaning: 'mơ hồ, đa nghĩa, không rõ ràng',
    phonetic: '/æmˈbɪɡjuəs/',
    partOfSpeech: 'adjective',
    example: 'The contract contained several ambiguous clauses.',
    exampleTranslation: 'Bản hợp đồng chứa một vài điều khoản mơ hồ.',
    notes: 'Noun: ambiguity.',
    tags: ['academic', 'communication'],
  },
  {
    term: 'serendipity',
    meaning: 'sự tình cờ may mắn',
    phonetic: '/ˌserənˈdɪpəti/',
    partOfSpeech: 'noun',
    example: 'Finding that rare book in a tiny alley shop was pure serendipity.',
    exampleTranslation:
      'Tìm thấy cuốn sách hiếm đó trong tiệm nhỏ trong hẻm là một sự tình cờ đầy may mắn.',
    notes: 'One of the most beloved English words.',
    tags: ['daily', 'literature'],
  },
  {
    term: 'procrastinate',
    meaning: 'trì hoãn, chần chừ',
    phonetic: '/prəˈkræstɪneɪt/',
    partOfSpeech: 'verb',
    example: 'I always procrastinate before writing long reports.',
    exampleTranslation: 'Tôi luôn trì hoãn trước khi viết các bản báo cáo dài.',
    notes: 'Break tasks into 5-minute chunks to avoid this!',
    tags: ['productivity', 'daily'],
  },
  {
    term: 'collaborate',
    meaning: 'hợp tác, cộng tác',
    phonetic: '/kəˈlæbəreɪt/',
    partOfSpeech: 'verb',
    example: 'Designers and engineers collaborate closely on every release.',
    exampleTranslation: 'Các nhà thiết kế và kỹ sư hợp tác chặt chẽ trong mỗi lần phát hành.',
    notes: 'Preposition: collaborate with someone on something.',
    tags: ['work', 'communication'],
  },
  {
    term: 'versatile',
    meaning: 'đa năng, linh hoạt',
    phonetic: '/ˈvɜːrsətəl/',
    partOfSpeech: 'adjective',
    example: 'Garlic is a versatile ingredient used in countless cuisines.',
    exampleTranslation: 'Tỏi là một nguyên liệu đa năng được dùng trong vô số nền ẩm thực.',
    notes: 'Can describe tools, skills, or people.',
    tags: ['daily', 'work'],
  },
  {
    term: 'empathy',
    meaning: 'sự đồng cảm, thấu cảm',
    phonetic: '/ˈempəθi/',
    partOfSpeech: 'noun',
    example: 'Good leadership begins with genuine empathy for your team.',
    exampleTranslation: 'Khả năng lãnh đạo tốt bắt đầu từ sự đồng cảm chân thành với đội ngũ.',
    notes: 'Different from sympathy (feeling sorry for vs. feeling with).',
    tags: ['character', 'communication'],
  },
  {
    term: 'inevitable',
    meaning: 'không thể tránh khỏi, tất yếu',
    phonetic: '/ɪnˈevɪtəbl/',
    partOfSpeech: 'adjective',
    example: 'With rapid urbanization, traffic changes became inevitable.',
    exampleTranslation:
      'Cùng với quá trình đô thị hóa nhanh, thay đổi giao thông trở thành điều tất yếu.',
    notes: 'Adverb: inevitably.',
    tags: ['ielts', 'academic'],
  },
  {
    term: 'coherent',
    meaning: 'mạch lạc, chặt chẽ, nhất quán',
    phonetic: '/kəʊˈhɪərənt/',
    partOfSpeech: 'adjective',
    example: 'She presented a clear and coherent argument.',
    exampleTranslation: 'Cô ấy trình bày một lập luận rõ ràng và mạch lạc.',
    notes: 'Key criterion in IELTS Writing & Speaking.',
    tags: ['ielts', 'communication'],
  },
  {
    term: 'persevere',
    meaning: 'kiên trì, bền bỉ vượt khó',
    phonetic: '/ˌpɜːrsəˈvɪr/',
    partOfSpeech: 'verb',
    example: 'Even when grammar felt difficult, he chose to persevere.',
    exampleTranslation: 'Ngay cả khi ngữ pháp có vẻ khó, anh ấy vẫn chọn kiên trì.',
    notes: 'Noun: perseverance.',
    tags: ['character', 'daily'],
  },
  {
    term: 'concise',
    meaning: 'súc tích, ngắn gọn mà đầy đủ',
    phonetic: '/kənˈsaɪs/',
    partOfSpeech: 'adjective',
    example: 'Keep your email concise so busy teammates can read it quickly.',
    exampleTranslation: 'Hãy giữ email ngắn gọn súc tích để đồng nghiệp bận rộn đọc nhanh được.',
    notes: 'Antonym: verbose, wordy.',
    tags: ['communication', 'work'],
  },
  {
    term: 'innovation',
    meaning: 'sự đổi mới, sáng tạo',
    phonetic: '/ˌɪnəˈveɪʃn/',
    partOfSpeech: 'noun',
    example: 'Continuous innovation keeps small startups competitive.',
    exampleTranslation:
      'Sự đổi mới liên tục giúp các công ty khởi nghiệp nhỏ giữ được sức cạnh tranh.',
    notes: 'Verb: innovate; Adjective: innovative.',
    tags: ['business', 'technology'],
  },
  {
    term: 'gratitude',
    meaning: 'lòng biết ơn',
    phonetic: '/ˈɡrætɪtjuːd/',
    partOfSpeech: 'noun',
    example: 'Practicing daily gratitude improves overall well-being.',
    exampleTranslation: 'Thực hành lòng biết ơn mỗi ngày giúp cải thiện sức khỏe tinh thần.',
    notes: 'Adjective: grateful.',
    tags: ['daily', 'character'],
  },
];

export const SAMPLE_JAPANESE_WORDS: SeedJapaneseWord[] = [
  {
    kana: 'おはよう',
    romaji: 'ohayou',
    meaning: 'chào buổi sáng',
    wordType: 'expression',
    lesson: 1,
    example: 'おはよう、きょうもげんきですね。',
    exampleTranslation: 'Chào buổi sáng, hôm nay bạn cũng khỏe nhỉ.',
    notes: 'Polite form: おはようございます.',
    tags: ['greeting', 'daily'],
  },
  {
    kana: 'ありがとう',
    romaji: 'arigatou',
    meaning: 'cảm ơn',
    wordType: 'expression',
    lesson: 1,
    example: 'いつもありがとうございます。',
    exampleTranslation: 'Luôn cảm ơn bạn rất nhiều.',
    notes: 'Polite form: ありがとうございます.',
    tags: ['greeting', 'daily'],
  },
  {
    kana: 'みず',
    romaji: 'mizu',
    kanji: '水',
    meaning: 'nước',
    wordType: 'noun',
    lesson: 1,
    example: 'つめたいみずをのみたいです。',
    exampleTranslation: 'Tôi muốn uống nước lạnh.',
    notes: 'Basic everyday noun.',
    tags: ['food', 'daily'],
  },
  {
    kana: 'ごはん',
    romaji: 'gohan',
    kanji: 'ご飯',
    meaning: 'cơm, bữa ăn',
    wordType: 'noun',
    lesson: 1,
    example: 'あさごはんをたべましたか。',
    exampleTranslation: 'Bạn đã ăn sáng chưa?',
    notes: 'Also used in あさごはん (breakfast), ひるごはん (lunch).',
    tags: ['food', 'daily'],
  },
  {
    kana: 'ともだち',
    romaji: 'tomodachi',
    kanji: '友達',
    meaning: 'bạn bè',
    wordType: 'noun',
    lesson: 1,
    example: 'ともだちとカフェへいきます。',
    exampleTranslation: 'Tôi đi quán cà phê cùng bạn.',
    notes: 'Common noun.',
    tags: ['people', 'daily'],
  },
  {
    kana: 'たべる',
    romaji: 'taberu',
    kanji: '食べる',
    meaning: 'ăn',
    wordType: 'verb',
    lesson: 2,
    example: 'まいにちりんごをたべます。',
    exampleTranslation: 'Mỗi ngày tôi đều ăn táo.',
    notes: 'Ichidan (Group 2) verb.',
    tags: ['verb', 'food'],
    verbForms: {
      masu: 'たべます',
      te: 'たべて',
      ta: 'たべた',
      nai: 'たべない',
    },
  },
  {
    kana: 'のむ',
    romaji: 'nomu',
    kanji: '飲む',
    meaning: 'uống',
    wordType: 'verb',
    lesson: 2,
    example: 'あさにおちゃをのみます。',
    exampleTranslation: 'Buổi sáng tôi uống trà.',
    notes: 'Godan (Group 1) verb.',
    tags: ['verb', 'food'],
    verbForms: {
      masu: 'のみます',
      te: 'のんで',
      ta: 'のんだ',
      nai: 'のまない',
    },
  },
  {
    kana: 'いく',
    romaji: 'iku',
    kanji: '行く',
    meaning: 'đi',
    wordType: 'verb',
    lesson: 2,
    example: 'あしたとしょかんへいきます。',
    exampleTranslation: 'Ngày mai tôi đi thư viện.',
    notes: 'Note irregular te/ta form: いって / いった.',
    tags: ['verb', 'travel'],
    verbForms: {
      masu: 'いきます',
      te: 'いって',
      ta: 'いった',
      nai: 'いかない',
    },
  },
  {
    kana: 'くる',
    romaji: 'kuru',
    kanji: '来る',
    meaning: 'đến',
    wordType: 'verb',
    lesson: 2,
    example: 'ともだちがいえにきます。',
    exampleTranslation: 'Bạn tôi sẽ đến nhà.',
    notes: 'Irregular verb.',
    tags: ['verb', 'travel'],
    verbForms: {
      masu: 'きます',
      te: 'きて',
      ta: 'きた',
      nai: 'こない',
    },
  },
  {
    kana: 'みる',
    romaji: 'miru',
    kanji: '見る',
    meaning: 'xem, nhìn',
    wordType: 'verb',
    lesson: 2,
    example: 'しゅうまつにえいがをみます。',
    exampleTranslation: 'Cuối tuần tôi xem phim.',
    notes: 'Ichidan (Group 2) verb.',
    tags: ['verb', 'daily'],
    verbForms: {
      masu: 'みます',
      te: 'みて',
      ta: 'みた',
      nai: 'みない',
    },
  },
  {
    kana: 'きく',
    romaji: 'kiku',
    kanji: '聞く',
    meaning: 'nghe, hỏi',
    wordType: 'verb',
    lesson: 3,
    example: 'おんがくをきくのがすきです。',
    exampleTranslation: 'Tôi thích nghe nhạc.',
    notes: 'Godan verb.',
    tags: ['verb', 'daily'],
    verbForms: {
      masu: 'ききます',
      te: 'きいて',
      ta: 'きいた',
      nai: 'きかない',
    },
  },
  {
    kana: 'よむ',
    romaji: 'yomu',
    kanji: '読む',
    meaning: 'đọc',
    wordType: 'verb',
    lesson: 3,
    example: 'よるにほんをよみます。',
    exampleTranslation: 'Buổi tối tôi đọc sách.',
    notes: 'Godan verb.',
    tags: ['verb', 'study'],
    verbForms: {
      masu: 'よみます',
      te: 'よんで',
      ta: 'よんだ',
      nai: 'よまない',
    },
  },
  {
    kana: 'かく',
    romaji: 'kaku',
    kanji: '書く',
    meaning: 'viết',
    wordType: 'verb',
    lesson: 3,
    example: 'ノートににっきをかきます。',
    exampleTranslation: 'Tôi viết nhật ký vào sổ tay.',
    notes: 'Godan verb.',
    tags: ['verb', 'study'],
    verbForms: {
      masu: 'かきます',
      te: 'かいて',
      ta: 'かいた',
      nai: 'かかない',
    },
  },
  {
    kana: 'はなす',
    romaji: 'hanasu',
    kanji: '話す',
    meaning: 'nói, trò chuyện',
    wordType: 'verb',
    lesson: 3,
    example: 'にほんごでゆっくりはなします。',
    exampleTranslation: 'Tôi nói chậm rãi bằng tiếng Nhật.',
    notes: 'Godan verb ending in -su.',
    tags: ['verb', 'communication'],
    verbForms: {
      masu: 'はなします',
      te: 'はなして',
      ta: 'はなした',
      nai: 'はなさない',
    },
  },
  {
    kana: 'おおきい',
    romaji: 'ookii',
    kanji: '大きい',
    meaning: 'to, lớn',
    wordType: 'i-adj',
    lesson: 3,
    example: 'あのこうえんはとてもおおきいです。',
    exampleTranslation: 'Công viên kia rất lớn.',
    notes: 'I-adjective with long vowel おお.',
    tags: ['adjective', 'daily'],
  },
  {
    kana: 'ちいさい',
    romaji: 'chiisai',
    kanji: '小さい',
    meaning: 'nhỏ, bé',
    wordType: 'i-adj',
    lesson: 4,
    example: 'ちいさいいぬがかわいいです。',
    exampleTranslation: 'Chú chó nhỏ thật dễ thương.',
    notes: 'Antonym of おおきい.',
    tags: ['adjective', 'daily'],
  },
  {
    kana: 'あたらしい',
    romaji: 'atarashii',
    kanji: '新しい',
    meaning: 'mới',
    wordType: 'i-adj',
    lesson: 4,
    example: 'あたらしいことばをおぼえます。',
    exampleTranslation: 'Tôi ghi nhớ từ vựng mới.',
    notes: 'I-adjective.',
    tags: ['adjective', 'study'],
  },
  {
    kana: 'げんき',
    romaji: 'genki',
    kanji: '元気',
    meaning: 'khỏe mạnh, tràn đầy năng lượng',
    wordType: 'na-adj',
    lesson: 4,
    example: 'げんきなこえであいさつします。',
    exampleTranslation: 'Chào hỏi bằng giọng nói tràn đầy năng lượng.',
    notes: 'Na-adjective.',
    tags: ['adjective', 'daily'],
  },
  {
    kana: 'しずか',
    romaji: 'shizuka',
    kanji: '静か',
    meaning: 'yên tĩnh',
    wordType: 'na-adj',
    lesson: 4,
    example: 'このへやはしずかです。',
    exampleTranslation: 'Căn phòng này yên tĩnh.',
    notes: 'Na-adjective.',
    tags: ['adjective', 'daily'],
  },
  {
    kana: 'コーヒー',
    romaji: 'koohii',
    meaning: 'cà phê',
    wordType: 'noun',
    lesson: 4,
    example: 'あついコーヒーをください。',
    exampleTranslation: 'Cho tôi một ly cà phê nóng.',
    notes: 'Katakana loanword with long vowels (ー).',
    tags: ['katakana', 'food'],
  },
];

export function buildJapaneseSampleCards(now = Date.now()): Card[] {
  return SAMPLE_JAPANESE_WORDS.map((word, index) => ({
    id: `card_ja_seed_${index + 1}`,
    deckId: SAMPLE_JA_DECK_ID,
    term: word.kana,
    meaning: word.meaning,
    phonetic: word.romaji,
    partOfSpeech: word.wordType,
    example: word.example,
    exampleTranslation: word.exampleTranslation,
    notes: word.notes,
    imageUrl: '',
    tags: word.tags,
    kana: word.kana,
    romaji: word.romaji,
    kanji: word.kanji,
    wordType: word.wordType,
    lesson: word.lesson,
    verbForms: word.verbForms,
    ...createInitialSRSFields(now + index),
    createdAt: now + index,
    updatedAt: now + index,
  }));
}

export async function seedJapaneseSampleDeck(): Promise<boolean> {
  const existing = await db.decks.get(SAMPLE_JA_DECK_ID);
  if (existing) return false;

  const now = Date.now();
  const jaDeck: Deck = {
    id: SAMPLE_JA_DECK_ID,
    name: 'Beginner Japanese → Vietnamese',
    description:
      '20 everyday Japanese words across Lessons 1–4 with kana, romaji, optional kanji, and verb conjugations.',
    color: '#ec4899',
    emoji: '🇯🇵',
    language: 'ja',
    tags: ['japanese', 'vietnamese', 'starter'],
    createdAt: now,
    updatedAt: now,
  };

  const jaCards = buildJapaneseSampleCards(now);
  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.put(jaDeck);
    await db.cards.bulkPut(jaCards);
  });
  return true;
}

export async function seedDatabaseIfEmpty(): Promise<boolean> {
  const existingSettings = await db.settings.get('default');
  if (!existingSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  const deckCount = await db.decks.count();
  if (deckCount > 0) {
    return false;
  }

  const now = Date.now();
  const sampleDeck: Deck = {
    id: SAMPLE_DECK_ID,
    name: 'Essential English → Vietnamese',
    description:
      '20 high-frequency, expressive English words with IPA phonetics, Vietnamese meanings, and natural examples.',
    color: '#4f46e5',
    emoji: '📘',
    language: 'en',
    tags: ['english', 'vietnamese', 'starter'],
    createdAt: now,
    updatedAt: now,
  };

  const sampleCards: Card[] = SAMPLE_WORDS.map((word, index) => ({
    id: `card_seed_${index + 1}`,
    deckId: SAMPLE_DECK_ID,
    term: word.term,
    meaning: word.meaning,
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    example: word.example,
    exampleTranslation: word.exampleTranslation,
    notes: word.notes,
    imageUrl: '',
    tags: word.tags,
    ...createInitialSRSFields(now + index),
    createdAt: now + index,
    updatedAt: now + index,
  }));

  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.decks.put(sampleDeck);
    await db.cards.bulkPut(sampleCards);
  });

  await seedJapaneseSampleDeck();
  return true;
}
