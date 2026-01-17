/**
 * Example tools demonstrating MCP-style tool calling
 *
 * In production, these would be exposed via MCP servers
 */

import { z } from 'zod';

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (params: any) => Promise<string> | string;
}

// Weather Tool
export const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name or zip code'),
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature unit'),
  }),
  execute: async (params: { location: string; unit?: string }) => {
    // Simulate API call
    const temp = Math.floor(Math.random() * 30) + 10;
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)];
    const unit = params.unit || 'celsius';

    return JSON.stringify({
      location: params.location,
      temperature: temp,
      unit,
      conditions,
      humidity: Math.floor(Math.random() * 40) + 40,
    });
  },
};

// Calculator Tool
export const calculatorTool: Tool = {
  name: 'calculate',
  description: 'Perform mathematical calculations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Math operation'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: (params: { operation: string; a: number; b: number }) => {
    let result: number;
    switch (params.operation) {
      case 'add':
        result = params.a + params.b;
        break;
      case 'subtract':
        result = params.a - params.b;
        break;
      case 'multiply':
        result = params.a * params.b;
        break;
      case 'divide':
        if (params.b === 0) return 'Error: Division by zero';
        result = params.a / params.b;
        break;
      default:
        return 'Error: Unknown operation';
    }
    return `${params.a} ${params.operation} ${params.b} = ${result}`;
  },
};

// Time Tool
export const timeTool: Tool = {
  name: 'get_current_time',
  description: 'Get the current time in a specific timezone',
  parameters: z.object({
    timezone: z.string().optional().describe('IANA timezone name (e.g., America/New_York)'),
  }),
  execute: (params: { timezone?: string }) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: params.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    };

    try {
      const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
      return `Current time: ${timeString}`;
    } catch (error) {
      return `Current time (UTC): ${now.toUTCString()}`;
    }
  },
};

// Search Tool (simulated)
export const searchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('Search query'),
    max_results: z.number().optional().describe('Maximum number of results (default: 5)'),
  }),
  execute: async (params: { query: string; max_results?: number }) => {
    // Simulate search results
    const results = [
      { title: 'Result 1', snippet: `Information about ${params.query}` },
      { title: 'Result 2', snippet: `More details on ${params.query}` },
      { title: 'Result 3', snippet: `Expert opinion on ${params.query}` },
    ].slice(0, params.max_results || 5);

    return JSON.stringify({ query: params.query, results }, null, 2);
  },
};

// All available tools
export const AVAILABLE_TOOLS: Tool[] = [
  weatherTool,
  calculatorTool,
  timeTool,
  searchTool,
];

// Tool registry for easy lookup
export const toolRegistry = new Map<string, Tool>(
  AVAILABLE_TOOLS.map((tool) => [tool.name, tool])
);

/**
 * Execute a tool by name with parameters
 */
export async function executeTool(name: string, params: any): Promise<string> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  try {
    // Validate parameters
    const validatedParams = tool.parameters.parse(params);

    // Execute tool
    const result = await tool.execute(validatedParams);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `Parameter validation error: ${error.errors.map(e => e.message).join(', ')}`;
    }
    throw error;
  }
}

/**
 * Format tools for LLM consumption
 */
export function formatToolsForLLM(): string {
  return AVAILABLE_TOOLS.map((tool) => {
    const schema = tool.parameters.shape;
    const params = Object.entries(schema).map(([key, value]: [string, any]) => {
      const desc = value.description || '';
      return `  - ${key}: ${desc}`;
    }).join('\n');

    return `Tool: ${tool.name}
Description: ${tool.description}
Parameters:
${params}`;
  }).join('\n\n');
}
