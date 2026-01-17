/**
 * Utilities for working with thinking models and reasoning tokens
 */

// Parse thinking tokens from open source models that expose reasoning
export function parseReasoningResponse(content: string): {
  thinking: string | null;
  answer: string;
} {
  // Match <think>...</think> tags used by models like DeepSeek-R1
  const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
  const answer = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();

  return { thinking, answer };
}

// Format reasoning steps for display
export function formatReasoningSteps(thinking: string): string[] {
  // Split by line breaks and numbered steps
  const lines = thinking.split(/\n/).filter((line) => line.trim());

  // Group related lines together
  const steps: string[] = [];
  let currentStep = '';

  for (const line of lines) {
    // Check if this is a new numbered step
    if (/^\d+\./.test(line.trim()) || /^-\s/.test(line.trim())) {
      if (currentStep) {
        steps.push(currentStep.trim());
      }
      currentStep = line;
    } else {
      currentStep += ' ' + line;
    }
  }

  if (currentStep) {
    steps.push(currentStep.trim());
  }

  return steps.length > 0 ? steps : [thinking];
}

// Estimate token count for thinking budget
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

// Calculate thinking efficiency
export function calculateThinkingEfficiency(
  thinkingTokens: number,
  outputTokens: number,
  correctness: number
): {
  efficiency: number;
  verdict: 'efficient' | 'moderate' | 'inefficient';
  recommendation: string;
} {
  // Efficiency = correctness * output / thinking
  // Higher is better - more correct output per thinking token
  const ratio = outputTokens / (thinkingTokens || 1);
  const efficiency = correctness * ratio;

  let verdict: 'efficient' | 'moderate' | 'inefficient';
  let recommendation: string;

  if (efficiency > 0.8) {
    verdict = 'efficient';
    recommendation = 'Good use of thinking budget. Model is using reasoning effectively.';
  } else if (efficiency > 0.4) {
    verdict = 'moderate';
    recommendation =
      'Consider reducing thinking budget or simplifying the prompt.';
  } else {
    verdict = 'inefficient';
    recommendation =
      'This task may not benefit from thinking mode. Consider using a regular model.';
  }

  return { efficiency, verdict, recommendation };
}

// Problem complexity classifier for routing decisions
export function classifyProblemComplexity(prompt: string): {
  complexity: 'simple' | 'moderate' | 'complex';
  useThinking: boolean;
  reason: string;
} {
  const prompt_lower = prompt.toLowerCase();

  // Indicators of complex reasoning needs
  const complexIndicators = [
    'prove',
    'derive',
    'optimize',
    'analyze',
    'compare',
    'evaluate',
    'design',
    'architect',
    'debug',
    'trace',
    'step by step',
    'systematically',
    'trade-off',
    'tradeoff',
  ];

  // Indicators of math/logic problems
  const mathIndicators = [
    'calculate',
    'solve',
    'equation',
    'formula',
    'if and only if',
    'therefore',
    'given that',
    'probability',
    'permutation',
    'combination',
  ];

  // Indicators of simple tasks (don't need thinking)
  const simpleIndicators = [
    'translate',
    'summarize',
    'list',
    'define',
    'what is',
    'who is',
    'when was',
    'hello',
    'hi ',
    'thanks',
  ];

  const hasComplex = complexIndicators.some((i) => prompt_lower.includes(i));
  const hasMath = mathIndicators.some((i) => prompt_lower.includes(i));
  const hasSimple = simpleIndicators.some((i) => prompt_lower.includes(i));

  // Multiple questions or bullets suggest complexity
  const hasMultipleParts =
    (prompt.match(/\?/g) || []).length > 1 ||
    (prompt.match(/^\d+\./gm) || []).length > 1;

  // Long prompts with specific requirements
  const isLongWithRequirements = prompt.length > 500 && prompt.includes('must');

  if (hasSimple && !hasComplex && !hasMath) {
    return {
      complexity: 'simple',
      useThinking: false,
      reason: 'Simple factual or generative task - regular model is sufficient',
    };
  }

  if (hasComplex || hasMath || hasMultipleParts || isLongWithRequirements) {
    return {
      complexity: 'complex',
      useThinking: true,
      reason:
        'Complex reasoning, math, or multi-part problem - thinking model recommended',
    };
  }

  return {
    complexity: 'moderate',
    useThinking: false,
    reason:
      'Moderate complexity - regular model with chain-of-thought prompting may be sufficient',
  };
}

// Sample problems for the demo
export const sampleProblems = {
  simple: {
    label: 'Simple (Translation)',
    prompt: 'Translate "Hello, how are you?" to French.',
    expectedBenefit: 'minimal',
  },
  moderate: {
    label: 'Moderate (Explanation)',
    prompt:
      'Explain the difference between REST and GraphQL APIs in terms of data fetching patterns.',
    expectedBenefit: 'slight',
  },
  complex: {
    label: 'Complex (Algorithm)',
    prompt:
      'Design an algorithm to find the longest increasing subsequence in an array of integers. Explain the time and space complexity trade-offs between different approaches.',
    expectedBenefit: 'significant',
  },
  math: {
    label: 'Math Problem',
    prompt:
      'A train leaves station A at 9:00 AM traveling 60 mph toward station B. Another train leaves station B at 10:00 AM traveling 90 mph toward station A. If the stations are 300 miles apart, at what time will the trains meet?',
    expectedBenefit: 'significant',
  },
  logic: {
    label: 'Logic Puzzle',
    prompt:
      'Three friends each own a different pet (cat, dog, fish) and live in different colored houses (red, blue, green). The person with the cat does not live in the red house. Sarah lives in the blue house. The dog owner lives next to the green house. Mark owns the fish. Who owns what pet and lives in which house?',
    expectedBenefit: 'significant',
  },
  code: {
    label: 'Code Review',
    prompt: `Review this code for bugs and suggest improvements:
\`\`\`javascript
function findDuplicates(arr) {
  let seen = [];
  let duplicates = [];
  for (var i = 0; i < arr.length; i++) {
    if (seen.includes(arr[i])) {
      duplicates.push(arr[i]);
    }
    seen.push(arr[i]);
  }
  return duplicates;
}
\`\`\``,
    expectedBenefit: 'significant',
  },
};

export type SampleProblemKey = keyof typeof sampleProblems;
