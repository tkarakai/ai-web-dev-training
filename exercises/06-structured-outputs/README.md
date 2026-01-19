# Exercise 06: Structured Outputs

Force LLM outputs to match TypeScript types. Learn JSON extraction, Zod validation, and repair loops.

## What You'll Learn

1. **JSON extraction** - Parse JSON from LLM text output
2. **Zod validation** - Validate structure against schemas
3. **Repair loops** - Retry with error feedback when validation fails
4. **Prompt engineering** - Write prompts that encourage valid JSON

## Prerequisites

**llama-server must be running:**

```bash
llama-server -m your-model.gguf --port 8033
```

## The Code to Study

```
lib/structured.ts       <- THE MAIN FILE - extraction, validation, repair
lib/structured.test.ts  <- Tests for JSON parsing and schemas
```

## Key Concepts

### The Problem

LLMs don't reliably produce valid JSON:
- May wrap JSON in markdown code blocks
- May add explanatory text
- May have typos or missing fields
- May use wrong types

### Solution 1: JSON Extraction

```typescript
function extractJSON(text: string): string | null {
  // Try code block: ```json {...} ```
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // Try raw JSON
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return null;
}
```

### Solution 2: Zod Validation

```typescript
import { z } from 'zod';

const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
});

function extractWithSchema(text: string, schema: z.ZodTypeAny) {
  const json = parseJSON(text);
  if (!json.success) return { success: false, error: json.error };

  const result = schema.safeParse(json.data);
  return result;
}
```

### Solution 3: Repair Loop

```typescript
async function extractWithRepair(generate, prompt, schema, { maxRetries = 3 }) {
  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await generate(currentPrompt);
    const result = extractWithSchema(response, schema);

    if (result.success) return result;

    // Build repair prompt
    currentPrompt = `${prompt}

Your previous response had an error: ${result.error}
Please fix and return valid JSON.`;
  }

  return { success: false, error: 'Max retries exceeded' };
}
```

## Run the Exercise

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the UI (requires llama-server)
bun dev
```

Open http://localhost:3006 to try structured extraction.

## Code Patterns to Note

### 1. Type-Safe Schema Definition

```typescript
const Schema = z.object({
  name: z.string(),
  age: z.number().min(0),
  email: z.string().email().optional(),
});

type SchemaType = z.infer<typeof Schema>;
// TypeScript knows the exact shape!
```

### 2. Prompts for Structured Output

```typescript
function buildStructuredPrompt(task: string, schema: z.ZodTypeAny): string {
  return `${task}

Respond with a JSON object matching this schema:
${zodToDescription(schema)}

Important:
- Return ONLY valid JSON, no explanations
- Use the exact field names specified
- Ensure all required fields are present`;
}
```

### 3. Graceful Error Handling

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  // result.error has detailed info
  const message = result.error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}
```

## Common Schemas

```typescript
// Sentiment analysis
const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).optional(),
});

// Entity extraction
const EntitySchema = z.object({
  entities: z.array(z.object({
    text: z.string(),
    type: z.enum(['person', 'organization', 'location', 'date', 'other']),
  })),
});

// Classification
const ClassificationSchema = z.object({
  category: z.string(),
  confidence: z.number(),
  alternatives: z.array(z.object({
    category: z.string(),
    confidence: z.number(),
  })).optional(),
});
```

## Exercises to Try

1. **Add a new schema** - Create a schema for product review extraction
2. **Improve the repair prompt** - Make the error feedback more helpful
3. **Add streaming extraction** - Parse partial JSON as it arrives
4. **Build schema inference** - Auto-generate schemas from examples

## Tips for Better Results

1. **Be explicit about format** - "Return ONLY JSON, no other text"
2. **Show examples** - Few-shot prompting helps with structure
3. **Use enums** - Constrain string fields to valid values
4. **Start simple** - Nested schemas are harder for LLMs
5. **Test edge cases** - Empty inputs, long inputs, special characters

## Next Exercise

[Exercise 07: API Resilience](../07-api-resilience) - Build production-grade API integration with caching, retry, and rate limiting.
