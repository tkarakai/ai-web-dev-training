'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import {
  runSecurityPipeline,
  redTeamTests,
  runRedTeamTest,
  layerColors,
  type SecurityResult,
  type RedTeamTest,
  type DefenseLayer,
} from '../lib/security';

// Icons
function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

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

function Bug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
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

function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 4 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Play({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function SecurityPage() {
  const [input, setInput] = React.useState('');
  const [context, setContext] = React.useState('');
  const [result, setResult] = React.useState<SecurityResult | null>(null);
  const [showIsolated, setShowIsolated] = React.useState(false);
  const [redTeamResults, setRedTeamResults] = React.useState<
    Array<{ test: RedTeamTest; result: ReturnType<typeof runRedTeamTest> }>
  >([]);
  const [isRunningTests, setIsRunningTests] = React.useState(false);

  const runCheck = () => {
    const securityResult = runSecurityPipeline(input, {
      context: context || undefined,
    });
    setResult(securityResult);
  };

  const loadTest = (test: RedTeamTest) => {
    setInput(test.input);
    setContext(test.context || '');
    setResult(null);
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    const results: Array<{ test: RedTeamTest; result: ReturnType<typeof runRedTeamTest> }> = [];

    for (const test of redTeamTests) {
      const testResult = runRedTeamTest(test);
      results.push({ test, result: testResult });
      // Small delay for visual feedback
      await new Promise((r) => setTimeout(r, 50));
    }

    setRedTeamResults(results);
    setIsRunningTests(false);
  };

  const passedTests = redTeamResults.filter((r) => r.result.passed).length;
  const failedTests = redTeamResults.filter((r) => !r.result.passed).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Lock className="w-8 h-8 text-red-600" />
            AI Security Demo
          </h1>
          <p className="text-muted-foreground">
            Defense-in-depth: prompt injection detection, spotlighting, and output filtering
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Manual Testing */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Security Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">User Input</label>
                  <Textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setResult(null);
                    }}
                    placeholder="Enter user input to check for security issues..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Context (optional - for indirect injection testing)
                  </label>
                  <Textarea
                    value={context}
                    onChange={(e) => {
                      setContext(e.target.value);
                      setResult(null);
                    }}
                    placeholder="Enter context that might contain hidden injections..."
                    className="min-h-[60px] resize-none"
                  />
                </div>

                <Button onClick={runCheck} disabled={!input.trim()}>
                  <Shield className="w-4 h-4 mr-2" />
                  Run Security Check
                </Button>
              </CardContent>
            </Card>

            {/* Result */}
            {result && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {result.safe ? (
                      <>
                        <ShieldCheck className="w-5 h-5 text-green-500" />
                        Input Passed Security Checks
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        Security Issue Detected
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Defense layers */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Defense Layers:
                    </p>
                    {result.checks.map((check, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${
                          check.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {check.passed ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <Badge className={layerColors[check.layer]}>
                              {check.layer.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {check.passed ? 'Passed' : 'Blocked'}
                          </span>
                        </div>
                        {check.reason && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            {check.reason}
                          </p>
                        )}
                        {check.details && (
                          <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono">
                            {JSON.stringify(check.details, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Isolated prompt preview */}
                  {result.isolatedPrompt && (
                    <div>
                      <button
                        onClick={() => setShowIsolated(!showIsolated)}
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        {showIsolated ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        View Isolated Prompt (Spotlighting Applied)
                      </button>
                      {showIsolated && (
                        <pre className="mt-2 p-3 bg-muted/30 rounded-lg text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
                          {result.isolatedPrompt}
                        </pre>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Red Team Tests */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    Red Team Test Suite
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runAllTests}
                    disabled={isRunningTests}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Run All Tests
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {redTeamResults.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">{passedTests} passed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium">{failedTests} failed</span>
                      </div>
                      <div className="flex-1" />
                      <span className="text-sm text-muted-foreground">
                        {((passedTests / redTeamTests.length) * 100).toFixed(0)}% pass rate
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {redTeamTests.map((test) => {
                    const testResult = redTeamResults.find((r) => r.test.id === test.id);
                    return (
                      <div
                        key={test.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/30 ${
                          testResult
                            ? testResult.result.passed
                              ? 'border-green-200 bg-green-50/50'
                              : 'border-red-200 bg-red-50/50'
                            : 'border-border'
                        }`}
                        onClick={() => loadTest(test)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{test.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {test.type}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  test.shouldBlock
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {test.shouldBlock ? 'Should block' : 'Should allow'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {test.description}
                            </p>
                          </div>
                          {testResult && (
                            testResult.result.passed ? (
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Info */}
          <div className="space-y-4">
            {/* Defense Layers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Defense-in-Depth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg border ${layerColors.input_validation}`}>
                    <p className="text-sm font-medium">1. Input Validation</p>
                    <p className="text-xs mt-1 opacity-80">
                      Pattern matching for known injection attempts
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${layerColors.prompt_isolation}`}>
                    <p className="text-sm font-medium">2. Prompt Isolation</p>
                    <p className="text-xs mt-1 opacity-80">
                      Spotlighting to separate data from instructions
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${layerColors.tool_scoping}`}>
                    <p className="text-sm font-medium">3. Tool Scoping</p>
                    <p className="text-xs mt-1 opacity-80">
                      Least privilege access for AI tools
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${layerColors.output_filtering}`}>
                    <p className="text-sm font-medium">4. Output Filtering</p>
                    <p className="text-xs mt-1 opacity-80">
                      Validate outputs for sensitive data leakage
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attack Types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Injection Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Direct Injection</p>
                    <p className="text-xs text-muted-foreground">
                      User directly attempts to override instructions
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Indirect Injection</p>
                    <p className="text-xs text-muted-foreground">
                      Hidden in documents, emails, or web content
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Encoded Injection</p>
                    <p className="text-xs text-muted-foreground">
                      Base64, special tokens, or obfuscated payloads
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Confused Deputy</p>
                    <p className="text-xs text-muted-foreground">
                      Trick AI into attacking your own systems
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li>• No single defense is sufficient</li>
                  <li>• Treat all user input as untrusted data</li>
                  <li>• Use spotlighting to isolate content</li>
                  <li>• Minimize tool privileges (least privilege)</li>
                  <li>• Validate outputs for sensitive data</li>
                  <li>• Run continuous red team testing</li>
                  <li>• Monitor for new attack patterns</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
