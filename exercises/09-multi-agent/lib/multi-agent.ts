/**
 * Multi-Agent Pipelines
 *
 * Orchestrate multiple LLM calls with different roles and coordination patterns.
 *
 * KEY CONCEPTS:
 * 1. Sequential chains - Output of one agent feeds into next
 * 2. Parallel fan-out - Multiple agents process simultaneously
 * 3. Maker-checker - One creates, another validates/critiques
 * 4. Router pattern - Classify input, route to specialized agent
 */

import { LlamaClient, type Message } from '../../shared/lib/llama-client';

// =============================================================================
// TYPES
// =============================================================================

export interface Agent {
  name: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResponse {
  agent: string;
  input: string;
  output: string;
  latencyMs: number;
}

export interface PipelineResult {
  steps: AgentResponse[];
  finalOutput: string;
  totalLatencyMs: number;
}

// =============================================================================
// AGENT DEFINITIONS
// =============================================================================

/**
 * Pre-built agents for common patterns
 */
export const AGENTS = {
  // Analysis agents
  analyzer: {
    name: 'Analyzer',
    systemPrompt: `You are an analyzer. Break down the input into key components and insights.
Be structured and thorough. Identify main themes, issues, or requirements.`,
    temperature: 0.3,
  },

  researcher: {
    name: 'Researcher',
    systemPrompt: `You are a researcher. Given a topic or question, provide relevant facts and context.
Focus on accuracy and relevance. Cite specific details when possible.`,
    temperature: 0.3,
  },

  // Content agents
  writer: {
    name: 'Writer',
    systemPrompt: `You are a professional writer. Create clear, engaging content based on the input.
Match the appropriate tone and style for the context.`,
    temperature: 0.7,
  },

  summarizer: {
    name: 'Summarizer',
    systemPrompt: `You are a summarizer. Condense the input into a concise summary.
Preserve key information while removing redundancy. Be brief but complete.`,
    temperature: 0.2,
  },

  // Quality agents
  critic: {
    name: 'Critic',
    systemPrompt: `You are a constructive critic. Review the input for issues, errors, or improvements.
Be specific about problems and suggest concrete fixes. Be fair but thorough.`,
    temperature: 0.3,
  },

  factChecker: {
    name: 'Fact Checker',
    systemPrompt: `You are a fact checker. Verify claims in the input for accuracy.
Flag anything that seems incorrect, exaggerated, or unverifiable.
Output "VERIFIED" if all claims check out, otherwise list issues.`,
    temperature: 0.1,
  },

  // Specialized agents
  codeReviewer: {
    name: 'Code Reviewer',
    systemPrompt: `You are a code reviewer. Analyze code for bugs, security issues, and improvements.
Focus on correctness, readability, and best practices.`,
    temperature: 0.2,
  },

  translator: {
    name: 'Translator',
    systemPrompt: `You are a translator. Translate the input to the target language.
Preserve meaning and tone. Handle idioms appropriately.`,
    temperature: 0.3,
  },

  // Router agent
  router: {
    name: 'Router',
    systemPrompt: `You are a request router. Classify the input into one category:
- ANALYSIS: Questions requiring breakdown or investigation
- CONTENT: Requests for writing or creating text
- CODE: Programming or technical tasks
- GENERAL: Everything else

Respond with ONLY the category name.`,
    temperature: 0,
  },
} as const;

// =============================================================================
// CORE EXECUTION
// =============================================================================

/**
 * Execute a single agent
 */
export async function runAgent(
  client: LlamaClient,
  agent: Agent,
  input: string
): Promise<AgentResponse> {
  const start = Date.now();

  const messages: Message[] = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: input },
  ];

  const output = await client.chat(messages, {
    temperature: agent.temperature ?? 0.5,
    maxTokens: agent.maxTokens ?? 500,
  });

  return {
    agent: agent.name,
    input,
    output,
    latencyMs: Date.now() - start,
  };
}

// =============================================================================
// PIPELINE PATTERNS
// =============================================================================

/**
 * Sequential Chain
 *
 * Run agents one after another, each receiving the previous output.
 *
 * Example: Analyze -> Write -> Summarize
 */
export async function runSequentialChain(
  client: LlamaClient,
  agents: Agent[],
  initialInput: string
): Promise<PipelineResult> {
  const steps: AgentResponse[] = [];
  let currentInput = initialInput;

  for (const agent of agents) {
    const response = await runAgent(client, agent, currentInput);
    steps.push(response);
    currentInput = response.output;
  }

  return {
    steps,
    finalOutput: currentInput,
    totalLatencyMs: steps.reduce((sum, s) => sum + s.latencyMs, 0),
  };
}

/**
 * Parallel Fan-Out
 *
 * Run multiple agents simultaneously on the same input.
 *
 * Example: Get analysis from multiple perspectives at once
 */
export async function runParallelAgents(
  client: LlamaClient,
  agents: Agent[],
  input: string
): Promise<{
  responses: AgentResponse[];
  totalLatencyMs: number;
}> {
  const start = Date.now();

  const responses = await Promise.all(
    agents.map((agent) => runAgent(client, agent, input))
  );

  return {
    responses,
    totalLatencyMs: Date.now() - start,
  };
}

/**
 * Maker-Checker Pattern
 *
 * One agent creates content, another validates it.
 * Optionally iterate until the checker approves.
 *
 * Example: Writer creates, Critic reviews, Writer revises
 */
export async function runMakerChecker(
  client: LlamaClient,
  maker: Agent,
  checker: Agent,
  input: string,
  options: {
    maxIterations?: number;
    approvalKeyword?: string;
  } = {}
): Promise<{
  iterations: Array<{ draft: AgentResponse; review: AgentResponse }>;
  finalOutput: string;
  approved: boolean;
  totalLatencyMs: number;
}> {
  const { maxIterations = 3, approvalKeyword = 'APPROVED' } = options;
  const iterations: Array<{ draft: AgentResponse; review: AgentResponse }> = [];
  let currentInput = input;
  let approved = false;
  const start = Date.now();

  for (let i = 0; i < maxIterations; i++) {
    // Maker creates/revises
    const draft = await runAgent(client, maker, currentInput);

    // Checker reviews
    const reviewPrompt = i === 0
      ? `Review this content:\n\n${draft.output}`
      : `Review this REVISED content:\n\n${draft.output}\n\nPrevious feedback was addressed.`;

    const review = await runAgent(client, checker, reviewPrompt);

    iterations.push({ draft, review });

    // Check if approved
    if (review.output.toUpperCase().includes(approvalKeyword)) {
      approved = true;
      break;
    }

    // Prepare for next iteration
    currentInput = `Original request: ${input}\n\nYour previous draft:\n${draft.output}\n\nFeedback to address:\n${review.output}\n\nPlease revise.`;
  }

  const finalDraft = iterations[iterations.length - 1].draft;

  return {
    iterations,
    finalOutput: finalDraft.output,
    approved,
    totalLatencyMs: Date.now() - start,
  };
}

/**
 * Router Pattern
 *
 * Classify input and route to the appropriate specialized agent.
 */
export async function runWithRouter(
  client: LlamaClient,
  input: string,
  routes: Record<string, Agent>
): Promise<{
  route: string;
  response: AgentResponse;
  totalLatencyMs: number;
}> {
  const start = Date.now();

  // First, classify the input
  const classification = await runAgent(client, AGENTS.router, input);
  const route = classification.output.trim().toUpperCase();

  // Find matching agent
  const agent = routes[route] || routes['GENERAL'] || AGENTS.writer;

  // Run the specialized agent
  const response = await runAgent(client, agent, input);

  return {
    route,
    response,
    totalLatencyMs: Date.now() - start,
  };
}

/**
 * Aggregator Pattern
 *
 * Run multiple agents in parallel, then aggregate their outputs.
 */
export async function runAndAggregate(
  client: LlamaClient,
  agents: Agent[],
  input: string,
  aggregator: Agent
): Promise<PipelineResult> {
  const start = Date.now();
  const steps: AgentResponse[] = [];

  // Run all agents in parallel
  const { responses } = await runParallelAgents(client, agents, input);
  steps.push(...responses);

  // Format outputs for aggregation
  const aggregationInput = responses
    .map((r, i) => `[${r.agent}]:\n${r.output}`)
    .join('\n\n---\n\n');

  // Aggregate
  const aggregation = await runAgent(
    client,
    aggregator,
    `Synthesize these perspectives:\n\n${aggregationInput}`
  );
  steps.push(aggregation);

  return {
    steps,
    finalOutput: aggregation.output,
    totalLatencyMs: Date.now() - start,
  };
}

// =============================================================================
// HIGH-LEVEL WORKFLOWS
// =============================================================================

/**
 * Research and Write workflow
 *
 * 1. Research the topic
 * 2. Analyze the research
 * 3. Write content based on analysis
 * 4. Summarize
 */
export async function researchAndWrite(
  client: LlamaClient,
  topic: string
): Promise<PipelineResult> {
  return runSequentialChain(client, [
    {
      ...AGENTS.researcher,
      systemPrompt: AGENTS.researcher.systemPrompt + `\n\nResearch topic: ${topic}`,
    },
    AGENTS.analyzer,
    AGENTS.writer,
    AGENTS.summarizer,
  ], topic);
}

/**
 * Code Review workflow
 *
 * 1. Review code for bugs
 * 2. Review for security
 * 3. Aggregate findings
 */
export async function reviewCode(
  client: LlamaClient,
  code: string
): Promise<PipelineResult> {
  const bugReviewer: Agent = {
    name: 'Bug Hunter',
    systemPrompt: 'Find bugs, logic errors, and edge cases in this code.',
    temperature: 0.2,
  };

  const securityReviewer: Agent = {
    name: 'Security Reviewer',
    systemPrompt: 'Find security vulnerabilities in this code. Focus on injection, auth, data exposure.',
    temperature: 0.2,
  };

  const aggregator: Agent = {
    name: 'Review Aggregator',
    systemPrompt: 'Combine these code reviews into a single, prioritized list of issues.',
    temperature: 0.3,
  };

  return runAndAggregate(client, [bugReviewer, securityReviewer], code, aggregator);
}

/**
 * Debate workflow
 *
 * Two agents argue different sides, then a judge decides.
 */
export async function runDebate(
  client: LlamaClient,
  topic: string
): Promise<{
  proArgument: string;
  conArgument: string;
  judgment: string;
  totalLatencyMs: number;
}> {
  const start = Date.now();

  const proAgent: Agent = {
    name: 'Pro',
    systemPrompt: 'Argue IN FAVOR of the proposition. Be persuasive and logical.',
    temperature: 0.6,
  };

  const conAgent: Agent = {
    name: 'Con',
    systemPrompt: 'Argue AGAINST the proposition. Be persuasive and logical.',
    temperature: 0.6,
  };

  const judgeAgent: Agent = {
    name: 'Judge',
    systemPrompt: 'Evaluate both arguments fairly. Declare which is more convincing and why.',
    temperature: 0.3,
  };

  // Run pro and con in parallel
  const { responses } = await runParallelAgents(client, [proAgent, conAgent], topic);
  const pro = responses.find((r) => r.agent === 'Pro')!;
  const con = responses.find((r) => r.agent === 'Con')!;

  // Judge evaluates
  const judgment = await runAgent(
    client,
    judgeAgent,
    `Topic: ${topic}\n\nPRO argument:\n${pro.output}\n\nCON argument:\n${con.output}`
  );

  return {
    proArgument: pro.output,
    conArgument: con.output,
    judgment: judgment.output,
    totalLatencyMs: Date.now() - start,
  };
}

// =============================================================================
// PIPELINE BUILDER (Fluent API)
// =============================================================================

/**
 * Fluent API for building pipelines
 *
 * Example:
 *   const result = await pipeline(client)
 *     .input("Write about TypeScript")
 *     .then(AGENTS.writer)
 *     .then(AGENTS.critic)
 *     .then(AGENTS.writer)
 *     .run();
 */
export class PipelineBuilder {
  private client: LlamaClient;
  private inputText: string = '';
  private agents: Agent[] = [];

  constructor(client: LlamaClient) {
    this.client = client;
  }

  input(text: string): this {
    this.inputText = text;
    return this;
  }

  then(agent: Agent): this {
    this.agents.push(agent);
    return this;
  }

  async run(): Promise<PipelineResult> {
    if (!this.inputText) throw new Error('No input provided');
    if (this.agents.length === 0) throw new Error('No agents in pipeline');

    return runSequentialChain(this.client, this.agents, this.inputText);
  }
}

export function pipeline(client: LlamaClient): PipelineBuilder {
  return new PipelineBuilder(client);
}

// =============================================================================
// MULTI-AGENT CLIENT
// =============================================================================

export class MultiAgentClient {
  private client: LlamaClient;

  constructor(baseUrl: string = 'http://127.0.0.1:8033') {
    this.client = new LlamaClient(baseUrl);
  }

  /** Run a single agent */
  async runAgent(agent: Agent, input: string): Promise<AgentResponse> {
    return runAgent(this.client, agent, input);
  }

  /** Sequential chain: A -> B -> C */
  async chain(agents: Agent[], input: string): Promise<PipelineResult> {
    return runSequentialChain(this.client, agents, input);
  }

  /** Parallel execution: [A, B, C] simultaneously */
  async parallel(agents: Agent[], input: string) {
    return runParallelAgents(this.client, agents, input);
  }

  /** Maker-checker with optional iteration */
  async makerChecker(maker: Agent, checker: Agent, input: string, maxIterations = 3) {
    return runMakerChecker(this.client, maker, checker, input, { maxIterations });
  }

  /** Route to specialized agent */
  async route(input: string, routes: Record<string, Agent>) {
    return runWithRouter(this.client, input, routes);
  }

  /** Parallel + aggregation */
  async aggregate(agents: Agent[], input: string, aggregator: Agent) {
    return runAndAggregate(this.client, agents, input, aggregator);
  }

  /** Debate workflow */
  async debate(topic: string) {
    return runDebate(this.client, topic);
  }

  /** Fluent pipeline builder */
  pipeline(): PipelineBuilder {
    return pipeline(this.client);
  }
}
