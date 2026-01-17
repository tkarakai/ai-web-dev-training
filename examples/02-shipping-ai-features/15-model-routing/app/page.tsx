'use client';

import { useState, useCallback, useMemo } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Input } from '@examples/shared/components/ui/input';
import { generateId } from '@examples/shared/lib/utils';
import {
  Model,
  UserTier,
  Complexity,
  RoutingDecision,
  CostMetrics,
  models,
  tierModels,
  classifyTask,
  routeByTask,
  getAvailableModels,
  ResponseCache,
  createFallbackChain,
  simulateModelHealth,
  costStrategies,
  samplePrompts,
  healthColors,
  complexityColors,
} from '../lib/routing';

type Tab = 'routing' | 'caching' | 'fallbacks' | 'costs';

interface RequestLog {
  id: string;
  prompt: string;
  decision: RoutingDecision;
  complexity: Complexity;
  timestamp: Date;
}

export default function ModelRoutingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('routing');
  const [tier, setTier] = useState<UserTier>('pro');
  const [prompt, setPrompt] = useState('');
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [cache] = useState(() => new ResponseCache());
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [modelHealth, setModelHealth] = useState<Record<string, string>>({});

  // Calculate cost metrics
  const costMetrics = useMemo((): CostMetrics => {
    const byModel: Record<string, { requests: number; cost: number }> = {};
    let totalCost = 0;
    let cacheHits = 0;

    for (const log of requestLogs) {
      totalCost += log.decision.estimatedCost;
      if (log.decision.cacheHit !== 'none') {
        cacheHits++;
      }
      const modelId = log.decision.model.id;
      if (!byModel[modelId]) {
        byModel[modelId] = { requests: 0, cost: 0 };
      }
      byModel[modelId].requests++;
      byModel[modelId].cost += log.decision.estimatedCost;
    }

    const cacheHitRate = requestLogs.length > 0 ? cacheHits / requestLogs.length : 0;
    const savingsFromCache = cacheHits * 0.005; // Assume $0.005 saved per cache hit

    return {
      totalRequests: requestLogs.length,
      totalCost,
      cacheHitRate,
      avgCostPerRequest: requestLogs.length > 0 ? totalCost / requestLogs.length : 0,
      savingsFromCache,
      savingsFromRouting: totalCost * 0.3, // Estimate 30% savings from routing
      byModel,
    };
  }, [requestLogs]);

  // Route a request
  const routeRequest = useCallback((inputPrompt?: string) => {
    const requestPrompt = inputPrompt || prompt;
    if (!requestPrompt.trim()) return;

    // Check cache first
    if (cacheEnabled) {
      const exactHit = cache.getExact(requestPrompt);
      if (exactHit) {
        const model = models.find(m => m.id === exactHit.model)!;
        const decision: RoutingDecision = {
          model,
          reason: 'cache_exact_hit',
          estimatedCost: 0,
          estimatedLatency: 5,
          cacheHit: 'exact',
          fallbackUsed: false,
        };
        setRequestLogs(prev => [{
          id: generateId('req'),
          prompt: requestPrompt,
          decision,
          complexity: 'simple',
          timestamp: new Date(),
        }, ...prev].slice(0, 20));
        return;
      }

      const semanticHit = cache.getSemantic(requestPrompt);
      if (semanticHit) {
        const model = models.find(m => m.id === semanticHit.model)!;
        const decision: RoutingDecision = {
          model,
          reason: 'cache_semantic_hit',
          estimatedCost: 0,
          estimatedLatency: 10,
          cacheHit: 'semantic',
          fallbackUsed: false,
        };
        setRequestLogs(prev => [{
          id: generateId('req'),
          prompt: requestPrompt,
          decision,
          complexity: 'simple',
          timestamp: new Date(),
        }, ...prev].slice(0, 20));
        return;
      }
    }

    // Classify task
    const classification = classifyTask(requestPrompt);

    // Get available models
    const available = getAvailableModels(tier);

    // Route
    const decision = routeByTask(classification, available);

    // Store in cache
    cache.set(requestPrompt, `Response to: ${requestPrompt}`, decision.model.id);

    setRequestLogs(prev => [{
      id: generateId('req'),
      prompt: requestPrompt,
      decision,
      complexity: classification.complexity,
      timestamp: new Date(),
    }, ...prev].slice(0, 20));

    if (!inputPrompt) {
      setPrompt('');
    }
  }, [prompt, tier, cacheEnabled, cache]);

  // Simulate health changes
  const simulateHealth = useCallback(() => {
    simulateModelHealth();
    const health: Record<string, string> = {};
    for (const model of models) {
      health[model.id] = model.health;
    }
    setModelHealth(health);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'routing', label: 'Task Routing' },
    { id: 'caching', label: 'Caching' },
    { id: 'fallbacks', label: 'Fallbacks' },
    { id: 'costs', label: 'Cost Analysis' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Model Routing</h1>
          <p className="text-muted-foreground mt-2">
            Task-based routing, caching strategies, fallbacks, and cost optimization
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'routing' && (
            <RoutingTab
              tier={tier}
              onTierChange={setTier}
              prompt={prompt}
              onPromptChange={setPrompt}
              onRoute={() => routeRequest()}
              onSampleRoute={routeRequest}
              logs={requestLogs}
              cacheEnabled={cacheEnabled}
              onCacheToggle={setCacheEnabled}
            />
          )}

          {activeTab === 'caching' && (
            <CachingTab
              cache={cache}
              enabled={cacheEnabled}
              onToggle={setCacheEnabled}
              logs={requestLogs}
            />
          )}

          {activeTab === 'fallbacks' && (
            <FallbacksTab
              tier={tier}
              onSimulateHealth={simulateHealth}
              modelHealth={modelHealth}
            />
          )}

          {activeTab === 'costs' && (
            <CostsTab
              metrics={costMetrics}
              logs={requestLogs}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function RoutingTab({
  tier,
  onTierChange,
  prompt,
  onPromptChange,
  onRoute,
  onSampleRoute,
  logs,
  cacheEnabled,
  onCacheToggle,
}: {
  tier: UserTier;
  onTierChange: (t: UserTier) => void;
  prompt: string;
  onPromptChange: (p: string) => void;
  onRoute: () => void;
  onSampleRoute: (p: string) => void;
  logs: RequestLog[];
  cacheEnabled: boolean;
  onCacheToggle: (e: boolean) => void;
}) {
  const availableModels = getAvailableModels(tier);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex gap-4 mb-4">
          <div>
            <label className="text-sm font-medium block mb-2">User Tier</label>
            <div className="flex gap-2">
              {(['free', 'pro', 'enterprise'] as UserTier[]).map(t => (
                <button
                  key={t}
                  onClick={() => onTierChange(t)}
                  className={`px-3 py-1 rounded border capitalize ${
                    tier === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cacheEnabled}
                onChange={e => onCacheToggle(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Enable Cache</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            placeholder="Enter your prompt..."
            onKeyDown={e => e.key === 'Enter' && onRoute()}
            className="flex-1"
          />
          <Button onClick={onRoute}>Route Request</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Try:</span>
          {samplePrompts.map((sample, i) => (
            <button
              key={i}
              onClick={() => onSampleRoute(sample.text)}
              className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
            >
              {sample.text.slice(0, 30)}...
            </button>
          ))}
        </div>
      </Card>

      {/* Available Models */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Available Models ({tier} tier)</h3>
        <div className="grid grid-cols-3 gap-3">
          {availableModels.map(model => (
            <div key={model.id} className="p-3 border rounded">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-sm">{model.name}</h4>
                  <p className="text-xs text-muted-foreground">{model.provider}</p>
                </div>
                <Badge className={healthColors[model.health]}>{model.health}</Badge>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Cost:</span>
                  <span className="font-mono">${model.costPer1kTokens}/1k</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="font-mono">{model.avgLatencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className="font-mono">{model.quality}/10</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Request Logs */}
      {logs.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Request Log</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="p-3 border rounded text-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="line-clamp-1 flex-1">{log.prompt}</span>
                  <div className="flex gap-2">
                    <Badge className={complexityColors[log.complexity]}>
                      {log.complexity}
                    </Badge>
                    {log.decision.cacheHit !== 'none' && (
                      <Badge variant="success">{log.decision.cacheHit} cache</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Model: {log.decision.model.name}</span>
                  <span>Reason: {log.decision.reason}</span>
                  <span>Cost: ${log.decision.estimatedCost.toFixed(6)}</span>
                  <span>Latency: {log.decision.estimatedLatency}ms</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CachingTab({
  cache,
  enabled,
  onToggle,
  logs,
}: {
  cache: ResponseCache;
  enabled: boolean;
  onToggle: (e: boolean) => void;
  logs: RequestLog[];
}) {
  const stats = cache.getStats();
  const cacheHits = logs.filter(l => l.decision.cacheHit !== 'none').length;
  const hitRate = logs.length > 0 ? (cacheHits / logs.length * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Cache Configuration</h3>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => onToggle(e.target.checked)}
              className="rounded"
            />
            <span>Enabled</span>
          </label>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-muted/50 rounded text-center">
            <p className="text-2xl font-bold">{stats.size}</p>
            <p className="text-sm text-muted-foreground">Cached Entries</p>
          </div>
          <div className="p-3 bg-muted/50 rounded text-center">
            <p className="text-2xl font-bold">{stats.totalHits}</p>
            <p className="text-sm text-muted-foreground">Total Hits</p>
          </div>
          <div className="p-3 bg-muted/50 rounded text-center">
            <p className="text-2xl font-bold">{hitRate}%</p>
            <p className="text-sm text-muted-foreground">Hit Rate</p>
          </div>
          <div className="p-3 bg-muted/50 rounded text-center">
            <p className="text-2xl font-bold text-green-600">
              ${(cacheHits * 0.005).toFixed(4)}
            </p>
            <p className="text-sm text-muted-foreground">Est. Savings</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Caching Levels</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Level 1: Exact Match</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Hash the exact request and look up cached response.
              Fastest but only works for identical requests.
            </p>
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="font-mono">~5ms</span>
              </div>
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-mono text-green-600">$0</span>
              </div>
            </div>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-medium mb-2">Level 2: Semantic Match</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Find similar requests using embeddings.
              Works for paraphrased queries with same intent.
            </p>
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="font-mono">~50ms</span>
              </div>
              <div className="flex justify-between">
                <span>Threshold:</span>
                <span className="font-mono">0.6 similarity</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cache Hits in Logs */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Cache Hits</h3>
        {cacheHits > 0 ? (
          <div className="space-y-2">
            {logs.filter(l => l.decision.cacheHit !== 'none').map(log => (
              <div key={log.id} className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                <div className="flex justify-between">
                  <span className="line-clamp-1">{log.prompt}</span>
                  <Badge variant="success">{log.decision.cacheHit}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No cache hits yet. Try repeating a query to see caching in action.
          </p>
        )}
      </Card>
    </div>
  );
}

function FallbacksTab({
  tier,
  onSimulateHealth,
  modelHealth,
}: {
  tier: UserTier;
  onSimulateHealth: () => void;
  modelHealth: Record<string, string>;
}) {
  const fallbackChain = createFallbackChain(tier);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Fallback Chain ({tier} tier)</h3>
          <Button onClick={onSimulateHealth} variant="outline">
            Simulate Health Changes
          </Button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {/* Primary */}
          <div className="p-4 border-2 border-primary rounded flex-1">
            <Badge className="mb-2">Primary</Badge>
            <h4 className="font-medium">{fallbackChain.primary.name}</h4>
            <p className="text-sm text-muted-foreground">{fallbackChain.primary.provider}</p>
            {modelHealth[fallbackChain.primary.id] && (
              <Badge className={healthColors[modelHealth[fallbackChain.primary.id] as keyof typeof healthColors]} >
                {modelHealth[fallbackChain.primary.id]}
              </Badge>
            )}
          </div>

          {/* Fallbacks */}
          {fallbackChain.fallbacks.map((model, i) => (
            <div key={model.id} className="flex items-center gap-4">
              <span className="text-muted-foreground">→</span>
              <div className="p-4 border rounded flex-1">
                <Badge variant="outline" className="mb-2">Fallback {i + 1}</Badge>
                <h4 className="font-medium text-sm">{model.name}</h4>
                <p className="text-xs text-muted-foreground">{model.provider}</p>
                {modelHealth[model.id] && (
                  <Badge className={healthColors[modelHealth[model.id] as keyof typeof healthColors]}>
                    {modelHealth[model.id]}
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {/* Degraded Mode */}
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">→</span>
            <div className="p-4 border border-dashed rounded flex-1">
              <Badge variant="destructive" className="mb-2">Degraded</Badge>
              <p className="text-sm">{fallbackChain.degradedMessage}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* All Models Health */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Model Health Status</h3>
        <div className="grid grid-cols-3 gap-4">
          {models.map(model => {
            const health = modelHealth[model.id] || model.health;
            return (
              <div key={model.id} className="p-3 border rounded">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-sm">{model.name}</h4>
                    <p className="text-xs text-muted-foreground">{model.provider}</p>
                  </div>
                  <Badge className={healthColors[health as keyof typeof healthColors]}>
                    {health}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Degraded Mode Options */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Degraded Mode Options</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'Cached Response', description: 'Return most similar cached response' },
            { name: 'Static Response', description: 'Return pre-defined fallback message' },
            { name: 'Human Handoff', description: 'Queue request for human response' },
            { name: 'Error', description: 'Return service unavailable error' },
          ].map(option => (
            <div key={option.name} className="p-3 border rounded">
              <h4 className="font-medium text-sm">{option.name}</h4>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CostsTab({
  metrics,
  logs,
}: {
  metrics: CostMetrics;
  logs: RequestLog[];
}) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Total Requests</h4>
          <p className="text-2xl font-bold">{metrics.totalRequests}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Total Cost</h4>
          <p className="text-2xl font-bold">${metrics.totalCost.toFixed(6)}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Cache Hit Rate</h4>
          <p className="text-2xl font-bold text-green-600">
            {(metrics.cacheHitRate * 100).toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Est. Savings</h4>
          <p className="text-2xl font-bold text-green-600">
            ${(metrics.savingsFromCache + metrics.savingsFromRouting).toFixed(4)}
          </p>
        </Card>
      </div>

      {/* Cost by Model */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Cost by Model</h3>
        {Object.keys(metrics.byModel).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(metrics.byModel)
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([modelId, data]) => {
                const model = models.find(m => m.id === modelId);
                const percentage = metrics.totalCost > 0
                  ? (data.cost / metrics.totalCost * 100)
                  : 0;
                return (
                  <div key={modelId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{model?.name || modelId}</span>
                      <span>
                        {data.requests} requests | ${data.cost.toFixed(6)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No requests yet</p>
        )}
      </Card>

      {/* Cost Optimization Strategies */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Cost Optimization Strategies</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Strategy</th>
                <th className="text-left py-2">Savings</th>
                <th className="text-left py-2">Effort</th>
                <th className="text-left py-2">Trade-off</th>
              </tr>
            </thead>
            <tbody>
              {costStrategies.map(strategy => (
                <tr key={strategy.name} className="border-b">
                  <td className="py-3">
                    <div>
                      <span className="font-medium">{strategy.name}</span>
                      <p className="text-xs text-muted-foreground">{strategy.description}</p>
                    </div>
                  </td>
                  <td className="py-3 text-green-600 font-medium">{strategy.savings}</td>
                  <td className="py-3">{strategy.effort}</td>
                  <td className="py-3 text-muted-foreground">{strategy.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
