/**
 * Tests for Tool Calling
 *
 * Run with: bun test
 */

import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import {
  defineTool,
  calculatorTool,
  weatherTool,
  timeTool,
  searchTool,
  ToolRegistry,
  parseToolCalls,
  wantsToCallTool,
  generateToolSystemPrompt,
  createDefaultRegistry,
  ToolError,
} from './tools';

// =============================================================================
// Tool Definition Tests
// =============================================================================

describe('defineTool', () => {
  test('creates a tool with correct structure', () => {
    const tool = defineTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({
        input: z.string(),
      }),
      execute: ({ input }) => `Received: ${input}`,
    });

    expect(tool.name).toBe('test_tool');
    expect(tool.description).toBe('A test tool');
    expect(typeof tool.execute).toBe('function');
  });
});

// =============================================================================
// Built-in Tools Tests
// =============================================================================

describe('calculatorTool', () => {
  test('adds numbers', () => {
    const result = calculatorTool.execute({ operation: 'add', a: 5, b: 3 });
    expect(result).toBe('5 + 3 = 8');
  });

  test('subtracts numbers', () => {
    const result = calculatorTool.execute({ operation: 'subtract', a: 10, b: 4 });
    expect(result).toBe('10 - 4 = 6');
  });

  test('multiplies numbers', () => {
    const result = calculatorTool.execute({ operation: 'multiply', a: 6, b: 7 });
    expect(result).toBe('6 * 7 = 42');
  });

  test('divides numbers', () => {
    const result = calculatorTool.execute({ operation: 'divide', a: 20, b: 4 });
    expect(result).toBe('20 / 4 = 5');
  });

  test('handles division by zero', () => {
    const result = calculatorTool.execute({ operation: 'divide', a: 10, b: 0 });
    expect(result).toContain('Error');
    expect(result).toContain('zero');
  });
});

describe('weatherTool', () => {
  test('returns weather for a city', () => {
    const result = weatherTool.execute({ city: 'London', unit: 'celsius' });
    expect(result).toContain('London');
    expect(result).toContain('C');
  });

  test('supports fahrenheit', () => {
    const result = weatherTool.execute({ city: 'New York', unit: 'fahrenheit' });
    expect(result).toContain('New York');
    expect(result).toContain('F');
  });
});

describe('timeTool', () => {
  test('returns current time', () => {
    const result = timeTool.execute({ timezone: 'UTC' });
    expect(result).toContain('UTC');
    expect(result).toContain('Current time');
  });

  test('handles invalid timezone', () => {
    const result = timeTool.execute({ timezone: 'Invalid/Zone' });
    expect(result).toContain('Error');
  });
});

describe('searchTool', () => {
  test('returns search results', () => {
    const result = searchTool.execute({ query: 'TypeScript', maxResults: 2 });
    expect(result).toContain('TypeScript');
    expect(result).toContain('1.');
    expect(result).toContain('2.');
  });

  test('respects maxResults', () => {
    const result = searchTool.execute({ query: 'test', maxResults: 1 });
    expect(result).toContain('1.');
    expect(result).not.toContain('2.');
  });
});

// =============================================================================
// Tool Registry Tests
// =============================================================================

describe('ToolRegistry', () => {
  test('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);

    expect(registry.has('calculator')).toBe(true);
    expect(registry.get('calculator')).toBe(calculatorTool);
  });

  test('throws on duplicate registration', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);

    expect(() => registry.register(calculatorTool)).toThrow(ToolError);
  });

  test('lists all tools', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);
    registry.register(weatherTool);

    const tools = registry.list();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain('calculator');
    expect(tools.map((t) => t.name)).toContain('get_weather');
  });

  test('executes tool with valid params', async () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);

    const result = await registry.execute('calculator', {
      operation: 'add',
      a: 1,
      b: 2,
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('1 + 2 = 3');
  });

  test('returns error for unknown tool', async () => {
    const registry = new ToolRegistry();

    const result = await registry.execute('unknown', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  test('validates parameters', async () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);

    const result = await registry.execute('calculator', {
      operation: 'invalid',
      a: 1,
      b: 2,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid parameters');
  });

  test('generates tool descriptions', () => {
    const registry = new ToolRegistry();
    registry.register(calculatorTool);
    registry.register(weatherTool);

    const descriptions = registry.getToolDescriptions();

    expect(descriptions).toContain('calculator');
    expect(descriptions).toContain('get_weather');
    expect(descriptions).toContain('operation');
    expect(descriptions).toContain('city');
  });
});

// =============================================================================
// Tool Call Parsing Tests
// =============================================================================

describe('parseToolCalls', () => {
  test('parses JSON block format', () => {
    const output = `Let me calculate that.
\`\`\`json
{
  "tool": "calculator",
  "parameters": {
    "operation": "add",
    "a": 5,
    "b": 3
  }
}
\`\`\``;

    const calls = parseToolCalls(output);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('calculator');
    expect(calls[0].parameters).toEqual({
      operation: 'add',
      a: 5,
      b: 3,
    });
  });

  test('parses multiple tool calls', () => {
    const output = `\`\`\`json
{"tool": "get_weather", "parameters": {"city": "London"}}
\`\`\`

\`\`\`json
{"tool": "get_time", "parameters": {"timezone": "UTC"}}
\`\`\``;

    const calls = parseToolCalls(output);

    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('get_weather');
    expect(calls[1].name).toBe('get_time');
  });

  test('parses OpenAI-style format', () => {
    const output = `\`\`\`json
{
  "name": "calculator",
  "arguments": {"operation": "multiply", "a": 6, "b": 7}
}
\`\`\``;

    const calls = parseToolCalls(output);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('calculator');
  });

  test('returns empty array for no tool calls', () => {
    const output = 'The answer is 42.';
    const calls = parseToolCalls(output);
    expect(calls).toHaveLength(0);
  });

  test('handles malformed JSON gracefully', () => {
    const output = `\`\`\`json
{invalid json}
\`\`\``;

    const calls = parseToolCalls(output);
    expect(calls).toHaveLength(0);
  });
});

describe('wantsToCallTool', () => {
  test('detects JSON tool call', () => {
    const output = `\`\`\`json
{"tool": "calculator", "parameters": {}}
\`\`\``;

    expect(wantsToCallTool(output, ['calculator'])).toBe(true);
  });

  test('detects "call tool" pattern', () => {
    expect(wantsToCallTool('I will call calculator', ['calculator'])).toBe(true);
  });

  test('detects "use tool" pattern', () => {
    expect(wantsToCallTool('Let me use get_weather', ['get_weather'])).toBe(true);
  });

  test('returns false for regular text', () => {
    expect(wantsToCallTool('The weather is nice today', ['calculator'])).toBe(false);
  });
});

// =============================================================================
// System Prompt Tests
// =============================================================================

describe('generateToolSystemPrompt', () => {
  test('includes tool descriptions', () => {
    const registry = createDefaultRegistry();
    const prompt = generateToolSystemPrompt(registry);

    expect(prompt).toContain('calculator');
    expect(prompt).toContain('get_weather');
    expect(prompt).toContain('get_time');
    expect(prompt).toContain('search');
  });

  test('includes JSON format instructions', () => {
    const registry = createDefaultRegistry();
    const prompt = generateToolSystemPrompt(registry);

    expect(prompt).toContain('"tool"');
    expect(prompt).toContain('"parameters"');
    expect(prompt).toContain('```json');
  });
});

// =============================================================================
// Default Registry Tests
// =============================================================================

describe('createDefaultRegistry', () => {
  test('includes all built-in tools', () => {
    const registry = createDefaultRegistry();

    expect(registry.has('calculator')).toBe(true);
    expect(registry.has('get_weather')).toBe(true);
    expect(registry.has('get_time')).toBe(true);
    expect(registry.has('search')).toBe(true);
  });
});
