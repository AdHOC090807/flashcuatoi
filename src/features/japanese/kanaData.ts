export type KanaScript = 'hiragana' | 'katakana';
export type KanaRowGroup = 'basic' | 'dakuten' | 'handakuten' | 'yoon';

export interface KanaItem {
  id: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  group: KanaRowGroup;
  row: string;
}

export const KANA_ROWS: Array<{
  row: string;
  group: KanaRowGroup;
  items: Array<{ h: string; k: string; r: string }>;
}> = [
  // Basic (Seion)
  {
    row: 'a',
    group: 'basic',
    items: [
      { h: 'あ', k: 'ア', r: 'a' },
      { h: 'い', k: 'イ', r: 'i' },
      { h: 'う', k: 'ウ', r: 'u' },
      { h: 'え', k: 'エ', r: 'e' },
      { h: 'お', k: 'オ', r: 'o' },
    ],
  },
  {
    row: 'ka',
    group: 'basic',
    items: [
      { h: 'か', k: 'カ', r: 'ka' },
      { h: 'き', k: 'キ', r: 'ki' },
      { h: 'く', k: 'ク', r: 'ku' },
      { h: 'け', k: 'ケ', r: 'ke' },
      { h: 'こ', k: 'コ', r: 'ko' },
    ],
  },
  {
    row: 'sa',
    group: 'basic',
    items: [
      { h: 'さ', k: 'サ', r: 'sa' },
      { h: 'し', k: 'シ', r: 'shi' },
      { h: 'す', k: 'ス', r: 'su' },
      { h: 'せ', k: 'セ', r: 'se' },
      { h: 'そ', k: 'ソ', r: 'so' },
    ],
  },
  {
    row: 'ta',
    group: 'basic',
    items: [
      { h: 'た', k: 'タ', r: 'ta' },
      { h: 'ち', k: 'チ', r: 'chi' },
      { h: 'つ', k: 'ツ', r: 'tsu' },
      { h: 'て', k: 'テ', r: 'te' },
      { h: 'と', k: 'ト', r: 'to' },
    ],
  },
  {
    row: 'na',
    group: 'basic',
    items: [
      { h: 'な', k: 'ナ', r: 'na' },
      { h: 'に', k: 'ニ', r: 'ni' },
      { h: 'ぬ', k: 'ヌ', r: 'nu' },
      { h: 'ね', k: 'ネ', r: 'ne' },
      { h: 'の', k: 'ノ', r: 'no' },
    ],
  },
  {
    row: 'ha',
    group: 'basic',
    items: [
      { h: 'は', k: 'ハ', r: 'ha' },
      { h: 'ひ', k: 'ヒ', r: 'hi' },
      { h: 'ふ', k: 'フ', r: 'fu' },
      { h: 'へ', k: 'ヘ', r: 'he' },
      { h: 'ほ', k: 'ホ', r: 'ho' },
    ],
  },
  {
    row: 'ma',
    group: 'basic',
    items: [
      { h: 'ま', k: 'マ', r: 'ma' },
      { h: 'み', k: 'ミ', r: 'mi' },
      { h: 'む', k: 'ム', r: 'mu' },
      { h: 'め', k: 'メ', r: 'me' },
      { h: 'も', k: 'モ', r: 'mo' },
    ],
  },
  {
    row: 'ya',
    group: 'basic',
    items: [
      { h: 'や', k: 'ヤ', r: 'ya' },
      { h: 'ゆ', k: 'ユ', r: 'yu' },
      { h: 'よ', k: 'ヨ', r: 'yo' },
    ],
  },
  {
    row: 'ra',
    group: 'basic',
    items: [
      { h: 'ら', k: 'ラ', r: 'ra' },
      { h: 'り', k: 'リ', r: 'ri' },
      { h: 'る', k: 'ル', r: 'ru' },
      { h: 'れ', k: 'レ', r: 're' },
      { h: 'ろ', k: 'ロ', r: 'ro' },
    ],
  },
  {
    row: 'wa',
    group: 'basic',
    items: [
      { h: 'わ', k: 'ワ', r: 'wa' },
      { h: 'を', k: 'ヲ', r: 'wo' },
      { h: 'ん', k: 'ン', r: 'n' },
    ],
  },
  // Dakuten
  {
    row: 'ga',
    group: 'dakuten',
    items: [
      { h: 'が', k: 'ガ', r: 'ga' },
      { h: 'ぎ', k: 'ギ', r: 'gi' },
      { h: 'ぐ', k: 'グ', r: 'gu' },
      { h: 'げ', k: 'ゲ', r: 'ge' },
      { h: 'ご', k: 'ゴ', r: 'go' },
    ],
  },
  {
    row: 'za',
    group: 'dakuten',
    items: [
      { h: 'ざ', k: 'ザ', r: 'za' },
      { h: 'じ', k: 'ジ', r: 'ji' },
      { h: 'ず', k: 'ズ', r: 'zu' },
      { h: 'ぜ', k: 'ゼ', r: 'ze' },
      { h: 'ぞ', k: 'ゾ', r: 'zo' },
    ],
  },
  {
    row: 'da',
    group: 'dakuten',
    items: [
      { h: 'だ', k: 'ダ', r: 'da' },
      { h: 'ぢ', k: 'ヂ', r: 'ji' },
      { h: 'づ', k: 'ヅ', r: 'zu' },
      { h: 'で', k: 'デ', r: 'de' },
      { h: 'ど', k: 'ド', r: 'do' },
    ],
  },
  {
    row: 'ba',
    group: 'dakuten',
    items: [
      { h: 'ば', k: 'バ', r: 'ba' },
      { h: 'び', k: 'ビ', r: 'bi' },
      { h: 'ぶ', k: 'ブ', r: 'bu' },
      { h: 'べ', k: 'ベ', r: 'be' },
      { h: 'ぼ', k: 'ボ', r: 'bo' },
    ],
  },
  // Handakuten
  {
    row: 'pa',
    group: 'handakuten',
    items: [
      { h: 'ぱ', k: 'パ', r: 'pa' },
      { h: 'ぴ', k: 'ピ', r: 'pi' },
      { h: 'ぷ', k: 'プ', r: 'pu' },
      { h: 'ぺ', k: 'ペ', r: 'pe' },
      { h: 'ぽ', k: 'ポ', r: 'po' },
    ],
  },
  // Yoon
  {
    row: 'kya',
    group: 'yoon',
    items: [
      { h: 'きゃ', k: 'キャ', r: 'kya' },
      { h: 'きゅ', k: 'キュ', r: 'kyu' },
      { h: 'きょ', k: 'キョ', r: 'kyo' },
    ],
  },
  {
    row: 'sha',
    group: 'yoon',
    items: [
      { h: 'しゃ', k: 'シャ', r: 'sha' },
      { h: 'しゅ', k: 'シュ', r: 'shu' },
      { h: 'しょ', k: 'ショ', r: 'sho' },
    ],
  },
  {
    row: 'cha',
    group: 'yoon',
    items: [
      { h: 'ちゃ', k: 'チャ', r: 'cha' },
      { h: 'ちゅ', k: 'チュ', r: 'chu' },
      { h: 'ちょ', k: 'チョ', r: 'cho' },
    ],
  },
  {
    row: 'nya',
    group: 'yoon',
    items: [
      { h: 'にゃ', k: 'ニャ', r: 'nya' },
      { h: 'にゅ', k: 'ニュ', r: 'nyu' },
      { h: 'にょ', k: 'ニョ', r: 'nyo' },
    ],
  },
  {
    row: 'hya',
    group: 'yoon',
    items: [
      { h: 'ひゃ', k: 'ヒャ', r: 'hya' },
      { h: 'ひゅ', k: 'ヒュ', r: 'hyu' },
      { h: 'ひょ', k: 'ヒョ', r: 'hyo' },
    ],
  },
  {
    row: 'mya',
    group: 'yoon',
    items: [
      { h: 'みゃ', k: 'ミャ', r: 'mya' },
      { h: 'みゅ', k: 'ミュ', r: 'myu' },
      { h: 'みょ', k: 'ミョ', r: 'myo' },
    ],
  },
  {
    row: 'rya',
    group: 'yoon',
    items: [
      { h: 'りゃ', k: 'リャ', r: 'rya' },
      { h: 'りゅ', k: 'リュ', r: 'ryu' },
      { h: 'りょ', k: 'リョ', r: 'ryo' },
    ],
  },
  {
    row: 'gya',
    group: 'yoon',
    items: [
      { h: 'ぎゃ', k: 'ギャ', r: 'gya' },
      { h: 'ぎゅ', k: 'ギュ', r: 'gyu' },
      { h: 'ぎょ', k: 'ギョ', r: 'gyo' },
    ],
  },
  {
    row: 'ja',
    group: 'yoon',
    items: [
      { h: 'じゃ', k: 'ジャ', r: 'ja' },
      { h: 'じゅ', k: 'ジュ', r: 'ju' },
      { h: 'じょ', k: 'ジョ', r: 'jo' },
    ],
  },
  {
    row: 'bya',
    group: 'yoon',
    items: [
      { h: 'びゃ', k: 'ビャ', r: 'bya' },
      { h: 'びゅ', k: 'ビュ', r: 'byu' },
      { h: 'びょ', k: 'ビョ', r: 'byo' },
    ],
  },
  {
    row: 'pya',
    group: 'yoon',
    items: [
      { h: 'ぴゃ', k: 'ピャ', r: 'pya' },
      { h: 'ぴゅ', k: 'ピュ', r: 'pyu' },
      { h: 'ぴょ', k: 'ピョ', r: 'pyo' },
    ],
  },
];

export const ALL_KANA_ITEMS: KanaItem[] = KANA_ROWS.flatMap((rowDef) =>
  rowDef.items.map((item) => ({
    id: `${rowDef.row}_${item.r}_${item.h}`,
    hiragana: item.h,
    katakana: item.k,
    romaji: item.r,
    group: rowDef.group,
    row: rowDef.row,
  }))
);
