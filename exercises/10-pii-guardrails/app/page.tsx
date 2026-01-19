'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * PII Detection & Guardrails Demo
 *
 * See PII detection and redaction in action.
 */

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  riskLevel: RiskLevel;
}

interface ScanResult {
  originalText: string;
  redactedText: string;
  matches: PIIMatch[];
  hasHighRisk: boolean;
  riskSummary: Record<RiskLevel, number>;
}

const SAMPLE_TEXTS = [
  'Contact john.doe@example.com or call (555) 123-4567 for help.',
  'My SSN is 123-45-6789 and card is 4111111111111111',
  'API key: sk_example_abc123def456ghi789jkl',
  'Send to 123 Main Street, Apt 4B. IP: 192.168.1.100',
  'Dr. John Smith, born 01/15/1980, License: DL#ABC12345',
];

export default function PIIGuardrailsPage() {
  const [text, setText] = useState(SAMPLE_TEXTS[0]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [preset, setPreset] = useState<'strict' | 'moderate' | 'minimal'>('strict');
  const [guardrailResult, setGuardrailResult] = useState<{ allowed: boolean; reason?: string } | null>(null);

  const runScan = useCallback(async () => {
    const { createScanner, applyGuardrails } = await import('@/lib/pii-guardrails');
    const scanner = createScanner(preset);
    const result = scanner.scan(text);
    const guardrail = applyGuardrails(text, scanner, {
      blockOnCritical: true,
      blockOnHigh: preset === 'strict',
    });

    setScanResult(result);
    setGuardrailResult({ allowed: guardrail.allowed, reason: guardrail.reason });
  }, [text, preset]);

  // Auto-scan on text change
  useMemo(() => {
    if (text) {
      runScan();
    }
  }, [text, preset, runScan]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Exercise 10: PII Detection & Guardrails</h1>
        <p className="text-gray-400 mt-2">
          Study <code className="text-blue-400">lib/pii-guardrails.ts</code> - detect and redact
          sensitive data.
        </p>
      </header>

      {/* Input Section */}
      <section className="bg-gray-800 p-6 rounded-lg space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Input Text</h2>
          <div className="flex gap-2">
            {(['strict', 'moderate', 'minimal'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1 text-sm rounded capitalize ${
                  preset === p ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEXTS.map((sample, i) => (
            <button
              key={i}
              onClick={() => setText(sample)}
              className={`px-3 py-1 text-xs rounded ${
                text === sample ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Sample {i + 1}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 min-h-[100px] font-mono text-sm"
          placeholder="Enter text to scan for PII..."
        />
      </section>

      {/* Results */}
      {scanResult && (
        <>
          {/* Guardrail Status */}
          <section
            className={`p-4 rounded-lg border ${
              guardrailResult?.allowed
                ? 'border-green-700 bg-green-900/20'
                : 'border-red-700 bg-red-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{guardrailResult?.allowed ? '✓' : '✗'}</span>
              <div>
                <p className="font-medium">
                  {guardrailResult?.allowed ? 'ALLOWED' : 'BLOCKED'}
                </p>
                {guardrailResult?.reason && (
                  <p className="text-sm text-gray-400">{guardrailResult.reason}</p>
                )}
              </div>
            </div>
          </section>

          {/* Risk Summary */}
          <section className="grid grid-cols-4 gap-4">
            {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((level) => (
              <RiskCard
                key={level}
                level={level}
                count={scanResult.riskSummary[level]}
              />
            ))}
          </section>

          {/* Redacted Output */}
          <section className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold">Redacted Text</h2>
            <div className="bg-gray-900 p-4 rounded font-mono text-sm whitespace-pre-wrap">
              {scanResult.redactedText || '(empty)'}
            </div>
          </section>

          {/* Matches */}
          {scanResult.matches.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">
                Detected PII ({scanResult.matches.length})
              </h2>
              <div className="space-y-2">
                {scanResult.matches.map((match, i) => (
                  <MatchCard key={i} match={match} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Pattern Reference */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Supported PII Types</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <PIITypeGroup
            title="Critical Risk"
            types={['SSN', 'Credit Card', 'Bank Account', 'API Key', 'Passport']}
          />
          <PIITypeGroup
            title="High/Medium Risk"
            types={['Email', 'Phone', 'Address', 'DOB', "Driver's License"]}
          />
          <PIITypeGroup
            title="Low Risk"
            types={['IP Address', 'Names (with titles)']}
          />
        </div>
      </section>

      {/* Code Reference */}
      <section className="bg-gray-800 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Study the Code</h3>
        <ul className="space-y-1 text-gray-400">
          <li>
            <code className="text-blue-400">lib/pii-guardrails.ts</code> - Patterns, scanner,
            redaction, guardrails
          </li>
          <li>
            <code className="text-blue-400">lib/pii-guardrails.test.ts</code> - Comprehensive
            detection tests
          </li>
        </ul>
      </section>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function RiskCard({ level, count }: { level: RiskLevel; count: number }) {
  const colors: Record<RiskLevel, string> = {
    critical: 'border-red-700 bg-red-900/20 text-red-400',
    high: 'border-orange-700 bg-orange-900/20 text-orange-400',
    medium: 'border-yellow-700 bg-yellow-900/20 text-yellow-400',
    low: 'border-gray-600 bg-gray-800/50 text-gray-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[level]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm capitalize">{level}</p>
    </div>
  );
}

function MatchCard({ match }: { match: PIIMatch }) {
  const colors: Record<RiskLevel, string> = {
    critical: 'border-red-700 bg-red-900/10',
    high: 'border-orange-700 bg-orange-900/10',
    medium: 'border-yellow-700 bg-yellow-900/10',
    low: 'border-gray-600 bg-gray-800/30',
  };

  return (
    <div className={`p-3 rounded border ${colors[match.riskLevel]}`}>
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase font-medium text-gray-400">
            {match.type}
          </span>
          <p className="font-mono text-sm mt-1">{match.value}</p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded capitalize ${
            match.riskLevel === 'critical'
              ? 'bg-red-900 text-red-300'
              : match.riskLevel === 'high'
              ? 'bg-orange-900 text-orange-300'
              : match.riskLevel === 'medium'
              ? 'bg-yellow-900 text-yellow-300'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {match.riskLevel}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Position: {match.start}-{match.end}
      </p>
    </div>
  );
}

function PIITypeGroup({ title, types }: { title: string; types: string[] }) {
  return (
    <div>
      <h3 className="font-medium text-gray-300 mb-2">{title}</h3>
      <ul className="space-y-1 text-gray-400">
        {types.map((type) => (
          <li key={type}>&bull; {type}</li>
        ))}
      </ul>
    </div>
  );
}
