import type { UserSettings } from '@/types';

export interface AISuggestedCardFields {
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
}

export async function suggestCardFieldsWithAI(
  term: string,
  settings: Pick<UserSettings, 'aiEnabled' | 'aiApiKey' | 'aiEndpoint' | 'aiModel'>
): Promise<AISuggestedCardFields> {
  const trimmed = term.trim();
  if (!trimmed) {
    throw new Error('Please enter a term first.');
  }
  if (!settings.aiEnabled || !settings.aiApiKey.trim()) {
    throw new Error('AI assist is disabled or missing an API key in Settings.');
  }

  const endpoint = settings.aiEndpoint.trim() || 'https://api.openai.com/v1/chat/completions';
  const model = settings.aiModel.trim() || 'gpt-4o-mini';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.aiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a bilingual English-Vietnamese dictionary assistant. Return ONLY valid JSON with keys: meaning (Vietnamese meaning), phonetic (IPA), partOfSpeech (noun/verb/adjective/adverb/phrase), example (concise English sentence), exampleTranslation (Vietnamese translation).',
        },
        {
          role: 'user',
          content: `Provide vocabulary details for the term: "${trimmed}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}). Check your endpoint or API key.`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
  const jsonText = raw
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(jsonText) as Partial<AISuggestedCardFields>;

  return {
    meaning: parsed.meaning ?? '',
    phonetic: parsed.phonetic ?? '',
    partOfSpeech: parsed.partOfSpeech ?? 'noun',
    example: parsed.example ?? '',
    exampleTranslation: parsed.exampleTranslation ?? '',
  };
}
