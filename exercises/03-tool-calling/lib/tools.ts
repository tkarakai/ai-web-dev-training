/**
 * Tool Calling - Let the LLM invoke functions
 *
 * WHAT YOU'LL LEARN:
 * 1. Defining tools with Zod schemas
 * 2. Building a tool registry
 * 3. Parsing LLM output to extract tool calls
 * 4. Executing tools and returning results
 * 5. The agent loop pattern
 *
 * KEY INSIGHT: Tools extend what LLMs can do. The LLM decides WHAT to call,
 * your code decides HOW to execute it (and what's allowed).
 */

import { z } from 'zod';

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * A tool the LLM can call
 *
 * PATTERN: Use Zod for parameter validation.
 * This gives you:
 * - Runtime validation
 * - TypeScript types
 * - Automatic JSON Schema generation
 */
export interface Tool<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (params: z.infer<TParams>) => Promise<string> | string;
}

/**
 * Create a tool with type inference
 */
export function defineTool<TParams extends z.ZodTypeAny>(
  config: Tool<TParams>
): Tool<TParams> {
  return config;
}

// =============================================================================
// Built-in Tools
// =============================================================================

/**
 * Calculator tool - performs basic math
 */
export const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform basic mathematical calculations. Supports add, subtract, multiply, divide.',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: ({ operation, a, b }) => {
    switch (operation) {
      case 'add':
        return `${a} + ${b} = ${a + b}`;
      case 'subtract':
        return `${a} - ${b} = ${a - b}`;
      case 'multiply':
        return `${a} * ${b} = ${a * b}`;
      case 'divide':
        if (b === 0) return 'Error: Division by zero';
        return `${a} / ${b} = ${a / b}`;
    }
  },
});

/**
 * Weather tool - returns mock weather data
 */
export const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: z.object({
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: ({ city, unit }) => {
    // Mock data - in production, call a weather API
    const temp = Math.floor(Math.random() * 30) + 5;
    const conditions = ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)];
    const displayTemp = unit === 'fahrenheit' ? Math.round(temp * 9 / 5 + 32) : temp;
    const unitSymbol = unit === 'fahrenheit' ? 'F' : 'C';

    return `Weather in ${city}: ${displayTemp}${unitSymbol}, ${conditions}`;
  },
});

/**
 * Time tool - returns current time
 */
export const timeTool = defineTool({
  name: 'get_time',
  description: 'Get current time in a timezone',
  parameters: z.object({
    timezone: z.string().default('UTC').describe('Timezone (e.g., "America/New_York", "UTC")'),
  }),
  execute: ({ timezone }) => {
    try {
      const time = new Date().toLocaleString('en-US', { timeZone: timezone });
      return `Current time in ${timezone}: ${time}`;
    } catch {
      return `Error: Unknown timezone "${timezone}"`;
    }
  },
});

/**
 * Search tool - simulates web search
 */
export const searchTool = defineTool({
  name: 'search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().min(1).max(10).default(3),
  }),
  execute: ({ query, maxResults }) => {
    // Mock results - in production, call a search API
    const mockResults = [
      { title: `${query} - Wikipedia`, snippet: `Overview of ${query}...` },
      { title: `Understanding ${query}`, snippet: `A comprehensive guide to ${query}...` },
      { title: `${query} explained`, snippet: `Everything you need to know about ${query}...` },
    ];

    return mockResults
      .slice(0, maxResults)
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}`)
      .join('\n\n');
  },
});

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * A registry of available tools
 *
 * PATTERN: Centralize tool management for:
 * - Easy tool discovery
 * - Consistent execution
 * - Access control (which tools are available)
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(`Tool "${tool.name}" is already registered`, 'DUPLICATE_TOOL');
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool by name with given parameters
   */
  async execute(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${name}`,
        output: '',
      };
    }

    // Validate parameters
    const parseResult = tool.parameters.safeParse(params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parseResult.error.message}`,
        output: '',
      };
    }

    // Execute
    try {
      const output = await tool.execute(parseResult.data);
      return { success: true, output, error: undefined };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        output: '',
      };
    }
  }

  /**
   * Generate tool descriptions for the LLM prompt
   */
  getToolDescriptions(): string {
    return this.list()
      .map((tool) => {
        const params = zodToDescription(tool.parameters);
        return `- ${tool.name}: ${tool.description}\n  Parameters: ${params}`;
      })
      .join('\n\n');
  }
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// =============================================================================
// Tool Call Parsing
// =============================================================================

/**
 * Parsed tool call from LLM output
 */
export interface ParsedToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

/**
 * Parse tool calls from LLM output
 *
 * LLMs can output tool calls in various formats. This parser handles:
 * - JSON blocks: ```json { "tool": "...", "parameters": {...} } ```
 * - Function-style: tool_name(param1, param2)
 * - Natural language with JSON
 */
export function parseToolCalls(output: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  // Try JSON blocks first (most reliable)
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  let match;

  while ((match = jsonBlockRegex.exec(output)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && parsed.parameters) {
        calls.push({
          name: parsed.tool,
          parameters: parsed.parameters,
        });
      } else if (parsed.name && parsed.arguments) {
        // OpenAI-style format
        calls.push({
          name: parsed.name,
          parameters: parsed.arguments,
        });
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // If no JSON blocks, try inline JSON
  if (calls.length === 0) {
    const inlineJsonRegex = /\{[^{}]*"tool"[^{}]*\}/g;
    while ((match = inlineJsonRegex.exec(output)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.tool && parsed.parameters) {
          calls.push({
            name: parsed.tool,
            parameters: parsed.parameters,
          });
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return calls;
}

/**
 * Check if output indicates the LLM wants to call a tool
 */
export function wantsToCallTool(output: string, toolNames: string[]): boolean {
  // Check for JSON tool call format
  if (parseToolCalls(output).length > 0) {
    return true;
  }

  // Check for tool name mentions in common patterns
  const lowerOutput = output.toLowerCase();
  for (const name of toolNames) {
    if (
      lowerOutput.includes(`use ${name}`) ||
      lowerOutput.includes(`call ${name}`) ||
      lowerOutput.includes(`calling ${name}`) ||
      lowerOutput.includes(`"tool": "${name}"`)
    ) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// System Prompt for Tool Use
// =============================================================================

/**
 * Generate a system prompt that teaches the LLM how to use tools
 */
export function generateToolSystemPrompt(registry: ToolRegistry): string {
  return `You are a helpful assistant with access to tools.

## Available Tools

${registry.getToolDescriptions()}

## How to Use Tools

When you need information from a tool, you MUST output a JSON block in your response like this:

\`\`\`json
{
  "tool": "tool_name",
  "parameters": {
    "param1": "value1"
  }
}
\`\`\`

## Examples

User: "What's 5 times 3?"
Assistant:
\`\`\`json
{
  "tool": "calculator",
  "parameters": {
    "operation": "multiply",
    "a": 5,
    "b": 3
  }
}
\`\`\`

User: "What's the weather in Paris?"
Assistant:
\`\`\`json
{
  "tool": "get_weather",
  "parameters": {
    "city": "Paris"
  }
}
\`\`\`

## Important Rules

1. When you need a tool, output ONLY the JSON block - nothing else
2. After receiving tool results, incorporate them into a natural response
3. For multiple tools, output each JSON block one after another
4. For simple questions not needing tools, answer directly`;
}

// =============================================================================
// Agent Loop
// =============================================================================

export interface AgentStep {
  type: 'thought' | 'tool_call' | 'tool_result' | 'response';
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
}

/**
 * Run an agent loop that can call tools
 *
 * PATTERN: The agent loop:
 * 1. Send user message to LLM
 * 2. Check if LLM wants to call a tool
 * 3. If yes: execute tool, send result back to LLM, goto 2
 * 4. If no: return final response
 */
export async function runAgentLoop(
  userMessage: string,
  registry: ToolRegistry,
  llmCall: (messages: Array<{ role: string; content: string }>) => Promise<string>,
  maxIterations: number = 5
): Promise<{ response: string; steps: AgentStep[] }> {
  const systemPrompt = generateToolSystemPrompt(registry);
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  const steps: AgentStep[] = [];
  const toolNames = registry.list().map((t) => t.name);

  for (let i = 0; i < maxIterations; i++) {
    // Get LLM response
    const llmResponse = await llmCall(messages);
    messages.push({ role: 'assistant', content: llmResponse });

    // Check for tool calls
    const toolCalls = parseToolCalls(llmResponse);

    if (toolCalls.length === 0) {
      // No tool call - this is the final response
      steps.push({ type: 'response', content: llmResponse });
      return { response: llmResponse, steps };
    }

    // Execute each tool call
    for (const call of toolCalls) {
      steps.push({
        type: 'tool_call',
        content: `Calling ${call.name}`,
        toolName: call.name,
        toolParams: call.parameters,
      });

      const result = await registry.execute(call.name, call.parameters);

      const resultMessage = result.success
        ? `Tool result for ${call.name}: ${result.output}`
        : `Tool error for ${call.name}: ${result.error}`;

      steps.push({ type: 'tool_result', content: resultMessage });
      messages.push({ role: 'user', content: resultMessage });
    }
  }

  // Max iterations reached
  const finalResponse = messages[messages.length - 1].content;
  return { response: finalResponse, steps };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert Zod schema to human-readable description
 */
function zodToDescription(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const fields = Object.entries(shape).map(([key, value]) => {
      const zodValue = value as z.ZodTypeAny;
      const desc = zodValue.description || '';
      const type = getZodTypeName(zodValue);
      return `${key} (${type})${desc ? `: ${desc}` : ''}`;
    });
    return `{ ${fields.join(', ')} }`;
  }
  return 'unknown';
}

function getZodTypeName(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodEnum) return schema.options.join(' | ');
  if (schema instanceof z.ZodDefault) return getZodTypeName(schema._def.innerType);
  if (schema instanceof z.ZodOptional) return `${getZodTypeName(schema._def.innerType)}?`;
  return 'unknown';
}

// =============================================================================
// Errors
// =============================================================================

export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: 'DUPLICATE_TOOL' | 'UNKNOWN_TOOL' | 'INVALID_PARAMS' | 'EXECUTION_ERROR'
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

// =============================================================================
// Default Registry
// =============================================================================

/**
 * Create a registry with all built-in tools
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(calculatorTool);
  registry.register(weatherTool);
  registry.register(timeTool);
  registry.register(searchTool);
  return registry;
}
