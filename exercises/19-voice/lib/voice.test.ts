/**
 * Tests for Voice Interfaces
 *
 * Note: Many functions require browser APIs (SpeechRecognition, SpeechSynthesis)
 * which are not available in Node/Bun test environment.
 * These tests focus on the utility functions that can run server-side.
 */

import { describe, it, expect } from 'bun:test';
import {
  parseVoiceCommand,
  formatTranscript,
  splitIntoChunks,
  COMMON_COMMANDS,
  DEFAULT_RECOGNITION_CONFIG,
  DEFAULT_SYNTHESIS_CONFIG,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type CommandPattern,
} from './voice';

describe('parseVoiceCommand', () => {
  it('should parse search command', () => {
    const result = parseVoiceCommand('search for TypeScript tutorials', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('search');
    expect(result?.entities.query).toBe('typescript tutorials');
  });

  it('should parse find command', () => {
    const result = parseVoiceCommand('find the nearest coffee shop', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('search');
    expect(result?.entities.query).toBe('the nearest coffee shop');
  });

  it('should parse timer command', () => {
    const result = parseVoiceCommand('set a timer for 5 minutes', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('timer');
    expect(result?.entities.duration).toBe('5');
    expect(result?.entities.unit).toBe('minutes');
  });

  it('should parse timer without "a"', () => {
    const result = parseVoiceCommand('timer 30 seconds', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('timer');
    expect(result?.entities.duration).toBe('30');
    expect(result?.entities.unit).toBe('seconds');
  });

  it('should parse weather command', () => {
    const result = parseVoiceCommand("what's the weather in Tokyo", COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('weather');
    expect(result?.entities.location).toBe('tokyo');
  });

  it('should parse weather command without location', () => {
    const result = parseVoiceCommand("what's the weather", COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('weather');
  });

  it('should parse time command', () => {
    const result = parseVoiceCommand('what time is it', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('time');
  });

  it('should parse stop command', () => {
    const result = parseVoiceCommand('stop', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('stop');
  });

  it('should parse help command', () => {
    const result = parseVoiceCommand('what can you do', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('help');
  });

  it('should return null for unrecognized commands', () => {
    const result = parseVoiceCommand('blah blah random words', COMMON_COMMANDS);

    expect(result).toBeNull();
  });

  it('should be case insensitive', () => {
    const result = parseVoiceCommand('SEARCH FOR SOMETHING', COMMON_COMMANDS);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('search');
  });

  it('should preserve raw transcript', () => {
    const result = parseVoiceCommand('Search For TypeScript', COMMON_COMMANDS);

    expect(result?.raw).toBe('Search For TypeScript');
  });
});

describe('Custom command patterns', () => {
  it('should work with custom patterns', () => {
    const customPatterns: CommandPattern[] = [
      {
        intent: 'play_music',
        patterns: [/play (.+) by (.+)/, /play (.+)/],
        entities: ['song', 'artist'],
      },
    ];

    const result1 = parseVoiceCommand('play Bohemian Rhapsody by Queen', customPatterns);
    expect(result1?.intent).toBe('play_music');
    expect(result1?.entities.song).toBe('bohemian rhapsody');
    expect(result1?.entities.artist).toBe('queen');

    const result2 = parseVoiceCommand('play some jazz', customPatterns);
    expect(result2?.intent).toBe('play_music');
    expect(result2?.entities.song).toBe('some jazz');
  });
});

describe('formatTranscript', () => {
  it('should capitalize first letter', () => {
    expect(formatTranscript('hello world')).toBe('Hello world');
  });

  it('should handle empty string', () => {
    expect(formatTranscript('')).toBe('');
  });

  it('should handle already capitalized', () => {
    expect(formatTranscript('Hello')).toBe('Hello');
  });

  it('should handle single character', () => {
    expect(formatTranscript('a')).toBe('A');
  });
});

describe('splitIntoChunks', () => {
  it('should split long text into chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = splitIntoChunks(text, 30);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(50); // Some tolerance
    });
  });

  it('should keep short text as single chunk', () => {
    const text = 'Short text.';
    const chunks = splitIntoChunks(text, 200);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe('Short text.');
  });

  it('should handle text without sentence endings', () => {
    const text = 'No sentence ending here';
    const chunks = splitIntoChunks(text, 100);

    expect(chunks.length).toBe(1);
  });

  it('should combine small sentences', () => {
    const text = 'A. B. C. D.';
    const chunks = splitIntoChunks(text, 100);

    expect(chunks.length).toBe(1);
  });

  it('should split on sentence boundaries', () => {
    const text = 'This is a longer sentence. This is another one! And a question?';
    const chunks = splitIntoChunks(text, 30);

    chunks.forEach((chunk) => {
      // Each chunk should end with punctuation
      expect(chunk).toMatch(/[.!?]$/);
    });
  });
});

describe('Default configs', () => {
  it('should have valid recognition config', () => {
    expect(DEFAULT_RECOGNITION_CONFIG.language).toBe('en-US');
    expect(DEFAULT_RECOGNITION_CONFIG.continuous).toBe(true);
    expect(DEFAULT_RECOGNITION_CONFIG.interimResults).toBe(true);
    expect(DEFAULT_RECOGNITION_CONFIG.maxAlternatives).toBe(3);
  });

  it('should have valid synthesis config', () => {
    expect(DEFAULT_SYNTHESIS_CONFIG.language).toBe('en-US');
    expect(DEFAULT_SYNTHESIS_CONFIG.pitch).toBe(1);
    expect(DEFAULT_SYNTHESIS_CONFIG.rate).toBe(1);
    expect(DEFAULT_SYNTHESIS_CONFIG.volume).toBe(1);
  });
});

describe('Browser support detection', () => {
  // These return false in Node/Bun environment
  it('should detect speech recognition not supported in test env', () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('should detect speech synthesis not supported in test env', () => {
    expect(isSpeechSynthesisSupported()).toBe(false);
  });
});

describe('COMMON_COMMANDS', () => {
  it('should have all expected intents', () => {
    const intents = COMMON_COMMANDS.map((c) => c.intent);

    expect(intents).toContain('search');
    expect(intents).toContain('timer');
    expect(intents).toContain('weather');
    expect(intents).toContain('time');
    expect(intents).toContain('stop');
    expect(intents).toContain('help');
  });

  it('should have patterns for each command', () => {
    COMMON_COMMANDS.forEach((cmd) => {
      expect(cmd.patterns.length).toBeGreaterThan(0);
      cmd.patterns.forEach((pattern) => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });
  });
});
