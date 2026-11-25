export interface TTSOptions {
  voiceURI?: string;
  lang?: string;
  rate?: number;
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function pickVoiceForLang(
  lang: string,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | undefined {
  const voices = getAvailableVoices();
  if (voices.length === 0) return undefined;

  const targetPrefix = lang.split('-')[0].toLowerCase();
  if (preferredVoiceURI) {
    const preferred = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (preferred && preferred.lang.toLowerCase().startsWith(targetPrefix)) {
      return preferred;
    }
  }

  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix))
  );
}

export function speakText(text: string, options: TTSOptions = {}): boolean {
  if (!isTTSSupported() || !text.trim()) return false;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = options.lang || 'en-US';
    utterance.lang = targetLang;
    utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1));

    const matchedVoice = pickVoiceForLang(targetLang, options.voiceURI);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}
