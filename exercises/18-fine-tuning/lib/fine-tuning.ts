/**
 * Fine-Tuning with MLX
 *
 * Prepare data and train custom models on Mac using MLX.
 *
 * KEY CONCEPTS:
 * 1. Training data format - JSONL with prompt/completion pairs
 * 2. Data preparation - Convert your data to training format
 * 3. LoRA training - Parameter-efficient fine-tuning
 * 4. Evaluation - Compare before/after performance
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingExample {
  prompt: string;
  completion: string;
}

export interface ConversationExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

export interface DatasetStats {
  totalExamples: number;
  avgPromptLength: number;
  avgCompletionLength: number;
  minPromptLength: number;
  maxPromptLength: number;
  minCompletionLength: number;
  maxCompletionLength: number;
}

export interface TrainingConfig {
  model: string;
  dataPath: string;
  outputPath: string;
  iters: number;
  batchSize: number;
  learningRate: number;
  loraLayers: number;
  loraRank: number;
  seed: number;
}

export interface EvalResult {
  prompt: string;
  expectedCompletion: string;
  actualCompletion: string;
  matchScore: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  model: 'Qwen/Qwen3-0.6B',
  dataPath: './training-data',
  outputPath: './adapters',
  iters: 1000,
  batchSize: 4,
  learningRate: 1e-5,
  loraLayers: 16,
  loraRank: 8,
  seed: 42,
};

// =============================================================================
// DATA FORMATTING
// =============================================================================

/**
 * Format a single example for training
 * MLX expects JSONL with "text" field containing the full formatted prompt
 */
export function formatTrainingExample(example: TrainingExample): string {
  // Format as instruction-following
  const formatted = `<|im_start|>user\n${example.prompt}<|im_end|>\n<|im_start|>assistant\n${example.completion}<|im_end|>`;
  return JSON.stringify({ text: formatted });
}

/**
 * Format conversation for training
 */
export function formatConversationExample(example: ConversationExample): string {
  let formatted = '';
  for (const msg of example.messages) {
    formatted += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }
  return JSON.stringify({ text: formatted.trim() });
}

/**
 * Convert training examples to JSONL format
 */
export function toJSONL(examples: TrainingExample[]): string {
  return examples.map(formatTrainingExample).join('\n');
}

/**
 * Convert conversation examples to JSONL format
 */
export function conversationsToJSONL(examples: ConversationExample[]): string {
  return examples.map(formatConversationExample).join('\n');
}

/**
 * Parse JSONL back to examples
 */
export function parseJSONL(jsonl: string): Array<{ text: string }> {
  return jsonl
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// =============================================================================
// DATA VALIDATION
// =============================================================================

/**
 * Validate training example
 */
export function validateExample(example: TrainingExample): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!example.prompt || example.prompt.trim().length === 0) {
    errors.push('Prompt is empty');
  }

  if (!example.completion || example.completion.trim().length === 0) {
    errors.push('Completion is empty');
  }

  if (example.prompt && example.prompt.length > 4096) {
    errors.push('Prompt exceeds 4096 characters');
  }

  if (example.completion && example.completion.length > 4096) {
    errors.push('Completion exceeds 4096 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate dataset
 */
export function validateDataset(examples: TrainingExample[]): {
  valid: boolean;
  validCount: number;
  invalidCount: number;
  errors: Array<{ index: number; errors: string[] }>;
} {
  const results = examples.map((ex, index) => ({
    index,
    ...validateExample(ex),
  }));

  const invalid = results.filter((r) => !r.valid);

  return {
    valid: invalid.length === 0,
    validCount: results.filter((r) => r.valid).length,
    invalidCount: invalid.length,
    errors: invalid.map((r) => ({ index: r.index, errors: r.errors })),
  };
}

// =============================================================================
// DATASET STATISTICS
// =============================================================================

/**
 * Calculate dataset statistics
 */
export function calculateStats(examples: TrainingExample[]): DatasetStats {
  if (examples.length === 0) {
    return {
      totalExamples: 0,
      avgPromptLength: 0,
      avgCompletionLength: 0,
      minPromptLength: 0,
      maxPromptLength: 0,
      minCompletionLength: 0,
      maxCompletionLength: 0,
    };
  }

  const promptLengths = examples.map((e) => e.prompt.length);
  const completionLengths = examples.map((e) => e.completion.length);

  return {
    totalExamples: examples.length,
    avgPromptLength: Math.round(
      promptLengths.reduce((a, b) => a + b, 0) / examples.length
    ),
    avgCompletionLength: Math.round(
      completionLengths.reduce((a, b) => a + b, 0) / examples.length
    ),
    minPromptLength: Math.min(...promptLengths),
    maxPromptLength: Math.max(...promptLengths),
    minCompletionLength: Math.min(...completionLengths),
    maxCompletionLength: Math.max(...completionLengths),
  };
}

// =============================================================================
// TRAIN/VAL SPLIT
// =============================================================================

/**
 * Split dataset into train and validation sets
 */
export function splitDataset<T>(
  data: T[],
  trainRatio: number = 0.9,
  shuffle: boolean = true,
  seed?: number
): { train: T[]; valid: T[] } {
  let items = [...data];

  if (shuffle) {
    // Simple seeded shuffle
    const random = seed !== undefined ? seededRandom(seed) : Math.random;
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  const splitIndex = Math.floor(items.length * trainRatio);

  return {
    train: items.slice(0, splitIndex),
    valid: items.slice(splitIndex),
  };
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// =============================================================================
// MLX COMMAND GENERATION
// =============================================================================

/**
 * Generate MLX training command
 */
export function generateTrainingCommand(config: Partial<TrainingConfig> = {}): string {
  const c = { ...DEFAULT_TRAINING_CONFIG, ...config };

  return `uvx --from mlx-lm mlx_lm.lora \\
  --model ${c.model} \\
  --train \\
  --data ${c.dataPath} \\
  --iters ${c.iters} \\
  --batch-size ${c.batchSize} \\
  --learning-rate ${c.learningRate} \\
  --lora-layers ${c.loraLayers} \\
  --lora-rank ${c.loraRank} \\
  --seed ${c.seed} \\
  --adapter-path ${c.outputPath}`;
}

/**
 * Generate MLX evaluation command
 */
export function generateEvalCommand(
  modelPath: string,
  adapterPath: string,
  prompt: string
): string {
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  return `uvx --from mlx-lm mlx_lm.generate \\
  --model ${modelPath} \\
  --adapter-path ${adapterPath} \\
  --prompt '${escapedPrompt}' \\
  --max-tokens 200`;
}

/**
 * Generate MLX fuse command (merge adapter into model)
 */
export function generateFuseCommand(
  modelPath: string,
  adapterPath: string,
  outputPath: string
): string {
  return `uvx --from mlx-lm mlx_lm.fuse \\
  --model ${modelPath} \\
  --adapter-path ${adapterPath} \\
  --save-path ${outputPath}`;
}

// =============================================================================
// SAMPLE DATASETS
// =============================================================================

/**
 * Sample dataset: Customer support responses
 */
export const SAMPLE_SUPPORT_DATA: TrainingExample[] = [
  {
    prompt: 'How do I reset my password?',
    completion:
      'To reset your password, click the "Forgot Password" link on the login page. Enter your email address, and we\'ll send you a reset link. The link expires in 24 hours.',
  },
  {
    prompt: "I can't log into my account",
    completion:
      'I\'m sorry you\'re having trouble logging in. Please try these steps: 1) Clear your browser cache, 2) Make sure Caps Lock is off, 3) Try the "Forgot Password" option. If issues persist, I can help reset your account.',
  },
  {
    prompt: 'How do I cancel my subscription?',
    completion:
      'You can cancel your subscription anytime from Account Settings > Subscription > Cancel Plan. Your access continues until the current billing period ends. Would you like me to walk you through it?',
  },
  {
    prompt: 'Where can I find my invoice?',
    completion:
      'Your invoices are available in Account Settings > Billing > Invoice History. You can download PDFs or have them emailed to you. Need help finding a specific invoice?',
  },
  {
    prompt: 'The app is running slowly',
    completion:
      'Sorry about the slow performance. Try these quick fixes: 1) Refresh the page, 2) Clear browser cache, 3) Disable browser extensions. If it\'s still slow, let me know your browser and I\'ll investigate further.',
  },
];

/**
 * Sample dataset: Code explanation
 */
export const SAMPLE_CODE_DATA: TrainingExample[] = [
  {
    prompt: 'Explain this code: const doubled = arr.map(x => x * 2)',
    completion:
      'This code uses the `map` array method to create a new array where each element is doubled. The arrow function `x => x * 2` takes each element `x` and returns `x * 2`. The original array `arr` is not modified.',
  },
  {
    prompt: 'Explain this code: const unique = [...new Set(arr)]',
    completion:
      'This creates an array of unique values from `arr`. `new Set(arr)` creates a Set (which only stores unique values), and the spread operator `...` converts it back to an array. Duplicates are removed.',
  },
  {
    prompt: 'Explain this code: arr.filter(Boolean)',
    completion:
      'This filters out all falsy values from the array. `Boolean` is used as the filter function, which returns `false` for falsy values (null, undefined, 0, "", false, NaN) and `true` for truthy values.',
  },
  {
    prompt: 'Explain this code: Object.entries(obj).map(([k, v]) => ...)',
    completion:
      '`Object.entries(obj)` converts an object to an array of [key, value] pairs. The `map` then iterates over these pairs, with destructuring `[k, v]` extracting the key and value for each entry.',
  },
];

/**
 * Sample dataset: Style transfer (formal to casual)
 */
export const SAMPLE_STYLE_DATA: TrainingExample[] = [
  {
    prompt: 'Make casual: We regret to inform you that your request has been denied.',
    completion: "Sorry, but we can't approve your request this time.",
  },
  {
    prompt:
      'Make casual: Please be advised that the meeting has been rescheduled to a later date.',
    completion: "Heads up - we've moved the meeting to a later date.",
  },
  {
    prompt: 'Make casual: Your inquiry has been received and is being processed.',
    completion: "Got your message! We're working on it.",
  },
  {
    prompt: 'Make casual: We would like to express our gratitude for your continued patronage.',
    completion: 'Thanks so much for sticking with us!',
  },
];

// =============================================================================
// EVALUATION HELPERS
// =============================================================================

/**
 * Simple string similarity score (Jaccard index on words)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Evaluate model on test set
 */
export function evaluateResults(results: EvalResult[]): {
  avgScore: number;
  passRate: number;
  results: EvalResult[];
} {
  const scores = results.map((r) => r.matchScore);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const passRate = scores.filter((s) => s >= 0.5).length / scores.length;

  return {
    avgScore,
    passRate,
    results,
  };
}

// =============================================================================
// FILE STRUCTURE GENERATOR
// =============================================================================

/**
 * Generate the file structure for a fine-tuning project
 */
export function generateProjectStructure(projectName: string): string {
  return `${projectName}/
├── training-data/
│   ├── train.jsonl      # Training examples (90%)
│   └── valid.jsonl      # Validation examples (10%)
├── adapters/            # LoRA adapter weights (created by training)
├── fused-model/         # Full merged model (optional)
├── scripts/
│   ├── prepare-data.ts  # Data preparation script
│   ├── train.sh         # Training command
│   └── evaluate.ts      # Evaluation script
└── README.md`;
}

/**
 * Generate a training script template
 */
export function generateTrainScript(config: Partial<TrainingConfig> = {}): string {
  return `#!/bin/bash
# Fine-tune with MLX LoRA

set -e

echo "Starting fine-tuning..."
${generateTrainingCommand(config)}

echo "Training complete! Adapter saved to ${config.outputPath || './adapters'}"
echo ""
echo "To test the model:"
echo "uvx --from mlx-lm mlx_lm.generate --model ${config.model || DEFAULT_TRAINING_CONFIG.model} --adapter-path ${config.outputPath || './adapters'} --prompt 'Your prompt here'"
`;
}
