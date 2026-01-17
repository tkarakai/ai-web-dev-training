'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import {
  runModerationPipeline,
  sampleInputs,
  rateLimiter,
  type SampleInputKey,
  type ModerationResult,
  type ModerationLog,
  type RateLimitStatus,
  createModerationLog,
} from '../lib/moderation';

// Icons
function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Layers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function Gauge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  );
}

function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Ban({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function Edit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function getActionIcon(action: ModerationResult['action']) {
  switch (action) {
    case 'allowed':
      return CheckCircle;
    case 'blocked':
      return Ban;
    case 'flagged':
      return AlertTriangle;
    case 'modified':
      return Edit;
  }
}

function getActionColor(action: ModerationResult['action']) {
  switch (action) {
    case 'allowed':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'blocked':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'flagged':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'modified':
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

export default function ModerationPage() {
  const [input, setInput] = React.useState('');
  const [tier, setTier] = React.useState<'free' | 'pro' | 'enterprise'>('free');
  const [userId] = React.useState('demo-user');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [currentResult, setCurrentResult] = React.useState<ModerationResult | null>(null);
  const [logs, setLogs] = React.useState<ModerationLog[]>([]);
  const [rateLimitStatus, setRateLimitStatus] = React.useState<RateLimitStatus | null>(null);

  const loadSample = (key: SampleInputKey) => {
    setInput(sampleInputs[key].text);
    setCurrentResult(null);
  };

  const runModeration = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    try {
      const result = await runModerationPipeline(input, { userId, tier });
      setCurrentResult(result);

      // Create log entry
      const log = createModerationLog(input, result, userId);
      setLogs((prev) => [log, ...prev].slice(0, 20));

      // Update rate limit status
      const status = {
        allowed: result.action !== 'blocked' || result.reason?.includes('Rate limit'),
        remaining: tier === 'free' ? 4 : tier === 'pro' ? 49 : 499,
        limit: tier === 'free' ? 5 : tier === 'pro' ? 50 : 500,
        resetInSeconds: 60,
      };
      setRateLimitStatus(status);
    } catch (error) {
      console.error('Moderation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRateLimit = () => {
    rateLimiter.reset(userId, tier);
    setRateLimitStatus(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Moderation Pipeline
          </h1>
          <p className="text-muted-foreground">
            Layered defense with pre-generation filters, rate limiting, and post-generation checks
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Test Content</CardTitle>
                  <div className="flex gap-1">
                    {(Object.keys(sampleInputs) as SampleInputKey[]).map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => loadSample(key)}
                      >
                        {sampleInputs[key].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setCurrentResult(null);
                  }}
                  placeholder="Enter content to test moderation..."
                  className="min-h-[100px] resize-none"
                />

                <div className="flex items-center gap-4">
                  {/* Tier selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tier:</span>
                    <div className="flex gap-1">
                      {(['free', 'pro', 'enterprise'] as const).map((t) => (
                        <Button
                          key={t}
                          variant={tier === t ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setTier(t)}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1" />

                  <Button onClick={runModeration} disabled={isProcessing || !input.trim()}>
                    {isProcessing ? 'Processing...' : 'Run Moderation'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Result Card */}
            {currentResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {(() => {
                      const Icon = getActionIcon(currentResult.action);
                      return <Icon className="w-5 h-5" />;
                    })()}
                    Moderation Result
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Action Badge */}
                  <div className="flex items-center gap-3">
                    <Badge className={`text-sm ${getActionColor(currentResult.action)}`}>
                      {currentResult.action.toUpperCase()}
                    </Badge>
                    {currentResult.layer && (
                      <Badge variant="outline" className="text-xs">
                        Layer: {currentResult.layer}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {currentResult.latencyMs}ms
                    </span>
                  </div>

                  {/* Reason */}
                  {currentResult.reason && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm">{currentResult.reason}</p>
                    </div>
                  )}

                  {/* Modified content */}
                  {currentResult.modified && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Modified output:</p>
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                        {currentResult.modified}
                      </div>
                    </div>
                  )}

                  {/* Categories */}
                  {currentResult.categories && currentResult.categories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Content Analysis:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {currentResult.categories.map((cat) => (
                          <div
                            key={cat.name}
                            className={`p-2 rounded-lg border ${
                              cat.flagged
                                ? 'bg-red-50 border-red-200'
                                : 'bg-green-50 border-green-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium capitalize">{cat.name}</span>
                              {cat.flagged && (
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    cat.flagged ? 'bg-red-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${cat.score * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {(cat.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Logs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Moderation Log</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No moderation events yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {logs.map((log) => {
                      const Icon = getActionIcon(log.result.action);
                      return (
                        <div
                          key={log.id}
                          className={`p-3 rounded-lg border ${getActionColor(log.result.action)}`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {log.result.action}
                                </Badge>
                                {log.result.layer && (
                                  <span className="text-xs text-muted-foreground">
                                    {log.result.layer}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs truncate">{log.input}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Info */}
          <div className="space-y-4">
            {/* Rate Limit Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Rate Limit Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-3xl font-bold">
                    {rateLimitStatus ? rateLimitStatus.remaining : '--'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {rateLimitStatus?.limit || '--'} remaining
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current tier:</span>
                    <Badge variant="outline">{tier}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Limit:</span>
                    <span>
                      {tier === 'free' ? '5' : tier === 'pro' ? '50' : '500'}/min
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={resetRateLimit}
                >
                  Reset Rate Limit
                </Button>
              </CardContent>
            </Card>

            {/* Layers Explanation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Moderation Layers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-sm font-medium text-blue-700">1. Pre-Generation</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Keyword blocklist, content classification before LLM call
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <p className="text-sm font-medium text-purple-700">2. Model Level</p>
                    <p className="text-xs text-purple-600 mt-1">
                      Built-in safety settings, system prompt guidelines
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-700">3. Post-Generation</p>
                    <p className="text-xs text-green-600 mt-1">
                      PII detection, jailbreak indicators, output validation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li>• Use multiple layers - no single filter catches everything</li>
                  <li>• Log events without exposing sensitive content</li>
                  <li>• Provide clear feedback when content is blocked</li>
                  <li>• Implement appeals process for false positives</li>
                  <li>• Balance security with user experience</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
