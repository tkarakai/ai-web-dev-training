'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import {
  scanContent,
  sampleTexts,
  severityColors,
  classificationColors,
  type SampleTextKey,
  type ScanResult,
  type Detection,
} from '../lib/guardrails';

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

function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
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

function Key({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function getDetectionIcon(type: Detection['type']) {
  switch (type) {
    case 'api_key':
    case 'github_token':
    case 'aws_key':
    case 'jwt_token':
      return Key;
    case 'password':
    case 'private_key':
      return Lock;
    case 'email':
    case 'phone':
    case 'ssn':
    case 'credit_card':
      return User;
    default:
      return AlertTriangle;
  }
}

export default function GuardrailsPage() {
  const [content, setContent] = React.useState('');
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null);
  const [showRedacted, setShowRedacted] = React.useState(false);

  const handleScan = () => {
    if (!content.trim()) return;
    const result = scanContent(content);
    setScanResult(result);
  };

  const loadSample = (key: SampleTextKey) => {
    setContent(sampleTexts[key].content);
    setScanResult(null);
    setShowRedacted(false);
  };

  const criticalCount = scanResult?.detections.filter((d) => d.severity === 'critical').length || 0;
  const highCount = scanResult?.detections.filter((d) => d.severity === 'high').length || 0;
  const mediumCount = scanResult?.detections.filter((d) => d.severity === 'medium').length || 0;
  const lowCount = scanResult?.detections.filter((d) => d.severity === 'low').length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-600" />
            Operational Guardrails
          </h1>
          <p className="text-muted-foreground">
            Detect and redact PII, secrets, and sensitive data before sending to LLMs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Input */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Content to Scan</CardTitle>
                  <div className="flex gap-1">
                    {(Object.keys(sampleTexts) as SampleTextKey[]).map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => loadSample(key)}
                      >
                        {sampleTexts[key].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setScanResult(null);
                  }}
                  placeholder="Paste code, configuration, or text to scan for sensitive data..."
                  className="min-h-[250px] font-mono text-sm resize-none"
                />
                <Button onClick={handleScan} disabled={!content.trim()} className="w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  Scan for Sensitive Data
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {scanResult && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {scanResult.safe ? (
                        <>
                          <ShieldCheck className="w-5 h-5 text-green-500" />
                          Safe to Send
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-5 h-5 text-red-500" />
                          Sensitive Data Detected
                        </>
                      )}
                    </CardTitle>
                    {scanResult.detections.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRedacted(!showRedacted)}
                      >
                        {showRedacted ? (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Show Original
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Show Redacted
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary stats */}
                  <div className="flex flex-wrap gap-2">
                    {criticalCount > 0 && (
                      <Badge className="bg-red-100 text-red-700">
                        {criticalCount} Critical
                      </Badge>
                    )}
                    {highCount > 0 && (
                      <Badge className="bg-orange-100 text-orange-700">
                        {highCount} High
                      </Badge>
                    )}
                    {mediumCount > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-700">
                        {mediumCount} Medium
                      </Badge>
                    )}
                    {lowCount > 0 && (
                      <Badge className="bg-blue-100 text-blue-700">
                        {lowCount} Low
                      </Badge>
                    )}
                    {scanResult.detections.length === 0 && (
                      <Badge className="bg-green-100 text-green-700">
                        No Issues Found
                      </Badge>
                    )}
                  </div>

                  {/* Redacted content view */}
                  {showRedacted && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">
                        Redacted Content (safe to send):
                      </p>
                      <pre className="font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                        {scanResult.redactedContent}
                      </pre>
                    </div>
                  )}

                  {/* Detection list */}
                  {scanResult.detections.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Detections:</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {scanResult.detections.map((detection, i) => {
                          const Icon = getDetectionIcon(detection.type);
                          return (
                            <div
                              key={i}
                              className={`p-3 rounded-lg border ${severityColors[detection.severity]}`}
                            >
                              <div className="flex items-start gap-3">
                                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">
                                      {detection.type.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {detection.severity}
                                    </Badge>
                                  </div>
                                  <div className="font-mono text-xs bg-white/50 p-2 rounded truncate">
                                    {detection.value.length > 50
                                      ? detection.value.slice(0, 50) + '...'
                                      : detection.value}
                                  </div>
                                  <p className="text-xs mt-1 opacity-75">
                                    Will be replaced with: {detection.redacted}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Classification & Info */}
          <div className="space-y-4">
            {/* Classification Result */}
            {scanResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Data Classification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={`p-4 rounded-lg text-center ${
                      classificationColors[scanResult.classification.classification]
                    }`}
                  >
                    <p className="text-lg font-bold uppercase">
                      {scanResult.classification.classification}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {scanResult.classification.canSendToLLM ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {scanResult.classification.canSendToLLM
                          ? 'Can send to LLM'
                          : 'Should NOT send to LLM'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {scanResult.classification.requiresApproval ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <span className="text-sm">
                        {scanResult.classification.requiresApproval
                          ? 'Requires approval'
                          : 'No approval needed'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Reasons:
                    </p>
                    <ul className="text-xs space-y-1">
                      {scanResult.classification.reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Classification Guide */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Classification Guide</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-green-100 text-green-700 mt-0.5">Public</Badge>
                    <p className="text-xs text-muted-foreground">
                      Open source code, public docs, published APIs
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-700 mt-0.5">Internal</Badge>
                    <p className="text-xs text-muted-foreground">
                      Proprietary code, internal docs, architecture
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-orange-100 text-orange-700 mt-0.5">Confidential</Badge>
                    <p className="text-xs text-muted-foreground">
                      Customer data, business metrics, contracts
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-red-100 text-red-700 mt-0.5">Restricted</Badge>
                    <p className="text-xs text-muted-foreground">
                      Secrets, credentials, PII, health/financial data
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What Never Goes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Never Send to LLMs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Key className="w-3 h-3 mt-0.5 text-red-500" />
                    API keys and tokens
                  </li>
                  <li className="flex items-start gap-2">
                    <Lock className="w-3 h-3 mt-0.5 text-red-500" />
                    Passwords and private keys
                  </li>
                  <li className="flex items-start gap-2">
                    <User className="w-3 h-3 mt-0.5 text-red-500" />
                    Personal identifiable information (PII)
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 text-red-500" />
                    Credit card numbers, SSNs
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-3 h-3 mt-0.5 text-red-500" />
                    Health or financial records
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-2 text-muted-foreground">
                  <li>• Always scan before sending to LLMs</li>
                  <li>• Use redacted versions for prompts</li>
                  <li>• Keep secrets in environment variables</li>
                  <li>• Use synthetic data for examples</li>
                  <li>• Review AI suggestions before applying</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
