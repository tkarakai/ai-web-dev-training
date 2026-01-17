# MCP Protocol & Tool Calling

Learn Model Context Protocol concepts through hands-on tool calling demonstrations: weather, calculator, time, and search tools.

## What You'll Learn

- Model Context Protocol (MCP) fundamentals
- Tool discovery and registration
- Structured tool calling with JSON
- Parameter validation with Zod
- Capability scoping and security
- Tool result integration

## Features

### Available Tools

1. **Weather Tool** (`get_weather`)
   - Get current weather for any location
   - Supports celsius/fahrenheit
   - Returns temperature, conditions, humidity

2. **Calculator Tool** (`calculate`)
   - Basic math operations (add, subtract, multiply, divide)
   - Parameter validation
   - Error handling (division by zero)

3. **Time Tool** (`get_current_time`)
   - Current time in any timezone
   - IANA timezone support
   - Fallback to UTC

4. **Search Tool** (`web_search`)
   - Simulated web search
   - Configurable result count
   - Structured result format

## Running This Example

### Prerequisites

**llama-server must be running:**
```bash
llama-server -hf ggml-org/gpt-oss-20b-GGUF --jinja -c 0 --host 127.0.0.1 --port 8033
```

### Start the Example

```bash
# From this directory
bun install
bun run dev

# Open http://localhost:3002
```

**Note**: This example runs on port 3002 (to avoid conflicts with other examples).

## How It Works

### 1. Tool Definition

Tools are defined with:
- **Name**: Unique identifier
- **Description**: What the tool does
- **Parameters**: Zod schema for validation
- **Execute function**: Implementation

```typescript
export const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name or zip code'),
    unit: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  execute: async (params) => {
    // Implementation
  },
};
```

### 2. Tool Discovery

The AI is told what tools are available:

```typescript
const systemPrompt = `You have access to these tools:

Tool: get_weather
Description: Get current weather for a location
Parameters:
  - location: City name or zip code
  - unit: Temperature unit (celsius/fahrenheit)

Tool: calculate
Description: Perform mathematical calculations
Parameters:
  - operation: Math operation (add/subtract/multiply/divide)
  - a: First number
  - b: Second number

...
`;
```

### 3. Tool Calling

The AI decides when to use a tool and provides parameters:

```json
{
  "tool": "get_weather",
  "parameters": {
    "location": "San Francisco",
    "unit": "celsius"
  }
}
```

### 4. Execution & Validation

Parameters are validated and the tool executes:

```typescript
// Validate with Zod
const validatedParams = tool.parameters.parse(params);

// Execute tool
const result = await tool.execute(validatedParams);

// Return result to AI
```

### 5. Result Integration

Tool results feed back to the AI for interpretation:

```
Tool: get_weather
Result: {"location":"San Francisco","temperature":18,"unit":"celsius","conditions":"sunny"}

AI: "It's currently 18°C and sunny in San Francisco."
```

## Try These Examples

### Weather Queries

```
"What's the weather in Tokyo?"
"Is it raining in London?"
"Temperature in New York in fahrenheit"
```

### Calculations

```
"Calculate 42 multiply 17"
"What is 100 subtract 37?"
"Divide 144 by 12"
```

### Time Queries

```
"What time is it in Tokyo?"
"Current time in London"
"Tell me the time in Paris"
```

### Search

```
"Search for TypeScript best practices"
"Find information about React 19"
```

## Key Concepts

### Tool Discovery

The AI needs to know:
- What tools exist
- What each tool does
- What parameters they require
- What format to use

**Best practice**: Provide clear, concise descriptions for tools and parameters.

### Parameter Validation

Use Zod for type-safe parameter validation:

```typescript
const params = z.object({
  location: z.string(),
  unit: z.enum(['celsius', 'fahrenheit']).optional(),
});

// Automatic validation
const validated = params.parse(userInput);
```

**Benefits**:
- Type safety
- Runtime validation
- Clear error messages
- Auto-completion support

### Capability Scoping

Tools should be scoped appropriately:

**Good**:
- `get_weather` - Read-only, safe
- `calculate` - Deterministic, no side effects
- `search_public_web` - Limited scope

**Dangerous without approval**:
- `delete_file` - Destructive
- `execute_code` - Security risk
- `send_email` - Potential abuse

See [Security](../../../docs/04-shipping-ai-features/security.md) for production patterns.

### Error Handling

Tools should handle errors gracefully:

```typescript
execute: async (params) => {
  try {
    const result = await apiCall(params);
    return JSON.stringify(result);
  } catch (error) {
    if (error instanceof APIError) {
      return `Error: ${error.message}`;
    }
    return 'Error: Request failed';
  }
}
```

## MCP in Production

This example demonstrates simplified tool calling. Production MCP implementations include:

### Full MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

Features:
- Standardized protocol
- Server/client architecture
- Streaming support
- Security primitives
- Multi-transport (stdio, HTTP, WebSocket)

### Security Layers

1. **Authentication**: Verify tool callers
2. **Authorization**: Check permissions per tool
3. **Rate limiting**: Prevent abuse
4. **Sandboxing**: Isolate tool execution
5. **Audit logging**: Track all tool calls

### Tool Approval Workflows

For sensitive operations:

```typescript
if (tool.requiresApproval) {
  const approved = await askUserApproval({
    tool: tool.name,
    params,
    risk: tool.risk,
  });

  if (!approved) {
    return 'Tool call denied by user';
  }
}
```

See [Product Patterns](../../../docs/04-shipping-ai-features/product-patterns-ux.md) for approval UX.

### Tool Chaining

Tools can call other tools:

```typescript
// Weather + Recommendation
const weather = await call_tool('get_weather', { location });
const recommendation = await call_tool('recommend_outfit', { weather });
```

## Limitations of This Demo

This is an educational simplified example. It doesn't include:

- Full MCP protocol implementation
- True LLM tool-use integration (uses pattern matching)
- Security layers (authentication, authorization)
- Approval workflows for risky actions
- Tool chaining and composition
- Streaming responses
- Error recovery and retries

For production tool calling, see:
- [API Integration Patterns](../../../docs/04-shipping-ai-features/api-integration.md)
- [Multi-Agent Orchestration](../../../docs/04-shipping-ai-features/multi-agent-orchestration.md)
- [Security](../../../docs/04-shipping-ai-features/security.md)

## Adding Your Own Tools

Create a new tool in `lib/tools.ts`:

```typescript
export const myCustomTool: Tool = {
  name: 'my_tool',
  description: 'What my tool does',
  parameters: z.object({
    param1: z.string().describe('First parameter'),
    param2: z.number().optional().describe('Optional number'),
  }),
  execute: async (params) => {
    // Your implementation
    return 'Result';
  },
};

// Add to AVAILABLE_TOOLS
export const AVAILABLE_TOOLS: Tool[] = [
  weatherTool,
  calculatorTool,
  timeTool,
  searchTool,
  myCustomTool, // Add here
];
```

The tool will automatically appear in the UI!

## Common Patterns

### Read-Only Tools

Safe tools that only retrieve information:

```typescript
{
  name: 'get_user_profile',
  description: 'Get user profile information',
  parameters: z.object({
    userId: z.string(),
  }),
  execute: async ({ userId }) => {
    const profile = await db.users.findUnique({ where: { id: userId } });
    return JSON.stringify(profile);
  },
}
```

### Action Tools

Tools that modify state (need approval):

```typescript
{
  name: 'create_ticket',
  description: 'Create a support ticket',
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  }),
  execute: async (params) => {
    // In production: require approval first
    const ticket = await db.tickets.create({ data: params });
    return `Ticket #${ticket.id} created`;
  },
}
```

### External API Tools

Tools that call external services:

```typescript
{
  name: 'translate_text',
  description: 'Translate text to another language',
  parameters: z.object({
    text: z.string(),
    targetLanguage: z.string(),
  }),
  execute: async ({ text, targetLanguage }) => {
    const response = await fetch('https://api.translate.com/v1/translate', {
      method: 'POST',
      body: JSON.stringify({ text, target: targetLanguage }),
    });
    const data = await response.json();
    return data.translatedText;
  },
}
```

## Related Documentation

- [MCP Protocol Overview](../../../docs/01-core-concepts/mcp-protocol.md) - Full conceptual guide
- [API Integration](../../../docs/04-shipping-ai-features/api-integration.md) - Production patterns
- [Security](../../../docs/04-shipping-ai-features/security.md) - Tool security

## Next Steps

After understanding MCP basics:

1. **01-product-patterns**: Build UIs for tool approval
2. **06-multi-agent**: Use tools in agent workflows
3. **10-security**: Secure tool implementations

## Technical Notes

### Simplified Implementation

This example uses:
- Pattern matching for demo purposes (not real LLM tool calling)
- Simulated external APIs
- In-memory tool registry
- No security layers

### Production Recommendations

For production tool calling:
1. Use the full MCP SDK
2. Implement proper authentication
3. Add approval workflows for risky tools
4. Log all tool executions
5. Handle errors and retries
6. Rate limit tool calls
7. Sandbox tool execution

The later examples in this series demonstrate these production patterns!
