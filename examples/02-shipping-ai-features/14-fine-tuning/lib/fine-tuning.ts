/**
 * Fine-tuning utilities
 * - Decision framework
 * - Data collection and validation
 * - Training simulation
 * - Evaluation comparison
 * - Lifecycle management
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export type ApproachLevel = 'prompting' | 'rag' | 'fine-tuning' | 'custom-model';
export type DataSource = 'human' | 'production' | 'synthetic';
export type DataQuality = 'verified' | 'unverified' | 'rejected';
export type ModelStatus = 'training' | 'evaluating' | 'staging' | 'production' | 'deprecated';

export interface TrainingExample {
  id: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  source: DataSource;
  quality: DataQuality;
  feedbackScore?: number;
  createdAt: Date;
  issues?: string[];
}

export interface DatasetMetrics {
  total: number;
  bySource: Record<DataSource, number>;
  byQuality: Record<DataQuality, number>;
  avgTokens: number;
  avgFeedbackScore: number;
}

export interface EvalResults {
  accuracy: number;
  formatCompliance: number;
  latencyMs: number;
  costPerRequest: number;
  qualityScore: number;
}

export interface ModelVersion {
  id: string;
  name: string;
  baseModel: string;
  status: ModelStatus;
  trainedAt?: Date;
  datasetSize: number;
  evalResults?: EvalResults;
  comparisonToBase?: {
    accuracyDelta: number;
    latencyDelta: number;
    costDelta: number;
  };
}

export interface TrainingJob {
  id: string;
  modelName: string;
  baseModel: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  epochs: number;
  currentEpoch: number;
  trainingLoss?: number;
  validationLoss?: number;
  startedAt?: Date;
  completedAt?: Date;
  events: TrainingEvent[];
}

export interface TrainingEvent {
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

// Decision framework
export interface DecisionNode {
  level: ApproachLevel;
  question: string;
  recommendation: string;
  cost: string;
  time: string;
  when: string[];
  whenNot: string[];
}

export const decisionFramework: DecisionNode[] = [
  {
    level: 'prompting',
    question: 'Can better prompting solve it?',
    recommendation: 'Try clear instructions, examples, and constraints first',
    cost: 'Low ($0-100)',
    time: 'Hours',
    when: [
      'Output format needs adjustment',
      'Need specific writing style',
      'Task can be explained with examples',
    ],
    whenNot: [
      'Need domain-specific knowledge',
      'Prompt is already very long',
      'Response quality is inconsistent',
    ],
  },
  {
    level: 'rag',
    question: 'Can RAG/context solve it?',
    recommendation: 'Provide relevant documents and knowledge base',
    cost: 'Medium ($100-1000)',
    time: 'Days',
    when: [
      'Need up-to-date information',
      'Need to cite sources',
      'Knowledge changes frequently',
    ],
    whenNot: [
      'Need consistent output format',
      'Problem is style, not knowledge',
      'Latency is critical',
    ],
  },
  {
    level: 'fine-tuning',
    question: 'Is fine-tuning appropriate?',
    recommendation: 'Train on high-quality domain-specific examples',
    cost: 'High ($1000-10000)',
    time: 'Weeks',
    when: [
      'Need consistent domain terminology',
      'Need specific output format',
      'Have high-quality training data',
      'Want to reduce prompt size',
    ],
    whenNot: [
      'Requirements change frequently',
      'Have less than 100 examples',
      'Need new factual knowledge',
    ],
  },
  {
    level: 'custom-model',
    question: 'Do you need a custom model?',
    recommendation: 'Build or train from scratch for full control',
    cost: 'Very High ($10000+)',
    time: 'Months',
    when: [
      'Need unique architecture',
      'Privacy/compliance requirements',
      'Specific hardware constraints',
    ],
    whenNot: [
      'Existing models work reasonably',
      'Don\'t have ML expertise',
      'Tight timeline',
    ],
  },
];

// Use cases
export const useCaseExamples = {
  goodForFineTuning: [
    { name: 'Consistent output format/style', description: 'JSON responses, specific templates' },
    { name: 'Domain-specific terminology', description: 'Medical, legal, or technical jargon' },
    { name: 'Reducing prompt size', description: 'Move instructions into model weights' },
    { name: 'Company voice/tone', description: 'Brand-specific communication style' },
    { name: 'Specific task patterns', description: 'Code review style, email templates' },
  ],
  badForFineTuning: [
    { name: 'Adding new knowledge', description: 'Use RAG instead' },
    { name: 'One-off tasks', description: 'Cost doesn\'t justify' },
    { name: 'Problems solvable by prompting', description: 'Try prompting first' },
    { name: 'Small datasets (<100 examples)', description: 'Need more quality data' },
    { name: 'Frequently changing requirements', description: 'Retraining is expensive' },
  ],
};

// Data validation rules
export interface ValidationRule {
  name: string;
  check: (example: TrainingExample) => boolean;
  errorMessage: string;
}

export const validationRules: ValidationRule[] = [
  {
    name: 'format',
    check: (ex) => ex.messages.length >= 2 && ex.messages.some(m => m.role === 'user') && ex.messages.some(m => m.role === 'assistant'),
    errorMessage: 'Must have at least one user and one assistant message',
  },
  {
    name: 'length',
    check: (ex) => {
      const totalLength = ex.messages.reduce((sum, m) => sum + m.content.length, 0);
      return totalLength >= 50 && totalLength <= 10000;
    },
    errorMessage: 'Content length must be between 50 and 10000 characters',
  },
  {
    name: 'pii',
    check: (ex) => {
      const content = ex.messages.map(m => m.content).join(' ');
      const piiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email (only flag if looks like real)
      ];
      return !piiPatterns.some(p => p.test(content));
    },
    errorMessage: 'Contains potential PII',
  },
  {
    name: 'quality',
    check: (ex) => !ex.feedbackScore || ex.feedbackScore >= 3,
    errorMessage: 'Low feedback score (< 3)',
  },
];

// Validate training examples
export function validateExample(example: TrainingExample): TrainingExample {
  const issues: string[] = [];

  for (const rule of validationRules) {
    if (!rule.check(example)) {
      issues.push(rule.name);
    }
  }

  return {
    ...example,
    quality: issues.length === 0 ? 'verified' : 'rejected',
    issues,
  };
}

// Calculate dataset metrics
export function calculateDatasetMetrics(examples: TrainingExample[]): DatasetMetrics {
  const bySource: Record<DataSource, number> = { human: 0, production: 0, synthetic: 0 };
  const byQuality: Record<DataQuality, number> = { verified: 0, unverified: 0, rejected: 0 };
  let totalTokens = 0;
  let totalFeedback = 0;
  let feedbackCount = 0;

  for (const ex of examples) {
    bySource[ex.source]++;
    byQuality[ex.quality]++;
    totalTokens += ex.messages.reduce((sum, m) => sum + m.content.split(/\s+/).length, 0);
    if (ex.feedbackScore) {
      totalFeedback += ex.feedbackScore;
      feedbackCount++;
    }
  }

  return {
    total: examples.length,
    bySource,
    byQuality,
    avgTokens: examples.length > 0 ? totalTokens / examples.length : 0,
    avgFeedbackScore: feedbackCount > 0 ? totalFeedback / feedbackCount : 0,
  };
}

// Simulate training job
export function simulateTrainingProgress(
  job: TrainingJob,
  onUpdate: (job: TrainingJob) => void
): () => void {
  let cancelled = false;
  const totalSteps = job.epochs * 10;
  let currentStep = 0;

  const addEvent = (message: string, type: TrainingEvent['type'] = 'info') => {
    job.events.push({ timestamp: new Date(), message, type });
  };

  const tick = () => {
    if (cancelled) return;

    currentStep++;
    job.progress = (currentStep / totalSteps) * 100;
    job.currentEpoch = Math.floor(currentStep / 10) + 1;
    job.trainingLoss = 2.5 * Math.exp(-currentStep / 20) + 0.1 + Math.random() * 0.05;
    job.validationLoss = job.trainingLoss * 1.1 + Math.random() * 0.1;

    if (currentStep % 10 === 0) {
      addEvent(`Completed epoch ${job.currentEpoch}/${job.epochs} - Loss: ${job.trainingLoss.toFixed(4)}`);
    }

    onUpdate({ ...job, events: [...job.events] });

    if (currentStep < totalSteps) {
      setTimeout(tick, 300);
    } else {
      job.status = 'completed';
      job.completedAt = new Date();
      addEvent('Training completed successfully!', 'success');
      onUpdate({ ...job, events: [...job.events] });
    }
  };

  job.status = 'running';
  job.startedAt = new Date();
  addEvent('Starting training job...');
  addEvent(`Base model: ${job.baseModel}`);
  addEvent(`Epochs: ${job.epochs}`);
  onUpdate({ ...job, events: [...job.events] });

  setTimeout(tick, 500);

  return () => { cancelled = true; };
}

// Simulate evaluation results
export function simulateEvalResults(isFineTuned: boolean): EvalResults {
  const base = {
    accuracy: 0.72,
    formatCompliance: 0.65,
    latencyMs: 250,
    costPerRequest: 0.002,
    qualityScore: 3.5,
  };

  if (isFineTuned) {
    return {
      accuracy: base.accuracy + 0.12 + Math.random() * 0.05,
      formatCompliance: base.formatCompliance + 0.25 + Math.random() * 0.05,
      latencyMs: base.latencyMs * 0.9 + Math.random() * 20,
      costPerRequest: base.costPerRequest * 1.2,
      qualityScore: base.qualityScore + 0.8 + Math.random() * 0.3,
    };
  }

  return {
    accuracy: base.accuracy + Math.random() * 0.05,
    formatCompliance: base.formatCompliance + Math.random() * 0.05,
    latencyMs: base.latencyMs + Math.random() * 30,
    costPerRequest: base.costPerRequest,
    qualityScore: base.qualityScore + Math.random() * 0.2,
  };
}

// Sample training examples
export const sampleExamples: TrainingExample[] = [
  {
    id: generateId('ex'),
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant for TechCorp.' },
      { role: 'user', content: 'How do I reset my password?' },
      { role: 'assistant', content: 'To reset your password:\n1. Go to Settings > Security\n2. Click "Reset Password"\n3. Enter your email\n4. Check your inbox for the reset link\n\nNeed more help? Let me know!' },
    ],
    source: 'human',
    quality: 'verified',
    feedbackScore: 5,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: generateId('ex'),
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant for TechCorp.' },
      { role: 'user', content: 'What are your business hours?' },
      { role: 'assistant', content: 'Our support team is available:\n- Monday-Friday: 9 AM - 6 PM EST\n- Saturday: 10 AM - 4 PM EST\n- Sunday: Closed\n\nFor urgent issues outside these hours, please use our emergency line.' },
    ],
    source: 'production',
    quality: 'verified',
    feedbackScore: 4,
    createdAt: new Date('2024-02-10'),
  },
  {
    id: generateId('ex'),
    messages: [
      { role: 'user', content: 'Fix my account' },
      { role: 'assistant', content: 'ok' },
    ],
    source: 'production',
    quality: 'unverified',
    feedbackScore: 2,
    createdAt: new Date('2024-03-05'),
  },
  {
    id: generateId('ex'),
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant for TechCorp.' },
      { role: 'user', content: 'I want a refund for my subscription' },
      { role: 'assistant', content: 'I understand you\'d like a refund. Here\'s what I can do:\n\n1. Check your eligibility (refunds within 30 days)\n2. Process the refund to your original payment method\n3. Confirm via email\n\nCan you provide your order number so I can check your eligibility?' },
    ],
    source: 'human',
    quality: 'verified',
    feedbackScore: 5,
    createdAt: new Date('2024-01-20'),
  },
  {
    id: generateId('ex'),
    messages: [
      { role: 'system', content: 'You are a helpful customer support assistant for TechCorp.' },
      { role: 'user', content: 'Your product sucks and I hate it' },
      { role: 'assistant', content: 'I\'m sorry to hear you\'re frustrated. I\'d like to help make things right. Could you tell me more about the specific issues you\'re experiencing? This will help me find the best solution for you.' },
    ],
    source: 'synthetic',
    quality: 'verified',
    feedbackScore: 4,
    createdAt: new Date('2024-02-25'),
  },
];

// Status colors
export const statusColors: Record<ModelStatus, string> = {
  training: 'bg-blue-100 text-blue-800 border-blue-200',
  evaluating: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  staging: 'bg-purple-100 text-purple-800 border-purple-200',
  production: 'bg-green-100 text-green-800 border-green-200',
  deprecated: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const sourceColors: Record<DataSource, string> = {
  human: 'bg-green-100 text-green-800',
  production: 'bg-blue-100 text-blue-800',
  synthetic: 'bg-purple-100 text-purple-800',
};

export const qualityColors: Record<DataQuality, string> = {
  verified: 'bg-green-100 text-green-800',
  unverified: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};
