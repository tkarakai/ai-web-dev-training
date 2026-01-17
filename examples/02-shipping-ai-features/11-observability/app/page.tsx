'use client';

import { useState, useCallback } from 'react';
import { Card } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { generateId } from '@examples/shared/lib/utils';
import {
  Trace,
  Span,
  RequestLog,
  QualityMetrics,
  CostMetrics,
  DriftAlert,
  BaselineMetrics,
  CostTracker,
  QualityMonitor,
  calculateCost,
  detectDrift,
  simulateTrace,
  sampleBaseline,
  sampleFeatures,
  sampleTenants,
  spanColors,
  severityColors,
} from '../lib/observability';

type Tab = 'tracing' | 'costs' | 'quality' | 'drift';

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tracing');
  const [traces, setTraces] = useState<Trace[]>([]);
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);

  // Persistent trackers
  const [costTracker] = useState(() => {
    const tracker = new CostTracker();
    sampleTenants.forEach(t => tracker.setBudget(t.id, t.budget, 0.8));
    return tracker;
  });
  const [qualityMonitor] = useState(() => new QualityMonitor());

  // Simulate a request and generate trace data
  const simulateRequest = useCallback(() => {
    const feature = sampleFeatures[Math.floor(Math.random() * sampleFeatures.length)];
    const tenant = sampleTenants[Math.floor(Math.random() * sampleTenants.length)];

    // Generate trace
    const trace = simulateTrace(feature.id);
    setTraces(prev => [trace, ...prev].slice(0, 20));

    // Calculate tokens from trace
    const modelSpan = trace.spans.find(s => s.name === 'model.call');
    const inputTokens = (modelSpan?.attributes['model.inputTokens'] as number) || 100;
    const outputTokens = (modelSpan?.attributes['model.outputTokens'] as number) || 50;

    // Create request log
    const isError = Math.random() > 0.92;
    const isRefused = !isError && Math.random() > 0.95;
    const log: RequestLog = {
      id: generateId('req'),
      timestamp: Date.now(),
      feature: feature.id,
      model: feature.model,
      tenantId: tenant.id,
      userId: `user-${Math.floor(Math.random() * 100)}`,
      inputTokens,
      outputTokens,
      latencyMs: trace.totalDurationMs || 0,
      cost: calculateCost({ inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }, feature.model),
      success: !isError,
      refused: isRefused,
      error: isError ? 'Request failed' : undefined,
    };

    // Record in trackers
    const { budgetAlert } = costTracker.recordRequest(log);
    if (budgetAlert) {
      setBudgetAlerts(prev => [budgetAlert, ...prev].slice(0, 5));
    }
    qualityMonitor.recordRequest(log);

    setRequestLogs(prev => [log, ...prev].slice(0, 50));

    // Update metrics
    setCostMetrics(costTracker.getMetrics());
    setQualityMetrics(qualityMonitor.getMetrics());
  }, [costTracker, qualityMonitor]);

  // Simulate multiple requests
  const simulateBatch = useCallback(() => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => simulateRequest(), i * 100);
    }
  }, [simulateRequest]);

  // Run drift detection
  const runDriftDetection = useCallback(() => {
    // Generate "current" metrics from logs
    const logs = requestLogs;
    if (logs.length < 5) {
      return;
    }

    const current: BaselineMetrics = {
      avgLatencyMs: logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length,
      avgResponseLength: logs.reduce((sum, l) => sum + l.outputTokens * 4, 0) / logs.length,
      successRate: logs.filter(l => l.success && !l.refused).length / logs.length,
      refusalRate: logs.filter(l => l.refused).length / logs.length,
      avgInputTokens: logs.reduce((sum, l) => sum + l.inputTokens, 0) / logs.length,
      avgOutputTokens: logs.reduce((sum, l) => sum + l.outputTokens, 0) / logs.length,
    };

    const alerts = detectDrift(current, sampleBaseline);
    setDriftAlerts(alerts);
  }, [requestLogs]);

  // Record feedback
  const recordFeedback = useCallback((logId: string, feedback: 'helpful' | 'not_helpful') => {
    qualityMonitor.recordFeedback(logId, feedback);
    setRequestLogs(prev => prev.map(l =>
      l.id === logId ? { ...l, feedback } : l
    ));
    setQualityMetrics(qualityMonitor.getMetrics());
  }, [qualityMonitor]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tracing', label: 'Tracing' },
    { id: 'costs', label: 'Cost Tracking' },
    { id: 'quality', label: 'Quality Metrics' },
    { id: 'drift', label: 'Drift Detection' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">LLM Observability</h1>
          <p className="text-muted-foreground mt-2">
            End-to-end tracing, cost tracking, quality metrics, and drift detection
          </p>
        </div>

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <Card className="p-4 bg-red-50 border-red-200">
            <h3 className="font-semibold text-red-800 mb-2">Budget Alerts</h3>
            <div className="space-y-1">
              {budgetAlerts.map((alert, i) => (
                <p key={i} className="text-sm text-red-700">{alert}</p>
              ))}
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex gap-4">
          <Button onClick={simulateRequest}>Simulate Request</Button>
          <Button onClick={simulateBatch} variant="outline">Simulate 10 Requests</Button>
          {activeTab === 'drift' && (
            <Button onClick={runDriftDetection} variant="outline">Run Drift Detection</Button>
          )}
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
          {activeTab === 'tracing' && (
            <TracingTab
              traces={traces}
              selectedTrace={selectedTrace}
              onSelectTrace={setSelectedTrace}
            />
          )}

          {activeTab === 'costs' && (
            <CostsTab
              metrics={costMetrics}
              logs={requestLogs}
            />
          )}

          {activeTab === 'quality' && (
            <QualityTab
              metrics={qualityMetrics}
              logs={requestLogs}
              onFeedback={recordFeedback}
            />
          )}

          {activeTab === 'drift' && (
            <DriftTab
              alerts={driftAlerts}
              baseline={sampleBaseline}
              logs={requestLogs}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function TracingTab({
  traces,
  selectedTrace,
  onSelectTrace,
}: {
  traces: Trace[];
  selectedTrace: Trace | null;
  onSelectTrace: (trace: Trace | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Trace List */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Recent Traces</h3>
        {traces.length === 0 ? (
          <p className="text-muted-foreground text-sm">No traces yet. Simulate a request to generate traces.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {traces.map(trace => (
              <button
                key={trace.id}
                onClick={() => onSelectTrace(selectedTrace?.id === trace.id ? null : trace)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  selectedTrace?.id === trace.id
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted/50 border-border'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-sm">{trace.name}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      {trace.spans.length} spans | {trace.totalDurationMs}ms
                    </div>
                  </div>
                  <Badge variant={trace.status === 'ok' ? 'success' : 'destructive'}>
                    {trace.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {trace.totalTokens} tokens | ${trace.totalCost.toFixed(6)}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Trace Detail */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Trace Detail</h3>
        {selectedTrace ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Trace ID:</span>
                <span className="ml-2 font-mono">{selectedTrace.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <span className="ml-2">{selectedTrace.totalDurationMs}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Tokens:</span>
                <span className="ml-2">{selectedTrace.totalTokens}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cost:</span>
                <span className="ml-2">${selectedTrace.totalCost.toFixed(6)}</span>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Spans</h4>
              <div className="space-y-2">
                {selectedTrace.spans.map((span, index) => (
                  <SpanView key={span.id} span={span} index={index} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Select a trace to view details</p>
        )}
      </Card>
    </div>
  );
}

function SpanView({ span, index }: { span: Span; index: number }) {
  const colorClass = spanColors[span.name] || 'bg-gray-100 border-gray-300';

  return (
    <div className={`p-3 rounded border-l-4 ${colorClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="font-mono text-sm font-medium">{span.name}</span>
          <div className="text-xs text-muted-foreground">
            {span.durationMs}ms
          </div>
        </div>
        <Badge variant={span.status === 'ok' ? 'success' : 'destructive'} className="text-xs">
          {span.status}
        </Badge>
      </div>

      {Object.keys(span.attributes).length > 0 && (
        <div className="mt-2 text-xs space-y-1">
          {Object.entries(span.attributes).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-mono">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {span.events.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {span.events.map((event, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {event.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function CostsTab({
  metrics,
  logs,
}: {
  metrics: CostMetrics | null;
  logs: RequestLog[];
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Total Cost</h4>
          <p className="text-2xl font-bold">${metrics?.total.toFixed(4) || '0.0000'}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Total Requests</h4>
          <p className="text-2xl font-bold">{logs.length}</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Avg Cost/Request</h4>
          <p className="text-2xl font-bold">
            ${logs.length > 0 ? ((metrics?.total || 0) / logs.length).toFixed(6) : '0.000000'}
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Models Used</h4>
          <p className="text-2xl font-bold">{Object.keys(metrics?.byModel || {}).length}</p>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Cost by Model</h3>
          {metrics && Object.keys(metrics.byModel).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(metrics.byModel)
                .sort((a, b) => b[1] - a[1])
                .map(([model, cost]) => (
                  <div key={model} className="flex justify-between text-sm">
                    <span className="font-mono">{model}</span>
                    <span>${cost.toFixed(6)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Cost by Feature</h3>
          {metrics && Object.keys(metrics.byFeature).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(metrics.byFeature)
                .sort((a, b) => b[1] - a[1])
                .map(([feature, cost]) => (
                  <div key={feature} className="flex justify-between text-sm">
                    <span>{feature}</span>
                    <span>${cost.toFixed(6)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Cost by Tenant</h3>
          {metrics && Object.keys(metrics.byTenant).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(metrics.byTenant)
                .sort((a, b) => b[1] - a[1])
                .map(([tenant, cost]) => {
                  const tenantInfo = sampleTenants.find(t => t.id === tenant);
                  const budgetPercent = tenantInfo ? (cost / tenantInfo.budget) * 100 : 0;
                  return (
                    <div key={tenant}>
                      <div className="flex justify-between text-sm">
                        <span>{tenant}</span>
                        <span>${cost.toFixed(6)}</span>
                      </div>
                      {tenantInfo && (
                        <div className="mt-1">
                          <div className="h-2 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full ${budgetPercent > 100 ? 'bg-red-500' : budgetPercent > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {budgetPercent.toFixed(1)}% of ${tenantInfo.budget.toFixed(2)} budget
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function QualityTab({
  metrics,
  logs,
  onFeedback,
}: {
  metrics: QualityMetrics | null;
  logs: RequestLog[];
  onFeedback: (logId: string, feedback: 'helpful' | 'not_helpful') => void;
}) {
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Success Rate</h4>
          <p className={`text-2xl font-bold ${
            (metrics?.successRate || 0) >= 0.95 ? 'text-green-600' :
            (metrics?.successRate || 0) >= 0.9 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {((metrics?.successRate || 0) * 100).toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Error Rate</h4>
          <p className={`text-2xl font-bold ${
            (metrics?.errorRate || 0) <= 0.02 ? 'text-green-600' :
            (metrics?.errorRate || 0) <= 0.05 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {((metrics?.errorRate || 0) * 100).toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Avg Latency</h4>
          <p className="text-2xl font-bold">{metrics?.avgLatencyMs.toFixed(0) || 0}ms</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">P95 Latency</h4>
          <p className="text-2xl font-bold">{metrics?.p95LatencyMs.toFixed(0) || 0}ms</p>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm text-muted-foreground">Feedback Ratio</h4>
          <p className={`text-2xl font-bold ${
            (metrics?.feedback.ratio || 0) >= 0.8 ? 'text-green-600' :
            (metrics?.feedback.ratio || 0) >= 0.6 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {((metrics?.feedback.ratio || 0) * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {metrics?.feedback.helpful || 0} helpful / {metrics?.feedback.notHelpful || 0} not
          </p>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Recent Requests</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Feature</th>
                <th className="text-left py-2">Model</th>
                <th className="text-left py-2">Latency</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map(log => (
                <tr key={log.id} className="border-b">
                  <td className="py-2 font-mono text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2">{log.feature}</td>
                  <td className="py-2 font-mono text-xs">{log.model}</td>
                  <td className="py-2">{log.latencyMs}ms</td>
                  <td className="py-2">
                    <Badge variant={
                      log.refused ? 'secondary' :
                      log.success ? 'success' : 'destructive'
                    }>
                      {log.refused ? 'refused' : log.success ? 'success' : 'error'}
                    </Badge>
                  </td>
                  <td className="py-2">
                    {log.feedback ? (
                      <Badge variant={log.feedback === 'helpful' ? 'success' : 'destructive'}>
                        {log.feedback === 'helpful' ? 'Helpful' : 'Not Helpful'}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onFeedback(log.id, 'helpful')}
                          className="p-1 hover:bg-green-100 rounded text-green-600"
                          title="Mark as helpful"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onFeedback(log.id, 'not_helpful')}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Mark as not helpful"
                        >
                          -
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DriftTab({
  alerts,
  baseline,
  logs,
}: {
  alerts: DriftAlert[];
  baseline: BaselineMetrics;
  logs: RequestLog[];
}) {
  const currentMetrics: Partial<BaselineMetrics> = logs.length > 0 ? {
    avgLatencyMs: logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length,
    avgResponseLength: logs.reduce((sum, l) => sum + l.outputTokens * 4, 0) / logs.length,
    successRate: logs.filter(l => l.success && !l.refused).length / logs.length,
    refusalRate: logs.filter(l => l.refused).length / logs.length,
    avgInputTokens: logs.reduce((sum, l) => sum + l.inputTokens, 0) / logs.length,
    avgOutputTokens: logs.reduce((sum, l) => sum + l.outputTokens, 0) / logs.length,
  } : {};

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Drift Detection</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Compares current metrics against baseline to detect significant changes in model behavior,
          prompt effectiveness, or data patterns.
        </p>

        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded border ${severityColors[alert.severity]}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="mb-2">{alert.type} drift</Badge>
                    <h4 className="font-medium">{alert.metric}</h4>
                    <p className="text-sm mt-1">
                      Changed by {alert.changePercent.toFixed(1)}% from baseline
                    </p>
                  </div>
                  <Badge variant={
                    alert.severity === 'high' ? 'destructive' :
                    alert.severity === 'medium' ? 'secondary' : 'outline'
                  }>
                    {alert.severity}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Baseline:</span>
                    <span className="ml-2 font-mono">{alert.baselineValue.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current:</span>
                    <span className="ml-2 font-mono">{alert.currentValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {logs.length < 5
              ? 'Need at least 5 requests to run drift detection'
              : 'No drift detected. Click "Run Drift Detection" to check.'}
          </p>
        )}
      </Card>

      {/* Baseline vs Current */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Baseline Metrics</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(baseline).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Current Metrics</h3>
          {logs.length > 0 ? (
            <div className="space-y-2 text-sm">
              {Object.entries(currentMetrics).map(([key, value]) => {
                const baseVal = baseline[key as keyof BaselineMetrics];
                const change = baseVal ? ((value as number) - baseVal) / baseVal * 100 : 0;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span>
                      <span className="font-mono">{(value as number).toFixed(2)}</span>
                      {change !== 0 && (
                        <span className={`ml-2 text-xs ${change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({change > 0 ? '+' : ''}{change.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
