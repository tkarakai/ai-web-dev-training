/**
 * Tests for Model Routing
 */

import { describe, it, expect } from 'bun:test';
import {
  ModelRegistry,
  ModelRouter,
  FallbackChain,
  analyzeComplexity,
  classifyComplexity,
  estimateTokens,
  calculateCost,
  formatCost,
  EXAMPLE_RULES,
  DEFAULT_MODELS,
  type ModelConfig,
  type RoutingRule,
} from './routing';

describe('ModelRegistry', () => {
  it('should store and retrieve models', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);

    expect(registry.get('small')).toBeDefined();
    expect(registry.get('medium')).toBeDefined();
    expect(registry.get('large')).toBeDefined();
  });

  it('should return undefined for unknown model', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('should get all models', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const all = registry.getAll();

    expect(all.length).toBe(3);
  });

  it('should filter by capability', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);

    const codeModels = registry.getByCapability('code');
    expect(codeModels.every((m) => m.capabilities.includes('code'))).toBe(true);

    const fastModels = registry.getByCapability('fast');
    expect(fastModels.length).toBeGreaterThan(0);
  });

  it('should find cheapest model', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const cheapest = registry.getCheapest();

    expect(cheapest.id).toBe('small');
  });

  it('should find most capable model', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const best = registry.getMostCapable();

    expect(best.id).toBe('large');
  });
});

describe('analyzeComplexity', () => {
  it('should detect code patterns', () => {
    const signals = analyzeComplexity('Write a function that calculates fibonacci(n)');
    expect(signals.hasCode).toBe(false); // No actual code yet

    const signals2 = analyzeComplexity('```javascript\nconst x = 1;\n```');
    expect(signals2.hasCode).toBe(true);
  });

  it('should detect math patterns', () => {
    const signals = analyzeComplexity('Calculate 2 + 2');
    expect(signals.hasMath).toBe(true);

    const signals2 = analyzeComplexity('Solve this equation: x^2 + 5x = 0');
    expect(signals2.hasMath).toBe(true);
  });

  it('should detect multi-step patterns', () => {
    const signals = analyzeComplexity('First, read the file. Then, parse it. Finally, save.');
    expect(signals.hasMultiStep).toBe(true);
  });

  it('should count technical terms', () => {
    const signals = analyzeComplexity(
      'Explain the algorithm for database optimization using concurrency'
    );
    expect(signals.technicalTermCount).toBeGreaterThanOrEqual(3);
  });

  it('should count questions', () => {
    const signals = analyzeComplexity('What is X? How does Y work? Why is Z important?');
    expect(signals.questionCount).toBe(3);
  });

  it('should detect reasoning indicators', () => {
    const signals = analyzeComplexity('Analyze and compare the trade-offs');
    expect(signals.reasoningIndicators).toBeGreaterThanOrEqual(2);
  });

  it('should count words and sentences', () => {
    const signals = analyzeComplexity('Hello world. This is a test.');
    expect(signals.wordCount).toBe(6);
    expect(signals.sentenceCount).toBe(2);
  });
});

describe('classifyComplexity', () => {
  it('should classify simple queries', () => {
    const signals = analyzeComplexity('Hello, how are you?');
    const result = classifyComplexity(signals);

    expect(result.level).toBe('simple');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify moderate queries', () => {
    const signals = analyzeComplexity(
      'Explain how React hooks work and provide some examples'
    );
    const result = classifyComplexity(signals);

    expect(['simple', 'moderate']).toContain(result.level);
  });

  it('should classify complex queries', () => {
    const signals = analyzeComplexity(`
      Write a recursive algorithm to solve the traveling salesman problem.
      First, explain the mathematical formulation. Then, implement it in TypeScript.
      Finally, analyze the time complexity and compare with dynamic programming.
    `);
    const result = classifyComplexity(signals);

    expect(result.level).toBe('complex');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should include reasons', () => {
    const signals = analyzeComplexity('Calculate the derivative of x^2 + 3x');
    const result = classifyComplexity(signals);

    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('ModelRouter', () => {
  it('should route simple queries to small model', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const router = new ModelRouter({
      registry,
      defaultModel: 'medium',
      costWeight: 0.5,
    });

    const decision = router.route('Hi there!');

    expect(decision.complexity).toBe('simple');
    expect(decision.confidence).toBeGreaterThan(0.5);
  });

  it('should route complex queries to capable models', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const router = new ModelRouter({
      registry,
      defaultModel: 'medium',
    });

    const decision = router.route(`
      Analyze the algorithmic complexity of quicksort.
      Compare it with mergesort. What are the trade-offs?
      Then implement an optimized version with concurrency.
    `);

    expect(decision.complexity).toBe('complex');
    expect(decision.model.capabilities.includes('reasoning')).toBe(true);
  });

  it('should respect custom rules', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const router = new ModelRouter({
      registry,
      defaultModel: 'medium',
      rules: [
        {
          name: 'always-large',
          condition: (input) => input.includes('PRIORITY'),
          targetModel: 'large',
          priority: 100,
        },
      ],
    });

    const decision = router.route('This is a PRIORITY request');

    expect(decision.model.id).toBe('large');
    expect(decision.reason).toContain('Rule');
  });

  it('should add and remove rules', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const router = new ModelRouter({
      registry,
      defaultModel: 'medium',
    });

    router.addRule({
      name: 'test-rule',
      condition: () => true,
      targetModel: 'small',
      priority: 1000,
    });

    const decision1 = router.route('Anything');
    expect(decision1.model.id).toBe('small');

    router.removeRule('test-rule');

    const decision2 = router.route('Anything');
    // Should no longer force small
    expect(decision2.reason).not.toContain('test-rule');
  });

  it('should consider budget constraints', () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const router = new ModelRouter({
      registry,
      defaultModel: 'large',
      costWeight: 0.8,
    });

    const decision = router.route('A complex query that normally needs large model', {
      budget: 0.00001, // Very low budget
    });

    // Should prefer cheaper model due to budget
    expect(decision.model.costPer1kTokens).toBeLessThan(0.002);
  });
});

describe('FallbackChain', () => {
  it('should succeed on first try if no errors', async () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const chain = new FallbackChain(registry, {
      models: ['small', 'medium', 'large'],
    });

    const { result, modelUsed, attempts } = await chain.execute(async () => {
      return 'Success';
    });

    expect(result).toBe('Success');
    expect(modelUsed.id).toBe('small');
    expect(attempts).toBe(1);
  });

  it('should fallback on error', async () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const chain = new FallbackChain(registry, {
      models: ['small', 'medium', 'large'],
      maxRetries: 0,
    });

    let callCount = 0;
    const { result, modelUsed, attempts } = await chain.execute(async (model) => {
      callCount++;
      if (model.id === 'small') {
        throw new Error('Small model failed');
      }
      return 'Success from ' + model.id;
    });

    expect(result).toBe('Success from medium');
    expect(modelUsed.id).toBe('medium');
    expect(attempts).toBe(2);
  });

  it('should retry within model before fallback', async () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const chain = new FallbackChain(registry, {
      models: ['small', 'medium'],
      maxRetries: 2,
      retryDelayMs: 10,
    });

    let smallCalls = 0;
    const { modelUsed, attempts } = await chain.execute(async (model) => {
      if (model.id === 'small') {
        smallCalls++;
        if (smallCalls < 3) {
          throw new Error('Temporary failure');
        }
      }
      return 'Success';
    });

    expect(modelUsed.id).toBe('small');
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });

  it('should throw if all models fail', async () => {
    const registry = new ModelRegistry(DEFAULT_MODELS);
    const chain = new FallbackChain(registry, {
      models: ['small'],
      maxRetries: 0,
    });

    await expect(
      chain.execute(async () => {
        throw new Error('Always fail');
      })
    ).rejects.toThrow('Always fail');
  });
});

describe('EXAMPLE_RULES', () => {
  it('should match code generation', () => {
    const codeRule = EXAMPLE_RULES.find((r) => r.name === 'code-generation');
    expect(codeRule).toBeDefined();
    expect(codeRule!.condition('Write a function to sort arrays', undefined)).toBe(true);
    expect(codeRule!.condition('What is the weather?', undefined)).toBe(false);
  });

  it('should match simple greetings', () => {
    const greetingRule = EXAMPLE_RULES.find((r) => r.name === 'simple-greeting');
    expect(greetingRule).toBeDefined();
    expect(greetingRule!.condition('Hi there!', undefined)).toBe(true);
    expect(greetingRule!.condition('Hello', undefined)).toBe(true);
    expect(
      greetingRule!.condition(
        'Hello, I need help with a complex algorithm implementation',
        undefined
      )
    ).toBe(false);
  });

  it('should match math problems', () => {
    const mathRule = EXAMPLE_RULES.find((r) => r.name === 'math-problem');
    expect(mathRule).toBeDefined();
    expect(mathRule!.condition('Solve x^2 + 5x = 0', undefined)).toBe(true);
    expect(mathRule!.condition('Calculate the derivative', undefined)).toBe(true);
  });
});

describe('Utility functions', () => {
  describe('estimateTokens', () => {
    it('should estimate token count', () => {
      const tokens = estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should scale with text length', () => {
      const short = estimateTokens('Hi');
      const long = estimateTokens('This is a much longer piece of text with more words');

      expect(long).toBeGreaterThan(short);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const model: ModelConfig = {
        id: 'test',
        name: 'Test',
        endpoint: '',
        costPer1kTokens: 0.001,
        maxTokens: 1000,
        latencyMs: 100,
        capabilities: [],
      };

      const cost = calculateCost(model, 1000, 1000);
      expect(cost).toBeCloseTo(0.002, 5);
    });

    it('should handle zero tokens', () => {
      const model: ModelConfig = {
        id: 'test',
        name: 'Test',
        endpoint: '',
        costPer1kTokens: 0.001,
        maxTokens: 1000,
        latencyMs: 100,
        capabilities: [],
      };

      const cost = calculateCost(model, 0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('formatCost', () => {
    it('should format small costs in cents', () => {
      expect(formatCost(0.00005)).toContain('c');
    });

    it('should format larger costs in dollars', () => {
      expect(formatCost(0.05)).toMatch(/\$0\.\d+/);
    });
  });
});
