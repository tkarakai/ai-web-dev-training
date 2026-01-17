/**
 * Deployment and versioning utilities
 * - Artifact versioning
 * - Release playbooks
 * - Rollback strategies
 * - Feature flags
 */

import { generateId } from '@examples/shared/lib/utils';

// Types
export type ArtifactType = 'prompt' | 'tool' | 'model' | 'corpus' | 'config';
export type ArtifactStatus = 'draft' | 'staging' | 'canary' | 'production' | 'deprecated';
export type VersionBump = 'major' | 'minor' | 'patch';
export type ReleaseStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  version: string;
  status: ArtifactStatus;
  content: string;
  changelog: string;
  author: string;
  createdAt: Date;
  evalResults?: {
    passRate: number;
    metrics: Record<string, number>;
  };
}

export interface ReleaseStep {
  name: string;
  tasks: string[];
  gate: string;
  status: ReleaseStepStatus;
  duration?: number;
  output?: string;
}

export interface ReleasePlaybook {
  id: string;
  name: string;
  artifactType: ArtifactType;
  artifact: Artifact;
  steps: ReleaseStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  startedAt?: Date;
  completedAt?: Date;
  rollbackReason?: string;
}

export interface RollbackPoint {
  id: string;
  artifactType: ArtifactType;
  version: string;
  artifact: Artifact;
  createdAt: Date;
  expiresAt: Date;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  percentage?: number;
  tiers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentMetrics {
  trafficPercentage: number;
  errorRate: number;
  latencyP50: number;
  latencyP95: number;
  userFeedback: number;
}

// Version bump triggers
export const versionBumpTriggers: Record<VersionBump, { triggers: string[]; requires: string[] }> = {
  major: {
    triggers: [
      'Breaking change to output format',
      'Tool schema incompatibility',
      'Significant behavior change',
      'Model upgrade with different characteristics',
    ],
    requires: ['Full regression testing', 'Stakeholder review', 'Migration plan'],
  },
  minor: {
    triggers: [
      'New capability added',
      'Improved accuracy/quality',
      'New tool added (backward compatible)',
      'Prompt optimization',
    ],
    requires: ['Regression testing', 'A/B test or canary'],
  },
  patch: {
    triggers: [
      'Bug fix',
      'Typo correction',
      'Minor prompt wording change',
      'Performance optimization',
    ],
    requires: ['Targeted testing', 'Quick canary'],
  },
};

// Parse semantic version
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const [major, minor, patch] = version.split('.').map(n => parseInt(n, 10));
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

// Bump version
export function bumpVersion(version: string, bump: VersionBump): string {
  const { major, minor, patch } = parseVersion(version);
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}

// Check version compatibility
export function checkCompatibility(
  clientVersion: string,
  serverVersion: string
): { compatible: boolean; warnings: string[] } {
  const client = parseVersion(clientVersion);
  const server = parseVersion(serverVersion);
  const warnings: string[] = [];

  if (client.major !== server.major) {
    return { compatible: false, warnings: ['Major version mismatch - breaking changes'] };
  }

  if (server.minor > client.minor) {
    warnings.push('Server has newer features client may not use');
  }

  if (client.minor > server.minor) {
    warnings.push('Client expects features server may not have');
  }

  return { compatible: true, warnings };
}

// Create release playbook
export function createReleasePlaybook(artifact: Artifact): ReleasePlaybook {
  const steps: ReleaseStep[] = [
    {
      name: 'Pre-release checks',
      tasks: [
        'Run full eval suite',
        'Compare metrics to baseline',
        'Review changes',
        'Check for unintended behavior',
      ],
      gate: 'All evals pass',
      status: 'pending',
    },
    {
      name: 'Staging deployment',
      tasks: [
        'Deploy to staging environment',
        'Run smoke tests',
        'Manual QA if significant change',
      ],
      gate: 'Staging tests pass',
      status: 'pending',
    },
    {
      name: 'Canary deployment (5%)',
      tasks: [
        'Deploy to 5% of production traffic',
        'Monitor for 1 hour',
        'Check error rates, latency, feedback',
      ],
      gate: 'No degradation in metrics',
      status: 'pending',
    },
    {
      name: 'Gradual rollout (25%)',
      tasks: [
        'Increase to 25% traffic',
        'Monitor for 2 hours',
        'Verify metrics stable',
      ],
      gate: 'Metrics within thresholds',
      status: 'pending',
    },
    {
      name: 'Full rollout (100%)',
      tasks: [
        'Increase to 100% traffic',
        'Final monitoring period',
        'Update baseline metrics',
      ],
      gate: 'Metrics stable',
      status: 'pending',
    },
    {
      name: 'Post-release',
      tasks: [
        'Archive previous version',
        'Document changes in changelog',
        'Notify stakeholders',
        'Create rollback point',
      ],
      gate: 'Documentation complete',
      status: 'pending',
    },
  ];

  return {
    id: generateId('release'),
    name: `Release ${artifact.name} ${artifact.version}`,
    artifactType: artifact.type,
    artifact,
    steps,
    currentStep: 0,
    status: 'pending',
  };
}

// Simulate release step
export async function simulateReleaseStep(
  step: ReleaseStep,
  onUpdate: (step: ReleaseStep) => void
): Promise<ReleaseStep> {
  step.status = 'running';
  onUpdate({ ...step });

  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

  const passed = Math.random() > 0.1;
  step.status = passed ? 'passed' : 'failed';
  step.duration = 1000 + Math.floor(Math.random() * 2000);
  step.output = passed
    ? `All ${step.tasks.length} tasks completed. Gate: ${step.gate} - PASSED`
    : `Failed at: ${step.tasks[Math.floor(Math.random() * step.tasks.length)]}`;

  onUpdate({ ...step });
  return step;
}

// Simulate deployment metrics
export function simulateDeploymentMetrics(trafficPercentage: number): DeploymentMetrics {
  const baseErrorRate = 0.02;
  const baseLatency = 250;

  return {
    trafficPercentage,
    errorRate: baseErrorRate + (Math.random() * 0.01 - 0.005),
    latencyP50: baseLatency + Math.floor(Math.random() * 30 - 15),
    latencyP95: baseLatency * 1.8 + Math.floor(Math.random() * 50 - 25),
    userFeedback: 4.2 + (Math.random() * 0.4 - 0.2),
  };
}

// Sample artifacts
export const sampleArtifacts: Artifact[] = [
  {
    id: 'prompt-support-v1',
    type: 'prompt',
    name: 'Customer Support',
    version: '2.3.0',
    status: 'production',
    content: 'You are a helpful customer support assistant...',
    changelog: 'Improved handling of refund requests',
    author: 'alice@example.com',
    createdAt: new Date('2024-03-01'),
    evalResults: { passRate: 0.95, metrics: { accuracy: 0.92, helpfulness: 0.89 } },
  },
  {
    id: 'prompt-support-v2',
    type: 'prompt',
    name: 'Customer Support',
    version: '2.4.0',
    status: 'staging',
    content: 'You are an expert customer support assistant...',
    changelog: 'Added multi-language support, improved tone',
    author: 'bob@example.com',
    createdAt: new Date('2024-03-15'),
    evalResults: { passRate: 0.97, metrics: { accuracy: 0.94, helpfulness: 0.91 } },
  },
  {
    id: 'tool-search-v1',
    type: 'tool',
    name: 'Web Search',
    version: '1.2.1',
    status: 'production',
    content: '{"name": "web_search", "parameters": {...}}',
    changelog: 'Fixed pagination bug',
    author: 'charlie@example.com',
    createdAt: new Date('2024-02-20'),
  },
  {
    id: 'config-routing-v1',
    type: 'config',
    name: 'Model Routing',
    version: '1.0.3',
    status: 'production',
    content: '{"primary": "gpt-4o", "fallbacks": [...]}',
    changelog: 'Added Claude as fallback',
    author: 'alice@example.com',
    createdAt: new Date('2024-03-10'),
  },
];

// Sample feature flags
export const sampleFeatureFlags: FeatureFlag[] = [
  {
    id: 'flag-new-rag',
    name: 'enableNewRAG',
    description: 'Enable new RAG pipeline with improved retrieval',
    enabled: true,
    percentage: 25,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-10'),
  },
  {
    id: 'flag-voice',
    name: 'enableVoice',
    description: 'Enable voice input/output features',
    enabled: true,
    tiers: ['pro', 'enterprise'],
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
  {
    id: 'flag-streaming',
    name: 'enableStreaming',
    description: 'Enable streaming responses',
    enabled: true,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'flag-debug',
    name: 'enableDebugMode',
    description: 'Show debug information in responses',
    enabled: false,
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-03-05'),
  },
];

// Status colors
export const statusColors: Record<ArtifactStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  staging: 'bg-yellow-100 text-yellow-800',
  canary: 'bg-purple-100 text-purple-800',
  production: 'bg-green-100 text-green-800',
  deprecated: 'bg-red-100 text-red-800',
};

export const releaseStepColors: Record<ReleaseStepStatus, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  running: 'bg-blue-100 text-blue-600 border-blue-200',
  passed: 'bg-green-100 text-green-600 border-green-200',
  failed: 'bg-red-100 text-red-600 border-red-200',
  skipped: 'bg-gray-100 text-gray-400 border-gray-200',
};

export const artifactTypeColors: Record<ArtifactType, string> = {
  prompt: 'bg-blue-100 text-blue-800',
  tool: 'bg-purple-100 text-purple-800',
  model: 'bg-orange-100 text-orange-800',
  corpus: 'bg-green-100 text-green-800',
  config: 'bg-gray-100 text-gray-800',
};
