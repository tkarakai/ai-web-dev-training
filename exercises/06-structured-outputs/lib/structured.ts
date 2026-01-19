/**
 * Structured Outputs - Force LLM outputs to match TypeScript types
 *
 * WHAT YOU'LL LEARN:
 * 1. JSON extraction from LLM responses
 * 2. Zod schema validation
 * 3. Repair loops for invalid outputs
 * 4. Prompt engineering for structured data
 *
 * KEY INSIGHT: LLMs don't always return valid JSON. You need validation,
 * error handling, and retry logic to get reliable structured data.
 */

import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface ExtractionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  rawOutput?: string;
}

export interface ExtractionOptions {
  maxRetries?: number;
  includeRawOutput?: boolean;
}

// =============================================================================
// JSON Extraction
// =============================================================================

/**
 * Extract JSON from LLM output
 *
 * LLMs often wrap JSON in markdown code blocks or add explanatory text.
 * This function handles common formats.
 */
export function extractJSON(text: string): string | null {
  // Try 1: Look for JSON code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try 2: Look for raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  // Try 3: Look for raw JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}

/**
 * Parse extracted JSON safely
 */
export function parseJSON(text: string): { success: boolean; data?: unknown; error?: string } {
  try {
    const jsonStr = extractJSON(text);
    if (!jsonStr) {
      return { success: false, error: 'No JSON found in text' };
    }
    const data = JSON.parse(jsonStr);
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Parse error',
    };
  }
}

// =============================================================================
// Schema-Based Extraction
// =============================================================================

/**
 * Extract and validate data against a Zod schema
 */
export function extractWithSchema<T extends z.ZodTypeAny>(
  text: string,
  schema: T
): ExtractionResult<z.infer<T>> {
  const parseResult = parseJSON(text);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
      attempts: 1,
      rawOutput: text,
    };
  }

  const validationResult = schema.safeParse(parseResult.data);

  if (!validationResult.success) {
    return {
      success: false,
      error: formatZodError(validationResult.error),
      attempts: 1,
      rawOutput: text,
    };
  }

  return {
    success: true,
    data: validationResult.data,
    attempts: 1,
  };
}

// =============================================================================
// Repair Loop
// =============================================================================

/**
 * Extract with automatic retry on validation failure
 *
 * PATTERN: When extraction fails, send the error back to the LLM
 * and ask it to fix the output. This often works!
 */
export async function extractWithRepair<T extends z.ZodTypeAny>(
  generateFn: (prompt: string) => Promise<string>,
  initialPrompt: string,
  schema: T,
  options: ExtractionOptions = {}
): Promise<ExtractionResult<z.infer<T>>> {
  const { maxRetries = 3, includeRawOutput = false } = options;

  let prompt = initialPrompt;
  let lastError: string | undefined;
  let lastRawOutput: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await generateFn(prompt);
    lastRawOutput = response;

    const result = extractWithSchema(response, schema);

    if (result.success) {
      return {
        ...result,
        attempts: attempt,
        rawOutput: includeRawOutput ? response : undefined,
      };
    }

    lastError = result.error;

    // Build repair prompt for next attempt
    prompt = buildRepairPrompt(initialPrompt, response, result.error!);
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
    attempts: maxRetries,
    rawOutput: includeRawOutput ? lastRawOutput : undefined,
  };
}

/**
 * Build a prompt that asks the LLM to fix its previous output
 */
function buildRepairPrompt(
  originalPrompt: string,
  previousOutput: string,
  error: string
): string {
  return `${originalPrompt}

Your previous response had an error:
"""
${previousOutput.slice(0, 500)}${previousOutput.length > 500 ? '...' : ''}
"""

Error: ${error}

Please fix the error and provide valid JSON.`;
}

// =============================================================================
// Prompt Templates for Structured Output
// =============================================================================

/**
 * Generate a prompt that encourages structured output
 */
export function buildStructuredPrompt(
  task: string,
  schema: z.ZodTypeAny,
  examples?: Array<{ input: string; output: unknown }>
): string {
  const schemaDescription = zodToDescription(schema);

  let prompt = `${task}

Respond with a JSON object matching this schema:
${schemaDescription}

Important:
- Return ONLY valid JSON, no explanations
- Use the exact field names specified
- Ensure all required fields are present`;

  if (examples && examples.length > 0) {
    prompt += '\n\nExamples:';
    for (const ex of examples) {
      prompt += `\nInput: ${ex.input}\nOutput: ${JSON.stringify(ex.output)}`;
    }
  }

  return prompt;
}

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * Schema for sentiment analysis
 */
export const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).optional(),
});

export type Sentiment = z.infer<typeof SentimentSchema>;

/**
 * Schema for entity extraction
 */
export const EntitySchema = z.object({
  entities: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['person', 'organization', 'location', 'date', 'other']),
      startIndex: z.number().optional(),
    })
  ),
});

export type EntityResult = z.infer<typeof EntitySchema>;

/**
 * Schema for summarization
 */
export const SummarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  wordCount: z.number(),
});

export type Summary = z.infer<typeof SummarySchema>;

/**
 * Schema for classification
 */
export const ClassificationSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  alternativeCategories: z.array(
    z.object({
      category: z.string(),
      confidence: z.number(),
    })
  ).optional(),
});

export type Classification = z.infer<typeof ClassificationSchema>;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format Zod error into readable message
 */
function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}

/**
 * Convert Zod schema to human-readable description
 */
function zodToDescription(schema: z.ZodTypeAny, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const fields = Object.entries(shape).map(([key, value]) => {
      const zodValue = value as z.ZodTypeAny;
      return `${spaces}  "${key}": ${zodToDescription(zodValue, indent + 1)}`;
    });
    return `{\n${fields.join(',\n')}\n${spaces}}`;
  }

  if (schema instanceof z.ZodArray) {
    return `[${zodToDescription(schema._def.type, indent)}]`;
  }

  if (schema instanceof z.ZodEnum) {
    return schema.options.map((o: string) => `"${o}"`).join(' | ');
  }

  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodOptional) {
    return `${zodToDescription(schema._def.innerType, indent)} (optional)`;
  }

  return 'unknown';
}

/**
 * Create a schema from TypeScript type (for documentation)
 */
export function createSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape);
}
