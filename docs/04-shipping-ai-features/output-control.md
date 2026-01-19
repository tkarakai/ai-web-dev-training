# Output Control and Reliability

Making AI outputs parseable, predictable, and safe for production consumption.

## TL;DR

- Use **structured outputs** with JSON schemas—don't parse free-form text
- Implement **validators and repair loops** for handling malformed outputs
- **Streaming** improves perceived latency but complicates parsing
- Design for **non-determinism**: behavioral tests, fuzzy assertions, multiple runs
- Treat AI outputs as untrusted input to your system

## Core Concepts

### Structured Outputs

Free-form text is hard to parse reliably. Use structured outputs.

**JSON schema enforcement:**

```typescript
// OpenAI structured output
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'product_analysis',
      strict: true,  // Enforce exact schema
      schema: {
        type: 'object',
        properties: {
          sentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative'],
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          keyPhrases: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
          },
          summary: {
            type: 'string',
            maxLength: 200,
          },
        },
        required: ['sentiment', 'confidence', 'summary'],
        additionalProperties: false,
      },
    },
  },
});

const result = JSON.parse(response.choices[0].message.content);
// TypeScript knows the shape
```

**Anthropic structured output:**

```typescript
// Using tool_choice to force structured response
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages,
  tools: [
    {
      name: 'respond',
      description: 'Provide analysis in structured format',
      input_schema: {
        type: 'object',
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          confidence: { type: 'number' },
          summary: { type: 'string' },
        },
        required: ['sentiment', 'confidence', 'summary'],
      },
    },
  ],
  tool_choice: { type: 'tool', name: 'respond' },
});

// Extract from tool use
const toolUse = response.content.find(block => block.type === 'tool_use');
const result = toolUse.input;
```

### Validation and Repair Loops

Even with schemas, validate outputs before use.

```typescript
import { z } from 'zod';

// Define schema with Zod for runtime validation
const AnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
  keyPhrases: z.array(z.string()).max(5).optional(),
  summary: z.string().max(200),
});

type Analysis = z.infer<typeof AnalysisSchema>;

async function getAnalysisWithValidation(
  input: string,
  maxRetries = 3
): Promise<Analysis> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await generateAnalysis(input);

    try {
      // Parse JSON
      const parsed = JSON.parse(response);

      // Validate against schema
      const validated = AnalysisSchema.parse(parsed);

      return validated;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to get valid analysis after ${maxRetries} attempts`);
      }

      // Log for debugging
      console.warn(`Validation failed on attempt ${attempt + 1}`, {
        response,
        error: error.message,
      });

      // Optionally: repair prompt
      if (error instanceof z.ZodError) {
        // Tell the model what was wrong
        await generateAnalysis(input, {
          repairContext: `Previous response had validation errors: ${error.message}`,
        });
      }
    }
  }
}
```

**Repair prompting:**

```typescript
async function repairOutput<T>(
  original: string,
  schema: z.ZodSchema<T>,
  errors: z.ZodError
): Promise<T> {
  const repairPrompt = `
The following JSON has validation errors:

\`\`\`json
${original}
\`\`\`

Errors:
${errors.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')}

Please fix the JSON to match the required schema. Return only valid JSON.
`;

  const repaired = await llm.chat({ messages: [{ role: 'user', content: repairPrompt }] });
  return schema.parse(JSON.parse(repaired.content));
}
```

### Tool/Function Calling

Let models invoke structured functions instead of generating free-form responses.

```typescript
// Define tools
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search product catalog',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: { type: 'string', enum: ['electronics', 'clothing', 'home'] },
          maxPrice: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Check status of an order',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
        },
        required: ['orderId'],
      },
    },
  },
];

// Handle tool calls
async function handleToolCall(toolCall: ToolCall): Promise<string> {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  switch (name) {
    case 'search_products':
      return JSON.stringify(await searchProducts(parsedArgs));
    case 'get_order_status':
      return JSON.stringify(await getOrderStatus(parsedArgs.orderId));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

**Tool call validation:**

```typescript
// Validate before executing
function validateToolCall(toolCall: ToolCall): { valid: boolean; errors?: string[] } {
  const schema = toolSchemas[toolCall.function.name];
  if (!schema) {
    return { valid: false, errors: [`Unknown tool: ${toolCall.function.name}`] };
  }

  try {
    const args = JSON.parse(toolCall.function.arguments);
    schema.parse(args);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.errors.map(e => e.message) };
    }
    return { valid: false, errors: ['Invalid JSON arguments'] };
  }
}
```

### Streaming and Partial Parsing

Streaming improves UX but complicates parsing.

```typescript
// Stream text for display, accumulate for parsing
async function streamWithParsing<T>(
  stream: AsyncIterable<ChatCompletionChunk>,
  onChunk: (text: string) => void,
  schema: z.ZodSchema<T>
): Promise<T> {
  let accumulated = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    accumulated += delta;
    onChunk(delta);  // Update UI
  }

  // Parse complete response
  return schema.parse(JSON.parse(accumulated));
}

// Streaming with structured output
async function streamStructured(prompt: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    stream: true,
  });

  let buffer = '';
  const partialResults: Partial<Analysis>[] = [];

  for await (const chunk of stream) {
    buffer += chunk.choices[0]?.delta?.content || '';

    // Try to parse partial JSON (for progress indication)
    try {
      const partial = partialParse(buffer);
      if (partial) {
        partialResults.push(partial);
        onPartialResult(partial);
      }
    } catch {
      // Not yet valid JSON, continue accumulating
    }
  }

  return JSON.parse(buffer);
}
```

### Reproducibility Strategies

AI outputs vary. Design for this.

**Behavioral testing:**

```typescript
// Test behavior, not exact output
describe('product search', () => {
  it('should return relevant results', async () => {
    const results = await searchWithAI('wireless headphones under $100');

    // Don't assert exact results
    // Assert behavioral properties
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.category === 'electronics')).toBe(true);
    expect(results.every(r => r.price <= 100)).toBe(true);
  });

  it('should be consistent across runs', async () => {
    const runs = await Promise.all([
      searchWithAI('laptop'),
      searchWithAI('laptop'),
      searchWithAI('laptop'),
    ]);

    // Check for reasonable consistency
    const allProductIds = runs.map(r => new Set(r.map(p => p.id)));
    const intersection = setIntersection(...allProductIds);

    // At least 50% overlap expected
    expect(intersection.size / runs[0].length).toBeGreaterThan(0.5);
  });
});
```

**Snapshot testing with fuzzy matching:**

```typescript
// Custom matcher for AI outputs
expect.extend({
  toMatchAISnapshot(received: string, expected: string) {
    // Semantic similarity instead of exact match
    const similarity = calculateSimilarity(received, expected);

    if (similarity > 0.8) {
      return { pass: true, message: () => '' };
    }

    return {
      pass: false,
      message: () =>
        `Expected semantic similarity > 0.8, got ${similarity}\n` +
        `Expected: ${expected}\n` +
        `Received: ${received}`,
    };
  },
});
```

### Output Sanitization

Treat AI output as untrusted input.

```typescript
// Before rendering in UI
function sanitizeForDisplay(content: string): string {
  // Remove potential XSS
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

// Before using in database queries
function sanitizeForQuery(content: string): string {
  // Use parameterized queries instead
  throw new Error('Never interpolate AI output into queries');
}

// Before executing as code
function sanitizeForExecution(content: string): { safe: boolean; code?: string } {
  // Validate against allowlist of patterns
  const allowedPatterns = [/^[\w\s\.\(\)=]+$/];

  if (!allowedPatterns.some(p => p.test(content))) {
    return { safe: false };
  }

  return { safe: true, code: content };
}
```

## Common Pitfalls

- **Parsing free-form text.** Use structured outputs; don't regex parse prose.
- **No validation.** Schema enforcement isn't enough; validate business rules.
- **Testing exact outputs.** AI varies; test behavior and properties.
- **Trusting AI output.** Sanitize before display, storage, or execution.

## Related

- [Prompting](../01-core-concepts/prompting.md) — Getting structured outputs
- [Testing and Quality](../03-ai-assisted-development/testing-quality.md) — Testing strategies

## Previous

- [Message Design and Application State](./message-design-state.md)

## Next

- [API Integration Patterns](./api-integration.md)
