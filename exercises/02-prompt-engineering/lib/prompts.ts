/**
 * Prompt Engineering Patterns
 *
 * WHAT YOU'LL LEARN:
 * 1. Zero-shot vs few-shot prompting
 * 2. Chain-of-thought reasoning
 * 3. System prompts and their role
 * 4. Prompt templates and variable interpolation
 *
 * KEY INSIGHT: The same question with different prompting strategies
 * can produce dramatically different results. This exercise lets you
 * compare them side-by-side.
 */

import type { Message } from '../../shared/lib/types';

// =============================================================================
// Prompt Strategies
// =============================================================================

export type PromptStrategy = 'zero-shot' | 'few-shot' | 'chain-of-thought' | 'role-based';

/**
 * Zero-shot: Just ask the question directly
 *
 * Best for: Simple factual questions, when the model "knows" the answer
 * Worst for: Complex reasoning, novel tasks, specific formats
 */
export function buildZeroShotPrompt(task: string): Message[] {
  return [
    { role: 'user', content: task },
  ];
}

/**
 * Few-shot: Provide examples before the actual task
 *
 * Best for: Teaching format, style, or pattern by example
 * Key: Examples should be representative and diverse
 */
export function buildFewShotPrompt(
  task: string,
  examples: Array<{ input: string; output: string }>
): Message[] {
  const messages: Message[] = [];

  // Add examples as user/assistant pairs
  for (const example of examples) {
    messages.push({ role: 'user', content: example.input });
    messages.push({ role: 'assistant', content: example.output });
  }

  // Add the actual task
  messages.push({ role: 'user', content: task });

  return messages;
}

/**
 * Chain-of-Thought: Ask the model to reason step by step
 *
 * Best for: Math, logic, multi-step reasoning
 * Key: The magic words "Let's think step by step" improve accuracy
 */
export function buildChainOfThoughtPrompt(task: string): Message[] {
  return [
    {
      role: 'user',
      content: `${task}

Let's work through this step by step:`,
    },
  ];
}

/**
 * Role-based: Give the model a persona/role
 *
 * Best for: Domain expertise, consistent tone, specific behaviors
 * Key: Be specific about expertise and constraints
 */
export function buildRoleBasedPrompt(
  task: string,
  role: string,
  constraints?: string[]
): Message[] {
  let systemContent = role;

  if (constraints && constraints.length > 0) {
    systemContent += '\n\nConstraints:\n' + constraints.map((c) => `- ${c}`).join('\n');
  }

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: task },
  ];
}

// =============================================================================
// Prompt Templates
// =============================================================================

/**
 * A prompt template with variable interpolation
 *
 * PATTERN: Templates separate the structure from the content.
 * This makes prompts reusable and testable.
 */
export interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
}

/**
 * Render a template by replacing {{variables}}
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Check for any unreplaced variables
  const unreplaced = result.match(/{{(\w+)}}/g);
  if (unreplaced) {
    throw new PromptError(
      `Missing variables: ${unreplaced.join(', ')}`,
      'MISSING_VARIABLES'
    );
  }

  return result;
}

/**
 * Extract variables from a template string
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/{{(\w+)}}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// Pre-built templates for common tasks
export const TEMPLATES: Record<string, PromptTemplate> = {
  summarize: {
    name: 'Summarize',
    description: 'Summarize text in a specific style',
    template: `Summarize the following {{content_type}} in {{length}} sentences.
Focus on: {{focus}}

Content:
{{content}}`,
    variables: ['content_type', 'length', 'focus', 'content'],
  },

  classify: {
    name: 'Classify',
    description: 'Classify content into categories',
    template: `Classify the following into one of these categories: {{categories}}

Content: {{content}}

Category:`,
    variables: ['categories', 'content'],
  },

  extract: {
    name: 'Extract',
    description: 'Extract specific information',
    template: `Extract the following information from the text:
{{fields}}

Text:
{{content}}

Extracted information (JSON):`,
    variables: ['fields', 'content'],
  },

  transform: {
    name: 'Transform',
    description: 'Transform text from one format to another',
    template: `Transform the following {{from_format}} into {{to_format}}.

Input:
{{content}}

Output:`,
    variables: ['from_format', 'to_format', 'content'],
  },
};

// =============================================================================
// Response Analysis
// =============================================================================

export interface PromptComparison {
  strategy: PromptStrategy;
  messages: Message[];
  response?: string;
  latencyMs?: number;
  tokenCount?: number;
}

/**
 * Compare the same task across different prompting strategies
 *
 * This is useful for:
 * - Finding the best strategy for a task type
 * - Understanding how prompting affects quality
 * - Optimizing cost (fewer examples = fewer tokens)
 */
export function buildComparisonPrompts(
  task: string,
  examples: Array<{ input: string; output: string }> = []
): PromptComparison[] {
  return [
    {
      strategy: 'zero-shot',
      messages: buildZeroShotPrompt(task),
    },
    {
      strategy: 'few-shot',
      messages: buildFewShotPrompt(task, examples),
    },
    {
      strategy: 'chain-of-thought',
      messages: buildChainOfThoughtPrompt(task),
    },
    {
      strategy: 'role-based',
      messages: buildRoleBasedPrompt(
        task,
        'You are a helpful assistant who provides clear, accurate answers.'
      ),
    },
  ];
}

// =============================================================================
// Prompt Optimization
// =============================================================================

/**
 * Estimate prompt token count (rough)
 */
export function estimatePromptTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => {
    // Role contributes ~4 tokens, content varies
    return sum + 4 + Math.ceil(msg.content.length / 4);
  }, 0);
}

/**
 * Check if prompt fits in context window
 */
export function validatePromptLength(
  messages: Message[],
  maxContextTokens: number,
  reserveForOutput: number = 1000
): { valid: boolean; estimatedTokens: number; available: number } {
  const estimated = estimatePromptTokens(messages);
  const available = maxContextTokens - reserveForOutput;

  return {
    valid: estimated <= available,
    estimatedTokens: estimated,
    available,
  };
}

// =============================================================================
// Error Handling
// =============================================================================

export class PromptError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_VARIABLES' | 'TOO_LONG' | 'INVALID_TEMPLATE'
  ) {
    super(message);
    this.name = 'PromptError';
  }
}

// =============================================================================
// Example Sets for Different Task Types
// =============================================================================

/**
 * Pre-built example sets for common few-shot tasks
 *
 * PATTERN: Good examples are:
 * 1. Representative of the real task
 * 2. Diverse (cover different cases)
 * 3. Correct (the model learns from them!)
 */
export const EXAMPLE_SETS = {
  sentiment: [
    { input: 'I love this product! Best purchase ever.', output: 'positive' },
    { input: 'Terrible experience. Would not recommend.', output: 'negative' },
    { input: 'It works okay. Nothing special.', output: 'neutral' },
  ],

  questionAnswering: [
    {
      input: 'What is the capital of France?',
      output: 'The capital of France is Paris.',
    },
    {
      input: 'Who wrote Romeo and Juliet?',
      output: 'Romeo and Juliet was written by William Shakespeare.',
    },
  ],

  codeReview: [
    {
      input: 'const x = 1; var y = 2;',
      output: 'Issue: Mixing const and var. Suggestion: Use const or let consistently.',
    },
    {
      input: 'function f(a,b,c,d,e,f,g) {}',
      output: 'Issue: Too many parameters (7). Suggestion: Use an options object instead.',
    },
  ],

  translation: [
    { input: 'Hello, how are you?', output: 'Hola, como estas?' },
    { input: 'Good morning!', output: 'Buenos dias!' },
  ],
};

export type ExampleSetName = keyof typeof EXAMPLE_SETS;
