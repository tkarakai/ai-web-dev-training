/**
 * Chain-of-Thought Reasoning
 *
 * Patterns for improving LLM accuracy through step-by-step reasoning.
 *
 * KEY CONCEPTS:
 * 1. CoT prompting - Adding "think step by step" improves reasoning
 * 2. Step extraction - Parse reasoning steps from response
 * 3. Self-consistency - Multiple reasoning paths, vote on answer
 * 4. Accuracy measurement - Compare against known correct answers
 */

import { LlamaClient, type Message } from '../../shared/lib/llama-client';

// =============================================================================
// TYPES
// =============================================================================

export interface ReasoningStep {
  stepNumber: number;
  content: string;
}

export interface CoTResponse {
  fullResponse: string;
  steps: ReasoningStep[];
  finalAnswer: string;
  confidence: number;
}

export interface Problem {
  id: string;
  question: string;
  correctAnswer: string;
  category: 'math' | 'logic' | 'word' | 'reasoning';
}

export interface EvalResult {
  problem: Problem;
  response: CoTResponse;
  isCorrect: boolean;
  latencyMs: number;
}

// =============================================================================
// CHAIN-OF-THOUGHT PROMPTS
// =============================================================================

/**
 * Standard Chain-of-Thought prompt wrapper
 *
 * Research shows that simply adding "Let's think step by step" can
 * significantly improve reasoning performance on many tasks.
 */
export function buildCoTPrompt(question: string): string {
  return `${question}

Let's think through this step by step:`;
}

/**
 * Structured CoT prompt with explicit format
 *
 * More structured prompts can help extract reasoning steps programmatically.
 */
export function buildStructuredCoTPrompt(question: string): string {
  return `${question}

Please solve this step by step. Format your response as:

Step 1: [First step of reasoning]
Step 2: [Second step of reasoning]
...
Final Answer: [Your answer]`;
}

/**
 * Self-consistency prompt (for multiple samples)
 *
 * Generate multiple reasoning paths and vote on the most common answer.
 */
export function buildSelfConsistencyPrompt(question: string): string {
  return `${question}

Think through this carefully, showing your reasoning. End with "Therefore, the answer is: [answer]"`;
}

/**
 * Zero-shot prompt (baseline for comparison)
 */
export function buildZeroShotPrompt(question: string): string {
  return `${question}

Answer:`;
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Extract numbered steps from a CoT response
 *
 * Handles various formats:
 * - "Step 1: ..." / "Step 2: ..."
 * - "1. ..." / "2. ..."
 * - "First, ..." / "Second, ..." / "Finally, ..."
 */
export function extractSteps(response: string): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Try numbered format first: "Step N:" or "N."
  const numberedPattern = /(?:Step\s*)?(\d+)[.):]\s*(.+?)(?=(?:Step\s*)?\d+[.):]\s*|Final\s*Answer:|Therefore|$)/gis;
  let match;

  while ((match = numberedPattern.exec(response)) !== null) {
    const content = match[2].trim();
    if (content && content.length > 5) {
      // Skip very short matches
      steps.push({
        stepNumber: parseInt(match[1]),
        content: content.replace(/\n+/g, ' ').trim(),
      });
    }
  }

  if (steps.length > 0) {
    return steps;
  }

  // Try ordinal format: "First,", "Second,", etc.
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'then', 'next', 'finally'];
  const ordinalPattern = new RegExp(
    `(${ordinals.join('|')})[,:]?\\s*(.+?)(?=${ordinals.join('|')}|final\\s*answer|therefore|$)`,
    'gis'
  );

  let stepNum = 1;
  while ((match = ordinalPattern.exec(response)) !== null) {
    const content = match[2].trim();
    if (content && content.length > 10) {
      steps.push({
        stepNumber: stepNum++,
        content: content.replace(/\n+/g, ' ').trim(),
      });
    }
  }

  // If no structured steps found, split by sentences as fallback
  if (steps.length === 0) {
    const sentences = response
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    // Take first few sentences as "steps"
    sentences.slice(0, 5).forEach((sentence, i) => {
      steps.push({
        stepNumber: i + 1,
        content: sentence,
      });
    });
  }

  return steps;
}

/**
 * Extract the final answer from a CoT response
 *
 * Looks for patterns like:
 * - "Final Answer: X"
 * - "Therefore, the answer is X"
 * - "The answer is X"
 * - Last number/word in response
 */
export function extractFinalAnswer(response: string): string {
  // Try explicit markers first
  const patterns = [
    /Final\s*Answer[:\s]+(.+?)(?:\.|$)/i,
    /Therefore,?\s*(?:the\s+)?answer\s+is[:\s]+(.+?)(?:\.|$)/i,
    /(?:The|So\s+the)\s+answer\s+is[:\s]+(.+?)(?:\.|$)/i,
    /(?:=|equals)\s*(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) {
      return normalizeAnswer(match[1]);
    }
  }

  // Fallback: extract last number or short phrase
  const numbers = response.match(/\b\d+(?:\.\d+)?\b/g);
  if (numbers && numbers.length > 0) {
    return numbers[numbers.length - 1];
  }

  // Last resort: last sentence
  const sentences = response.split(/[.!?]+/).filter((s) => s.trim());
  if (sentences.length > 0) {
    return normalizeAnswer(sentences[sentences.length - 1]);
  }

  return response.trim().slice(-50);
}

/**
 * Normalize answer for comparison
 */
export function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '');
}

/**
 * Check if two answers match
 */
export function answersMatch(answer1: string, answer2: string): boolean {
  const norm1 = normalizeAnswer(answer1);
  const norm2 = normalizeAnswer(answer2);

  // Exact match
  if (norm1 === norm2) return true;

  // Numeric comparison (handle "42" vs "42.0")
  const num1 = parseFloat(norm1);
  const num2 = parseFloat(norm2);
  if (!isNaN(num1) && !isNaN(num2)) {
    return Math.abs(num1 - num2) < 0.001;
  }

  // Substring match for short answers
  if (norm1.length < 20 || norm2.length < 20) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  return false;
}

// =============================================================================
// CONFIDENCE ESTIMATION
// =============================================================================

/**
 * Estimate confidence based on response characteristics
 *
 * Higher confidence when:
 * - More reasoning steps
 * - Explicit answer marker
 * - Consistent numbers throughout
 */
export function estimateConfidence(response: string, steps: ReasoningStep[]): number {
  let confidence = 0.5; // Base confidence

  // More steps = more thorough reasoning
  if (steps.length >= 3) confidence += 0.1;
  if (steps.length >= 5) confidence += 0.1;

  // Explicit answer marker
  if (/Final\s*Answer|Therefore.*answer/i.test(response)) {
    confidence += 0.15;
  }

  // Contains calculations
  if (/\d+\s*[+\-*/=]\s*\d+/.test(response)) {
    confidence += 0.05;
  }

  // Hedging language reduces confidence
  if (/maybe|probably|i think|not sure|might be/i.test(response)) {
    confidence -= 0.15;
  }

  return Math.max(0, Math.min(1, confidence));
}

// =============================================================================
// SELF-CONSISTENCY
// =============================================================================

/**
 * Run self-consistency: generate multiple responses and vote on answer
 *
 * This technique improves accuracy by:
 * 1. Generating N different reasoning paths
 * 2. Extracting the answer from each
 * 3. Returning the most common answer (majority vote)
 */
export async function selfConsistency(
  client: LlamaClient,
  question: string,
  numSamples: number = 3
): Promise<{ answer: string; votes: Map<string, number>; responses: CoTResponse[] }> {
  const responses: CoTResponse[] = [];
  const votes = new Map<string, number>();

  // Generate multiple responses with temperature > 0 for diversity
  for (let i = 0; i < numSamples; i++) {
    const prompt = buildSelfConsistencyPrompt(question);
    const result = await client.chat([{ role: 'user', content: prompt }], {
      temperature: 0.7, // Higher temp for diverse reasoning paths
      maxTokens: 500,
    });

    const steps = extractSteps(result);
    const answer = extractFinalAnswer(result);
    const normalizedAnswer = normalizeAnswer(answer);

    responses.push({
      fullResponse: result,
      steps,
      finalAnswer: answer,
      confidence: estimateConfidence(result, steps),
    });

    votes.set(normalizedAnswer, (votes.get(normalizedAnswer) || 0) + 1);
  }

  // Find majority answer
  let maxVotes = 0;
  let majorityAnswer = '';
  for (const [answer, count] of votes) {
    if (count > maxVotes) {
      maxVotes = count;
      majorityAnswer = answer;
    }
  }

  return { answer: majorityAnswer, votes, responses };
}

// =============================================================================
// EVALUATION
// =============================================================================

/**
 * Test problems for evaluating CoT effectiveness
 */
export const TEST_PROBLEMS: Problem[] = [
  // Math problems
  {
    id: 'math-1',
    question: 'If a train travels 60 miles in 1.5 hours, what is its average speed in miles per hour?',
    correctAnswer: '40',
    category: 'math',
  },
  {
    id: 'math-2',
    question: 'A store offers 25% off. If an item costs $80, what is the sale price?',
    correctAnswer: '60',
    category: 'math',
  },
  {
    id: 'math-3',
    question: 'If 3x + 7 = 22, what is x?',
    correctAnswer: '5',
    category: 'math',
  },

  // Logic problems
  {
    id: 'logic-1',
    question:
      'All roses are flowers. Some flowers fade quickly. Can we conclude that some roses fade quickly?',
    correctAnswer: 'no',
    category: 'logic',
  },
  {
    id: 'logic-2',
    question:
      'If it rains, the ground gets wet. The ground is wet. Did it definitely rain?',
    correctAnswer: 'no',
    category: 'logic',
  },

  // Word problems
  {
    id: 'word-1',
    question:
      'Sarah has 3 apples. She gives half to Tom and buys 4 more. How many apples does Sarah have?',
    correctAnswer: '5.5',
    category: 'word',
  },
  {
    id: 'word-2',
    question:
      'A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left?',
    correctAnswer: '9',
    category: 'word',
  },

  // Reasoning problems
  {
    id: 'reason-1',
    question:
      'In a race, you overtake the person in 2nd place. What position are you in now?',
    correctAnswer: '2nd',
    category: 'reasoning',
  },
  {
    id: 'reason-2',
    question:
      "A bat and ball cost $1.10 together. The bat costs $1 more than the ball. How much does the ball cost?",
    correctAnswer: '0.05',
    category: 'reasoning',
  },
];

/**
 * Run CoT evaluation on a single problem
 */
export async function evaluateProblem(
  client: LlamaClient,
  problem: Problem,
  useCoT: boolean = true
): Promise<EvalResult> {
  const start = Date.now();

  const prompt = useCoT
    ? buildStructuredCoTPrompt(problem.question)
    : buildZeroShotPrompt(problem.question);

  const result = await client.chat([{ role: 'user', content: prompt }], {
    temperature: 0,
    maxTokens: 500,
  });

  const steps = extractSteps(result);
  const finalAnswer = extractFinalAnswer(result);

  const response: CoTResponse = {
    fullResponse: result,
    steps,
    finalAnswer,
    confidence: estimateConfidence(result, steps),
  };

  return {
    problem,
    response,
    isCorrect: answersMatch(finalAnswer, problem.correctAnswer),
    latencyMs: Date.now() - start,
  };
}

/**
 * Run evaluation on all test problems
 */
export async function runEvaluation(
  client: LlamaClient,
  useCoT: boolean = true
): Promise<{
  results: EvalResult[];
  accuracy: number;
  avgLatencyMs: number;
  byCategory: Map<string, { correct: number; total: number }>;
}> {
  const results: EvalResult[] = [];
  const byCategory = new Map<string, { correct: number; total: number }>();

  for (const problem of TEST_PROBLEMS) {
    const result = await evaluateProblem(client, problem, useCoT);
    results.push(result);

    // Track by category
    const cat = byCategory.get(problem.category) || { correct: 0, total: 0 };
    cat.total++;
    if (result.isCorrect) cat.correct++;
    byCategory.set(problem.category, cat);
  }

  const correct = results.filter((r) => r.isCorrect).length;
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    results,
    accuracy: correct / results.length,
    avgLatencyMs: totalLatency / results.length,
    byCategory,
  };
}

// =============================================================================
// CHAIN-OF-THOUGHT CLIENT
// =============================================================================

/**
 * CoT-enhanced LLM client
 *
 * Wraps the base client with chain-of-thought prompting and
 * response parsing built in.
 */
export class CoTClient {
  private client: LlamaClient;

  constructor(baseUrl: string = 'http://127.0.0.1:8033') {
    this.client = new LlamaClient(baseUrl);
  }

  /**
   * Ask a question with chain-of-thought reasoning
   */
  async ask(question: string, options: { structured?: boolean } = {}): Promise<CoTResponse> {
    const prompt = options.structured
      ? buildStructuredCoTPrompt(question)
      : buildCoTPrompt(question);

    const result = await this.client.chat([{ role: 'user', content: prompt }], {
      temperature: 0,
      maxTokens: 500,
    });

    const steps = extractSteps(result);
    const finalAnswer = extractFinalAnswer(result);

    return {
      fullResponse: result,
      steps,
      finalAnswer,
      confidence: estimateConfidence(result, steps),
    };
  }

  /**
   * Ask with self-consistency (multiple reasoning paths)
   */
  async askWithConsistency(
    question: string,
    numSamples: number = 3
  ): Promise<{ answer: string; confidence: number; responses: CoTResponse[] }> {
    const { answer, votes, responses } = await selfConsistency(this.client, question, numSamples);

    // Confidence based on agreement
    const maxVotes = Math.max(...votes.values());
    const confidence = maxVotes / numSamples;

    return { answer, confidence, responses };
  }

  /**
   * Compare CoT vs zero-shot on test problems
   */
  async compareApproaches(): Promise<{
    zeroShot: { accuracy: number; avgLatencyMs: number };
    chainOfThought: { accuracy: number; avgLatencyMs: number };
  }> {
    const zeroShot = await runEvaluation(this.client, false);
    const chainOfThought = await runEvaluation(this.client, true);

    return {
      zeroShot: { accuracy: zeroShot.accuracy, avgLatencyMs: zeroShot.avgLatencyMs },
      chainOfThought: { accuracy: chainOfThought.accuracy, avgLatencyMs: chainOfThought.avgLatencyMs },
    };
  }
}
