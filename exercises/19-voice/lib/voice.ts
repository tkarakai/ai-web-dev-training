/**
 * Voice Interfaces
 *
 * Build speech-to-text and text-to-speech interfaces using Web Speech API.
 *
 * KEY CONCEPTS:
 * 1. Speech Recognition (STT) - Convert voice to text
 * 2. Speech Synthesis (TTS) - Convert text to voice
 * 3. Voice Commands - Process voice input with LLM
 * 4. Streaming - Real-time transcription
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface SpeechSynthesisConfig {
  language: string;
  pitch: number; // 0-2, default 1
  rate: number; // 0.1-10, default 1
  volume: number; // 0-1, default 1
  voice?: string; // Voice name
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: string[];
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
}

// =============================================================================
// DEFAULTS
// =============================================================================

export const DEFAULT_RECOGNITION_CONFIG: SpeechRecognitionConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 3,
};

export const DEFAULT_SYNTHESIS_CONFIG: SpeechSynthesisConfig = {
  language: 'en-US',
  pitch: 1,
  rate: 1,
  volume: 1,
};

// =============================================================================
// BROWSER SUPPORT DETECTION
// =============================================================================

/**
 * Check if Speech Recognition is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Check if Speech Synthesis is supported
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

/**
 * Get the SpeechRecognition constructor
 */
export function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
    null
  );
}

// =============================================================================
// SPEECH RECOGNITION (STT)
// =============================================================================

export type RecognitionCallback = (result: TranscriptionResult) => void;
export type ErrorCallback = (error: string) => void;

/**
 * Create and configure a speech recognition instance
 */
export function createSpeechRecognition(
  config: Partial<SpeechRecognitionConfig> = {},
  onResult: RecognitionCallback,
  onError?: ErrorCallback
): SpeechRecognition | null {
  const SpeechRecognitionClass = getSpeechRecognition();
  if (!SpeechRecognitionClass) {
    onError?.('Speech recognition not supported in this browser');
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  const cfg = { ...DEFAULT_RECOGNITION_CONFIG, ...config };

  recognition.lang = cfg.language;
  recognition.continuous = cfg.continuous;
  recognition.interimResults = cfg.interimResults;
  recognition.maxAlternatives = cfg.maxAlternatives;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const lastResult = event.results[event.results.length - 1];
    const result: TranscriptionResult = {
      transcript: lastResult[0].transcript,
      confidence: lastResult[0].confidence,
      isFinal: lastResult.isFinal,
      alternatives: Array.from(lastResult)
        .slice(1)
        .map((alt) => alt.transcript),
    };
    onResult(result);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError?.(event.error);
  };

  return recognition;
}

/**
 * Simple one-shot speech recognition
 */
export function recognizeSpeech(
  config: Partial<SpeechRecognitionConfig> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const recognition = createSpeechRecognition(
      { ...config, continuous: false, interimResults: false },
      (result) => {
        if (result.isFinal) {
          recognition?.stop();
          resolve(result.transcript);
        }
      },
      (error) => {
        reject(new Error(error));
      }
    );

    if (!recognition) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    recognition.start();
  });
}

// =============================================================================
// SPEECH SYNTHESIS (TTS)
// =============================================================================

/**
 * Get available voices
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Voices may load asynchronously
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });
}

/**
 * Get voices filtered by language
 */
export async function getVoicesByLanguage(lang: string): Promise<SpeechSynthesisVoice[]> {
  const voices = await getVoices();
  return voices.filter((v) => v.lang.startsWith(lang));
}

/**
 * Speak text using Speech Synthesis
 */
export function speak(
  text: string,
  config: Partial<SpeechSynthesisConfig> = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    const cfg = { ...DEFAULT_SYNTHESIS_CONFIG, ...config };
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = cfg.language;
    utterance.pitch = cfg.pitch;
    utterance.rate = cfg.rate;
    utterance.volume = cfg.volume;

    // Set voice if specified
    if (cfg.voice) {
      getVoices().then((voices) => {
        const voice = voices.find((v) => v.name === cfg.voice);
        if (voice) {
          utterance.voice = voice;
        }
        speechSynthesis.speak(utterance);
      });
    } else {
      speechSynthesis.speak(utterance);
    }

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error));
  });
}

/**
 * Stop all speech
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    speechSynthesis.cancel();
  }
}

/**
 * Pause speech
 */
export function pauseSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    speechSynthesis.pause();
  }
}

/**
 * Resume speech
 */
export function resumeSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    speechSynthesis.resume();
  }
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return speechSynthesis.speaking;
}

// =============================================================================
// VOICE ASSISTANT PATTERNS
// =============================================================================

export interface VoiceAssistantConfig {
  llmBaseUrl: string;
  systemPrompt?: string;
  recognitionConfig?: Partial<SpeechRecognitionConfig>;
  synthesisConfig?: Partial<SpeechSynthesisConfig>;
  onStateChange?: (state: VoiceState) => void;
}

/**
 * Process voice input through LLM and speak response
 */
export async function processVoiceCommand(
  transcript: string,
  config: VoiceAssistantConfig
): Promise<string> {
  const systemPrompt = config.systemPrompt || 'You are a helpful voice assistant. Keep responses concise and conversational.';

  const response = await fetch(`${config.llmBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'I could not generate a response.';
}

// =============================================================================
// VOICE COMMANDS PARSER
// =============================================================================

export interface VoiceCommand {
  intent: string;
  entities: Record<string, string>;
  raw: string;
}

export interface CommandPattern {
  intent: string;
  patterns: RegExp[];
  entities?: string[];
}

/**
 * Parse voice command using patterns
 */
export function parseVoiceCommand(
  transcript: string,
  patterns: CommandPattern[]
): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim();

  for (const { intent, patterns: regexps, entities = [] } of patterns) {
    for (const regex of regexps) {
      const match = lower.match(regex);
      if (match) {
        const entityValues: Record<string, string> = {};
        entities.forEach((name, i) => {
          if (match[i + 1]) {
            entityValues[name] = match[i + 1];
          }
        });

        return {
          intent,
          entities: entityValues,
          raw: transcript,
        };
      }
    }
  }

  return null;
}

/**
 * Common voice command patterns
 */
export const COMMON_COMMANDS: CommandPattern[] = [
  {
    intent: 'search',
    patterns: [
      /search (?:for )?(.+)/,
      /find (.+)/,
      /look up (.+)/,
    ],
    entities: ['query'],
  },
  {
    intent: 'timer',
    patterns: [
      /set (?:a )?timer (?:for )?(\d+) (minutes?|seconds?|hours?)/,
      /timer (\d+) (minutes?|seconds?|hours?)/,
    ],
    entities: ['duration', 'unit'],
  },
  {
    intent: 'weather',
    patterns: [
      /(?:what's|what is) the weather(?: in (.+))?/,
      /weather(?: in (.+))?/,
    ],
    entities: ['location'],
  },
  {
    intent: 'time',
    patterns: [
      /what time is it/,
      /what's the time/,
      /current time/,
    ],
  },
  {
    intent: 'stop',
    patterns: [
      /stop/,
      /cancel/,
      /never mind/,
    ],
  },
  {
    intent: 'help',
    patterns: [
      /help/,
      /what can you do/,
      /commands/,
    ],
  },
];

// =============================================================================
// AUDIO FEEDBACK
// =============================================================================

/**
 * Play a beep sound (for listening indicator)
 */
export function playBeep(
  frequency: number = 440,
  duration: number = 200,
  volume: number = 0.1
): void {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gainNode.gain.value = volume;

  oscillator.start();
  setTimeout(() => {
    oscillator.stop();
    audioContext.close();
  }, duration);
}

/**
 * Play start listening sound
 */
export function playStartListening(): void {
  playBeep(880, 100, 0.1);
}

/**
 * Play stop listening sound
 */
export function playStopListening(): void {
  playBeep(440, 100, 0.1);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format transcript for display (capitalize, etc.)
 */
export function formatTranscript(transcript: string): string {
  if (!transcript) return '';
  return transcript.charAt(0).toUpperCase() + transcript.slice(1);
}

/**
 * Split text into speakable chunks (for long responses)
 */
export function splitIntoChunks(text: string, maxLength: number = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

/**
 * Speak long text in chunks
 */
export async function speakLongText(
  text: string,
  config: Partial<SpeechSynthesisConfig> = {},
  onChunk?: (chunk: string, index: number) => void
): Promise<void> {
  const chunks = splitIntoChunks(text);

  for (let i = 0; i < chunks.length; i++) {
    onChunk?.(chunks[i], i);
    await speak(chunks[i], config);
  }
}
