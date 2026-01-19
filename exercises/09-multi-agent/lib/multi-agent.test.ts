/**
 * Tests for Multi-Agent Pipelines
 *
 * Run: bun test lib/multi-agent.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  AGENTS,
  pipeline,
  PipelineBuilder,
} from './multi-agent';

describe('AGENTS definitions', () => {
  it('has required agent types', () => {
    expect(AGENTS.analyzer).toBeDefined();
    expect(AGENTS.writer).toBeDefined();
    expect(AGENTS.critic).toBeDefined();
    expect(AGENTS.summarizer).toBeDefined();
    expect(AGENTS.router).toBeDefined();
  });

  it('agents have required properties', () => {
    for (const [key, agent] of Object.entries(AGENTS)) {
      expect(agent.name).toBeTruthy();
      expect(agent.systemPrompt).toBeTruthy();
      expect(typeof agent.temperature).toBe('number');
    }
  });

  it('router agent has low temperature for consistency', () => {
    expect(AGENTS.router.temperature).toBe(0);
  });

  it('writer agent has higher temperature for creativity', () => {
    expect(AGENTS.writer.temperature).toBeGreaterThan(AGENTS.analyzer.temperature!);
  });
});

describe('Agent system prompts', () => {
  it('analyzer focuses on breaking down input', () => {
    expect(AGENTS.analyzer.systemPrompt.toLowerCase()).toContain('break down');
  });

  it('critic focuses on review and improvement', () => {
    expect(AGENTS.critic.systemPrompt.toLowerCase()).toContain('critic');
  });

  it('factChecker has approval keyword', () => {
    expect(AGENTS.factChecker.systemPrompt).toContain('VERIFIED');
  });

  it('router lists categories', () => {
    const prompt = AGENTS.router.systemPrompt;
    expect(prompt).toContain('ANALYSIS');
    expect(prompt).toContain('CONTENT');
    expect(prompt).toContain('CODE');
  });
});

describe('PipelineBuilder structure', () => {
  it('can be instantiated', () => {
    // Mock client for structure testing
    const mockClient = {} as any;
    const builder = pipeline(mockClient);

    expect(builder).toBeInstanceOf(PipelineBuilder);
  });

  it('has fluent interface', () => {
    const mockClient = {} as any;
    const builder = pipeline(mockClient);

    expect(typeof builder.input).toBe('function');
    expect(typeof builder.then).toBe('function');
    expect(typeof builder.run).toBe('function');
  });

  it('throws without input', async () => {
    const mockClient = {} as any;
    const builder = pipeline(mockClient).then(AGENTS.writer);

    await expect(builder.run()).rejects.toThrow('No input');
  });

  it('throws without agents', async () => {
    const mockClient = {} as any;
    const builder = pipeline(mockClient).input('test');

    await expect(builder.run()).rejects.toThrow('No agents');
  });
});

describe('Agent temperature settings', () => {
  it('analytical agents have low temperature', () => {
    expect(AGENTS.analyzer.temperature).toBeLessThanOrEqual(0.3);
    expect(AGENTS.factChecker.temperature).toBeLessThanOrEqual(0.3);
    expect(AGENTS.summarizer.temperature).toBeLessThanOrEqual(0.3);
  });

  it('creative agents have higher temperature', () => {
    expect(AGENTS.writer.temperature).toBeGreaterThanOrEqual(0.5);
  });
});

// =============================================================================
// Integration tests (require llama-server)
// =============================================================================

describe.skip('MultiAgentClient integration (requires llama-server)', () => {
  it('runAgent returns expected structure', async () => {
    const { MultiAgentClient, AGENTS } = await import('./multi-agent');
    const client = new MultiAgentClient();

    const result = await client.runAgent(AGENTS.summarizer, 'Hello world, this is a test.');

    expect(result.agent).toBe('Summarizer');
    expect(result.input).toContain('Hello world');
    expect(result.output).toBeTruthy();
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('chain passes output between agents', async () => {
    const { MultiAgentClient, AGENTS } = await import('./multi-agent');
    const client = new MultiAgentClient();

    const result = await client.chain(
      [AGENTS.analyzer, AGENTS.summarizer],
      'TypeScript is a typed superset of JavaScript.'
    );

    expect(result.steps.length).toBe(2);
    expect(result.steps[0].agent).toBe('Analyzer');
    expect(result.steps[1].agent).toBe('Summarizer');
    expect(result.finalOutput).toBeTruthy();
  });

  it('parallel runs agents concurrently', async () => {
    const { MultiAgentClient, AGENTS } = await import('./multi-agent');
    const client = new MultiAgentClient();

    const result = await client.parallel(
      [AGENTS.analyzer, AGENTS.critic],
      'This is a test input.'
    );

    expect(result.responses.length).toBe(2);
    // Total time should be less than sum of individual times (parallel)
    const sumOfTimes = result.responses.reduce((sum, r) => sum + r.latencyMs, 0);
    expect(result.totalLatencyMs).toBeLessThanOrEqual(sumOfTimes);
  });

  it('route classifies and routes correctly', async () => {
    const { MultiAgentClient, AGENTS } = await import('./multi-agent');
    const client = new MultiAgentClient();

    const result = await client.route('Write a poem about the ocean', {
      CONTENT: AGENTS.writer,
      ANALYSIS: AGENTS.analyzer,
      GENERAL: AGENTS.writer,
    });

    expect(result.route).toBeTruthy();
    expect(result.response.output).toBeTruthy();
  });

  it('pipeline builder works end-to-end', async () => {
    const { MultiAgentClient, AGENTS } = await import('./multi-agent');
    const client = new MultiAgentClient();

    const result = await client
      .pipeline()
      .input('Explain recursion')
      .then(AGENTS.writer)
      .then(AGENTS.summarizer)
      .run();

    expect(result.steps.length).toBe(2);
    expect(result.finalOutput).toBeTruthy();
  });
});
