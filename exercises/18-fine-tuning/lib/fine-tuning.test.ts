/**
 * Tests for Fine-Tuning with MLX
 */

import { describe, it, expect } from 'bun:test';
import {
  formatTrainingExample,
  formatConversationExample,
  toJSONL,
  parseJSONL,
  validateExample,
  validateDataset,
  calculateStats,
  splitDataset,
  generateTrainingCommand,
  generateEvalCommand,
  generateFuseCommand,
  calculateSimilarity,
  evaluateResults,
  SAMPLE_SUPPORT_DATA,
  SAMPLE_CODE_DATA,
  type TrainingExample,
  type ConversationExample,
} from './fine-tuning';

describe('formatTrainingExample', () => {
  it('should format example with chat template', () => {
    const example: TrainingExample = {
      prompt: 'Hello',
      completion: 'Hi there!',
    };

    const formatted = formatTrainingExample(example);
    const parsed = JSON.parse(formatted);

    expect(parsed.text).toContain('<|im_start|>user');
    expect(parsed.text).toContain('Hello');
    expect(parsed.text).toContain('<|im_start|>assistant');
    expect(parsed.text).toContain('Hi there!');
    expect(parsed.text).toContain('<|im_end|>');
  });

  it('should handle special characters', () => {
    const example: TrainingExample = {
      prompt: 'What is 2 + 2?',
      completion: 'The answer is 4.',
    };

    const formatted = formatTrainingExample(example);
    expect(() => JSON.parse(formatted)).not.toThrow();
  });
});

describe('formatConversationExample', () => {
  it('should format multi-turn conversation', () => {
    const example: ConversationExample = {
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ],
    };

    const formatted = formatConversationExample(example);
    const parsed = JSON.parse(formatted);

    expect(parsed.text).toContain('<|im_start|>system');
    expect(parsed.text).toContain('You are helpful.');
    expect(parsed.text).toContain('<|im_start|>user');
    expect(parsed.text).toContain('<|im_start|>assistant');
  });
});

describe('toJSONL', () => {
  it('should create valid JSONL', () => {
    const examples: TrainingExample[] = [
      { prompt: 'A', completion: 'B' },
      { prompt: 'C', completion: 'D' },
    ];

    const jsonl = toJSONL(examples);
    const lines = jsonl.split('\n');

    expect(lines.length).toBe(2);
    expect(() => JSON.parse(lines[0])).not.toThrow();
    expect(() => JSON.parse(lines[1])).not.toThrow();
  });
});

describe('parseJSONL', () => {
  it('should parse JSONL back to objects', () => {
    const jsonl = '{"text": "line1"}\n{"text": "line2"}';
    const parsed = parseJSONL(jsonl);

    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe('line1');
    expect(parsed[1].text).toBe('line2');
  });

  it('should handle empty lines', () => {
    const jsonl = '{"text": "a"}\n\n{"text": "b"}\n';
    const parsed = parseJSONL(jsonl);

    expect(parsed.length).toBe(2);
  });
});

describe('validateExample', () => {
  it('should pass valid examples', () => {
    const result = validateExample({
      prompt: 'Valid prompt',
      completion: 'Valid completion',
    });

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should fail empty prompt', () => {
    const result = validateExample({
      prompt: '',
      completion: 'Completion',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Prompt is empty');
  });

  it('should fail empty completion', () => {
    const result = validateExample({
      prompt: 'Prompt',
      completion: '   ',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Completion is empty');
  });

  it('should fail too long content', () => {
    const result = validateExample({
      prompt: 'a'.repeat(5000),
      completion: 'ok',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('4096'))).toBe(true);
  });
});

describe('validateDataset', () => {
  it('should validate all examples', () => {
    const result = validateDataset([
      { prompt: 'A', completion: 'B' },
      { prompt: 'C', completion: 'D' },
    ]);

    expect(result.valid).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
  });

  it('should report invalid examples with index', () => {
    const result = validateDataset([
      { prompt: 'A', completion: 'B' },
      { prompt: '', completion: 'D' },
      { prompt: 'E', completion: '' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(2);
    expect(result.errors.map((e) => e.index)).toContain(1);
    expect(result.errors.map((e) => e.index)).toContain(2);
  });
});

describe('calculateStats', () => {
  it('should calculate basic statistics', () => {
    const stats = calculateStats([
      { prompt: 'Hello', completion: 'World' },
      { prompt: 'Hi there', completion: 'Hey' },
    ]);

    expect(stats.totalExamples).toBe(2);
    expect(stats.avgPromptLength).toBeGreaterThan(0);
    expect(stats.minPromptLength).toBe(5); // "Hello"
    expect(stats.maxPromptLength).toBe(8); // "Hi there"
  });

  it('should handle empty dataset', () => {
    const stats = calculateStats([]);

    expect(stats.totalExamples).toBe(0);
    expect(stats.avgPromptLength).toBe(0);
  });
});

describe('splitDataset', () => {
  it('should split data into train/valid', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const { train, valid } = splitDataset(data, 0.8, false);

    expect(train.length).toBe(8);
    expect(valid.length).toBe(2);
  });

  it('should shuffle with seed', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const split1 = splitDataset(data, 0.8, true, 42);
    const split2 = splitDataset(data, 0.8, true, 42);

    expect(split1.train).toEqual(split2.train);
    expect(split1.valid).toEqual(split2.valid);
  });

  it('should produce different results with different seeds', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const split1 = splitDataset(data, 0.8, true, 42);
    const split2 = splitDataset(data, 0.8, true, 123);

    // Very unlikely to be the same
    expect(split1.train).not.toEqual(split2.train);
  });
});

describe('generateTrainingCommand', () => {
  it('should generate valid MLX command', () => {
    const cmd = generateTrainingCommand({
      model: 'test-model',
      iters: 500,
    });

    expect(cmd).toContain('uvx --from mlx-lm mlx_lm.lora');
    expect(cmd).toContain('--model test-model');
    expect(cmd).toContain('--train');
    expect(cmd).toContain('--iters 500');
  });

  it('should use default values', () => {
    const cmd = generateTrainingCommand();

    expect(cmd).toContain('--iters 1000');
    expect(cmd).toContain('--batch-size 4');
    expect(cmd).toContain('--lora-rank 8');
  });
});

describe('generateEvalCommand', () => {
  it('should generate eval command', () => {
    const cmd = generateEvalCommand('./model', './adapters', 'Test prompt');

    expect(cmd).toContain('mlx_lm.generate');
    expect(cmd).toContain('--model ./model');
    expect(cmd).toContain('--adapter-path ./adapters');
    expect(cmd).toContain('Test prompt');
  });

  it('should escape single quotes in prompt', () => {
    const cmd = generateEvalCommand('./model', './adapters', "It's a test");

    expect(cmd).toContain("\\'");
  });
});

describe('generateFuseCommand', () => {
  it('should generate fuse command', () => {
    const cmd = generateFuseCommand('./model', './adapters', './output');

    expect(cmd).toContain('mlx_lm.fuse');
    expect(cmd).toContain('--model ./model');
    expect(cmd).toContain('--adapter-path ./adapters');
    expect(cmd).toContain('--save-path ./output');
  });
});

describe('calculateSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    expect(calculateSimilarity('abc def', 'xyz uvw')).toBe(0);
  });

  it('should return partial score for overlap', () => {
    const score = calculateSimilarity('hello world', 'hello there');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('should be case insensitive', () => {
    expect(calculateSimilarity('HELLO', 'hello')).toBe(1);
  });
});

describe('evaluateResults', () => {
  it('should calculate average score', () => {
    const results = [
      { prompt: 'a', expectedCompletion: 'b', actualCompletion: 'b', matchScore: 1 },
      { prompt: 'c', expectedCompletion: 'd', actualCompletion: 'x', matchScore: 0 },
    ];

    const eval_ = evaluateResults(results);

    expect(eval_.avgScore).toBe(0.5);
    expect(eval_.passRate).toBe(0.5);
  });

  it('should calculate pass rate with threshold', () => {
    const results = [
      { prompt: 'a', expectedCompletion: 'b', actualCompletion: 'b', matchScore: 0.8 },
      { prompt: 'c', expectedCompletion: 'd', actualCompletion: 'd', matchScore: 0.6 },
      { prompt: 'e', expectedCompletion: 'f', actualCompletion: 'x', matchScore: 0.3 },
    ];

    const eval_ = evaluateResults(results);

    expect(eval_.passRate).toBeCloseTo(2 / 3);
  });
});

describe('Sample datasets', () => {
  it('should have valid support data', () => {
    const validation = validateDataset(SAMPLE_SUPPORT_DATA);
    expect(validation.valid).toBe(true);
    expect(SAMPLE_SUPPORT_DATA.length).toBeGreaterThan(0);
  });

  it('should have valid code data', () => {
    const validation = validateDataset(SAMPLE_CODE_DATA);
    expect(validation.valid).toBe(true);
    expect(SAMPLE_CODE_DATA.length).toBeGreaterThan(0);
  });

  it('should format sample data as JSONL', () => {
    const jsonl = toJSONL(SAMPLE_SUPPORT_DATA);
    const lines = jsonl.split('\n');

    expect(lines.length).toBe(SAMPLE_SUPPORT_DATA.length);
    lines.forEach((line) => {
      expect(() => JSON.parse(line)).not.toThrow();
    });
  });
});
