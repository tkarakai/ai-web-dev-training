import { z } from 'zod';

// Simple extraction schema
export const ContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;

// Classification schema
export const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
  summary: z.string(),
});

export type Sentiment = z.infer<typeof SentimentSchema>;

// Complex nested schema
export const ProductReviewSchema = z.object({
  product: z.object({
    name: z.string(),
    category: z.string(),
    price: z.number().optional(),
  }),
  rating: z.number().min(1).max(5),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  recommendation: z.enum(['strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'strongly_not_recommend']),
  summary: z.string().max(200),
});

export type ProductReview = z.infer<typeof ProductReviewSchema>;

// Event extraction schema
export const EventSchema = z.object({
  title: z.string(),
  date: z.string().describe('ISO 8601 date format'),
  time: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type Event = z.infer<typeof EventSchema>;

// Code analysis schema
export const CodeAnalysisSchema = z.object({
  language: z.string(),
  complexity: z.enum(['low', 'medium', 'high']),
  issues: z.array(z.object({
    type: z.enum(['bug', 'security', 'performance', 'style']),
    description: z.string(),
    line: z.number().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  suggestions: z.array(z.string()),
  overallQuality: z.number().min(1).max(10),
});

export type CodeAnalysis = z.infer<typeof CodeAnalysisSchema>;

// Schema registry
export const SCHEMAS = {
  contact: {
    name: 'Contact Extraction',
    description: 'Extract contact information from text',
    schema: ContactSchema,
    example: 'Please reach out to John Smith at john.smith@example.com or call (555) 123-4567. He works at Acme Corp.',
  },
  sentiment: {
    name: 'Sentiment Analysis',
    description: 'Analyze sentiment with confidence score',
    schema: SentimentSchema,
    example: 'I absolutely love this product! It exceeded all my expectations and the customer service was fantastic.',
  },
  product_review: {
    name: 'Product Review',
    description: 'Structured product review with ratings',
    schema: ProductReviewSchema,
    example: 'The new MacBook Pro M3 is amazing. Great performance and battery life. A bit pricey at $2000 but worth it. Screen could be brighter though.',
  },
  event: {
    name: 'Event Extraction',
    description: 'Extract event details from text',
    schema: EventSchema,
    example: 'Team meeting scheduled for March 15, 2024 at 2:00 PM in Conference Room A. Attendees: Alice, Bob, and Charlie. We will discuss Q1 results.',
  },
  code_analysis: {
    name: 'Code Analysis',
    description: 'Analyze code for issues and quality',
    schema: CodeAnalysisSchema,
    example: `function processUser(user) {
  if (user.name == null) return;
  console.log(user.password);
  for (let i = 0; i < 1000; i++) {
    fetch('/api/user/' + user.id);
  }
}`,
  },
} as const;

export type SchemaKey = keyof typeof SCHEMAS;

// Helper to generate JSON schema from Zod
export function zodToJsonSchema(schema: z.ZodType): object {
  // Simplified JSON schema generation
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      properties[key] = zodToJsonSchema(zodValue);

      if (!(zodValue instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema._def.type),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema._def.values,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }

  return { type: 'unknown' };
}

// Attempt to repair malformed JSON
export function repairJson(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // Find JSON object boundaries
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Fix common issues
  cleaned = cleaned
    .replace(/,\s*}/g, '}') // trailing commas
    .replace(/,\s*]/g, ']') // trailing commas in arrays
    .replace(/'/g, '"') // single quotes to double quotes
    .replace(/(\w+):/g, '"$1":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"'); // single-quoted values

  return cleaned;
}

// Extract JSON from mixed text
export function extractJson(text: string): string | null {
  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return repairJson(objectMatch[0]);
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return repairJson(arrayMatch[0]);
  }

  return null;
}
