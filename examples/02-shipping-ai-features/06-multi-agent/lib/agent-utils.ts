/**
 * Multi-agent orchestration utilities
 */

import { generateId } from '@examples/shared/lib/utils';

// Agent definition
export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  color: string;
}

// Agent output
export interface AgentOutput {
  agentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  latencyMs: number;
  tokenCount: number;
}

// Audit entry for tracking
export interface AuditEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  agentName: string;
  action: 'start' | 'complete' | 'error' | 'handoff';
  input?: string;
  output?: string;
  latencyMs?: number;
  tokenCount?: number;
  parentId?: string;
}

// Budget tracking
export interface Budget {
  maxTokens: number;
  maxCost: number;
  usedTokens: number;
  usedCost: number;
}

// Pipeline stage
export interface PipelineStage {
  agent: Agent;
  transformInput?: (prev: AgentOutput) => string;
}

// Parallel task
export interface ParallelTask {
  agent: Agent;
  input: string;
}

// Define sample agents
export const agents: Record<string, Agent> = {
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    role: 'Gathers information and facts',
    systemPrompt: 'You are a research assistant. Gather relevant facts and information about the topic. Be thorough but concise.',
    color: 'blue',
  },
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    role: 'Analyzes information and finds patterns',
    systemPrompt: 'You are an analyst. Review the research findings and identify key patterns, insights, and implications.',
    color: 'green',
  },
  writer: {
    id: 'writer',
    name: 'Writer',
    role: 'Creates polished content',
    systemPrompt: 'You are a technical writer. Take the analysis and create a clear, well-structured summary.',
    color: 'purple',
  },
  technicalReviewer: {
    id: 'technical',
    name: 'Technical Reviewer',
    role: 'Reviews for technical accuracy',
    systemPrompt: 'You are a technical reviewer. Check for technical accuracy, best practices, and potential issues.',
    color: 'orange',
  },
  securityReviewer: {
    id: 'security',
    name: 'Security Reviewer',
    role: 'Reviews for security issues',
    systemPrompt: 'You are a security expert. Identify potential security vulnerabilities and recommend mitigations.',
    color: 'red',
  },
  orchestrator: {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Coordinates other agents',
    systemPrompt: 'You are an orchestrator agent. Delegate tasks to specialized agents and synthesize their outputs.',
    color: 'indigo',
  },
  maker: {
    id: 'maker',
    name: 'Maker',
    role: 'Creates initial drafts',
    systemPrompt: 'You are a code generator. Create clean, efficient code based on the requirements.',
    color: 'cyan',
  },
  checker: {
    id: 'checker',
    name: 'Checker',
    role: 'Reviews and critiques',
    systemPrompt: 'You are a code reviewer. Critique the code for bugs, style issues, and improvements. Score 0-100.',
    color: 'amber',
  },
};

// Call a single agent via llama-server
export async function callAgent(
  agent: Agent,
  input: string,
  context?: string
): Promise<AgentOutput> {
  const startTime = Date.now();

  const messages = [
    { role: 'system', content: agent.systemPrompt },
  ];

  if (context) {
    messages.push({ role: 'user', content: `Context:\n${context}` });
  }

  messages.push({ role: 'user', content: input });

  const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-oss-20b',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent ${agent.name} failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || 'No response';

  return {
    agentId: agent.id,
    content,
    timestamp: new Date(),
    latencyMs: Date.now() - startTime,
    tokenCount: data.usage?.total_tokens || Math.ceil(content.length / 4),
  };
}

// Sequential pipeline
export async function runSequentialPipeline(
  stages: PipelineStage[],
  initialInput: string,
  onProgress?: (stage: number, total: number, agent: Agent, output?: AgentOutput) => void
): Promise<{ outputs: AgentOutput[]; totalLatency: number; totalTokens: number }> {
  const outputs: AgentOutput[] = [];
  let currentInput = initialInput;
  let totalLatency = 0;
  let totalTokens = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    onProgress?.(i + 1, stages.length, stage.agent);

    const input = stage.transformInput && outputs.length > 0
      ? stage.transformInput(outputs[outputs.length - 1])
      : currentInput;

    const output = await callAgent(stage.agent, input);
    outputs.push(output);

    currentInput = output.content;
    totalLatency += output.latencyMs;
    totalTokens += output.tokenCount;

    onProgress?.(i + 1, stages.length, stage.agent, output);
  }

  return { outputs, totalLatency, totalTokens };
}

// Parallel execution
export async function runParallel(
  tasks: ParallelTask[],
  onProgress?: (completed: number, total: number, outputs: AgentOutput[]) => void
): Promise<{ outputs: AgentOutput[]; totalLatency: number; totalTokens: number }> {
  const startTime = Date.now();
  const outputs: AgentOutput[] = [];
  let completed = 0;

  await Promise.all(
    tasks.map(async (task) => {
      const output = await callAgent(task.agent, task.input);
      outputs.push(output);
      completed++;
      onProgress?.(completed, tasks.length, outputs);
    })
  );

  const totalTokens = outputs.reduce((sum, o) => sum + o.tokenCount, 0);

  return {
    outputs,
    totalLatency: Date.now() - startTime,
    totalTokens,
  };
}

// Maker-checker loop
export async function runMakerChecker(
  task: string,
  maker: Agent,
  checker: Agent,
  maxIterations: number,
  acceptanceThreshold: number,
  onProgress?: (iteration: number, phase: 'making' | 'checking', output?: AgentOutput, score?: number) => void
): Promise<{
  finalOutput: AgentOutput;
  iterations: number;
  history: Array<{ maker: AgentOutput; checker: AgentOutput; score: number }>;
}> {
  const history: Array<{ maker: AgentOutput; checker: AgentOutput; score: number }> = [];
  let currentDraft: AgentOutput | null = null;
  let feedback: string | null = null;

  for (let i = 0; i < maxIterations; i++) {
    onProgress?.(i + 1, 'making');

    // Maker creates/revises
    const makerInput = feedback
      ? `Task: ${task}\n\nPrevious feedback: ${feedback}\n\nPlease revise your solution.`
      : task;

    currentDraft = await callAgent(maker, makerInput);
    onProgress?.(i + 1, 'making', currentDraft);

    // Checker evaluates
    onProgress?.(i + 1, 'checking');
    const checkerInput = `Task: ${task}\n\nSolution to review:\n${currentDraft.content}\n\nProvide a score (0-100) and feedback. Format: SCORE: [number]\nFEEDBACK: [your feedback]`;

    const checkerOutput = await callAgent(checker, checkerInput);

    // Parse score from checker response
    const scoreMatch = checkerOutput.content.match(/SCORE:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

    history.push({ maker: currentDraft, checker: checkerOutput, score });
    onProgress?.(i + 1, 'checking', checkerOutput, score);

    if (score >= acceptanceThreshold) {
      return { finalOutput: currentDraft, iterations: i + 1, history };
    }

    // Extract feedback for next iteration
    const feedbackMatch = checkerOutput.content.match(/FEEDBACK:\s*([\s\S]+)/i);
    feedback = feedbackMatch ? feedbackMatch[1].trim() : checkerOutput.content;
  }

  return { finalOutput: currentDraft!, iterations: maxIterations, history };
}

// Create audit trail
export function createAuditEntry(
  agentId: string,
  agentName: string,
  action: AuditEntry['action'],
  options?: Partial<AuditEntry>
): AuditEntry {
  return {
    id: generateId('audit'),
    timestamp: new Date(),
    agentId,
    agentName,
    action,
    ...options,
  };
}

// Format latency
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Estimate cost (simplified)
export function estimateCost(tokens: number): number {
  // Assuming $0.002 per 1K tokens
  return (tokens / 1000) * 0.002;
}
