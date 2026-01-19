# Exercise 03: Tool Calling

Let the LLM invoke functions. Learn how to define tools with Zod schemas and build an agent loop.

## What You'll Learn

1. **Tool definitions with Zod** - Type-safe parameter validation
2. **Tool registry pattern** - Centralized tool management
3. **Parsing LLM output** - Extract tool calls from text
4. **Agent loop** - Iterative tool execution

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/tools.ts       <- THE MAIN FILE - tool definitions, registry, agent loop
lib/tools.test.ts  <- Tests for tools and parsing
```

## Key Concepts

### Defining Tools with Zod

```typescript
import { z } from 'zod';

const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Perform basic math',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: ({ operation, a, b }) => {
    switch (operation) {
      case 'add': return `${a + b}`;
      // ...
    }
  },
});
```

Why Zod?
- Runtime validation (LLM output can be invalid)
- TypeScript types for free
- Automatic JSON Schema generation

### Tool Registry Pattern

```typescript
class ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  async execute(name: string, params: unknown): Promise<ToolResult>;
}
```

Benefits:
- Single source of truth for available tools
- Easy to add/remove tools per user or context
- Consistent error handling

### Parsing Tool Calls

LLMs output tool calls as text. We need to parse them:

```typescript
function parseToolCalls(output: string): ParsedToolCall[] {
  // Look for JSON blocks: ```json { "tool": "...", "parameters": {...} } ```
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  // Parse and validate...
}
```

### The Agent Loop

```typescript
async function runAgentLoop(userMessage, registry, llmCall, maxIterations) {
  const messages = [
    { role: 'system', content: generateToolSystemPrompt(registry) },
    { role: 'user', content: userMessage },
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await llmCall(messages);
    const toolCalls = parseToolCalls(response);

    if (toolCalls.length === 0) {
      return response; // Final answer
    }

    // Execute tools and add results to messages
    for (const call of toolCalls) {
      const result = await registry.execute(call.name, call.parameters);
      messages.push({ role: 'user', content: `Tool result: ${result.output}` });
    }
  }
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests (no server needed)
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3003 to try the agent.

## Debugging Tips

If the agent isn't responding correctly, open your browser's Developer Tools (F12) and check the Network tab to inspect the raw HTTP requests and responses to/from llama-server. This helps identify if the model is returning malformed responses.

## Code Patterns to Note

### 1. Type-Safe Tool Definition

```typescript
// The generic ensures parameters and execute are compatible
export function defineTool<TParams extends z.ZodTypeAny>(
  config: Tool<TParams>
): Tool<TParams> {
  return config;
}
```

### 2. Safe Parse with Error Messages

```typescript
const parseResult = tool.parameters.safeParse(params);
if (!parseResult.success) {
  return {
    success: false,
    error: `Invalid parameters: ${parseResult.error.message}`,
  };
}
```

### 3. System Prompt Generation

```typescript
function generateToolSystemPrompt(registry: ToolRegistry): string {
  return `You have access to these tools:
${registry.getToolDescriptions()}

When you need a tool, respond with:
\`\`\`json
{"tool": "tool_name", "parameters": {...}}
\`\`\``;
}
```

## Exercises to Try

1. **Add a new tool** - Create a tool for something useful (e.g., random number, date formatting)
2. **Add tool approval** - Modify the agent loop to ask for confirmation before executing
3. **Chain tools** - Make a tool that calls other tools (e.g., "smart search" that searches then summarizes)
4. **Add tool timeouts** - Wrap execute with a timeout to prevent hanging

## Security Considerations

- **Validate everything** - LLM output is untrusted
- **Limit tool scope** - Don't give tools more power than needed
- **Rate limit** - Prevent runaway agent loops
- **Log everything** - Track what tools were called and why

## Next Exercise

[Exercise 04: Streaming Responses](../04-streaming) - Real-time token-by-token output.
