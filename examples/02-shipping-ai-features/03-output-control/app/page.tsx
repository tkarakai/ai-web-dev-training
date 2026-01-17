'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@examples/shared/components/ui/card';
import { Button } from '@examples/shared/components/ui/button';
import { Badge } from '@examples/shared/components/ui/badge';
import { Textarea } from '@examples/shared/components/ui/textarea';
import {
  FileJson,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wrench,
  Copy,
  RefreshCw,
  Info,
  Code,
} from 'lucide-react';
import { SCHEMAS, type SchemaKey, zodToJsonSchema, extractJson, repairJson } from '../lib/schemas';

type ValidationResult = {
  success: boolean;
  data?: any;
  error?: string;
  rawOutput?: string;
  repairedJson?: string;
  repairAttempted?: boolean;
};

export default function OutputControlPage() {
  const [selectedSchema, setSelectedSchema] = React.useState<SchemaKey>('contact');
  const [input, setInput] = React.useState(SCHEMAS.contact.example);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ValidationResult | null>(null);
  const [showSchema, setShowSchema] = React.useState(false);
  const [showMetadata, setShowMetadata] = React.useState(true);
  const [showRawData, setShowRawData] = React.useState(false);
  const [autoRepair, setAutoRepair] = React.useState(true);

  const schemaInfo = SCHEMAS[selectedSchema];
  const jsonSchema = zodToJsonSchema(schemaInfo.schema);

  const handleSchemaChange = (key: SchemaKey) => {
    setSelectedSchema(key);
    setInput(SCHEMAS[key].example);
    setResult(null);
  };

  const buildPrompt = () => {
    return `Extract structured information from the following text and return ONLY valid JSON matching this schema:

${JSON.stringify(jsonSchema, null, 2)}

Text to analyze:
"""
${input}
"""

Return ONLY the JSON object, no additional text or explanation.`;
  };

  const handleExtract = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('http://127.0.0.1:8033/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'You are a JSON extraction assistant. You ONLY output valid JSON matching the requested schema. Never include explanations or markdown formatting.',
            },
            {
              role: 'user',
              content: buildPrompt(),
            },
          ],
          temperature: 0.1, // Low temperature for consistent JSON
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const rawOutput = data.choices?.[0]?.message?.content || '';

      // Try to parse JSON
      let jsonToParse = rawOutput;
      let repairAttempted = false;
      let repairedJson: string | undefined;

      // Try direct parsing first
      try {
        const parsed = JSON.parse(rawOutput);
        const validated = schemaInfo.schema.safeParse(parsed);

        if (validated.success) {
          setResult({
            success: true,
            data: validated.data,
            rawOutput,
          });
          return;
        }
      } catch (e) {
        // Direct parsing failed, try repair if enabled
      }

      // Try repair if enabled
      if (autoRepair) {
        repairAttempted = true;
        const extracted = extractJson(rawOutput);

        if (extracted) {
          repairedJson = extracted;
          try {
            const parsed = JSON.parse(extracted);
            const validated = schemaInfo.schema.safeParse(parsed);

            if (validated.success) {
              setResult({
                success: true,
                data: validated.data,
                rawOutput,
                repairedJson,
                repairAttempted,
              });
              return;
            } else {
              setResult({
                success: false,
                error: `Schema validation failed: ${validated.error.issues.map(i => i.message).join(', ')}`,
                rawOutput,
                repairedJson,
                repairAttempted,
              });
              return;
            }
          } catch (parseError) {
            // Repair didn't help
          }
        }
      }

      // All parsing attempts failed
      setResult({
        success: false,
        error: 'Failed to parse JSON from model output',
        rawOutput,
        repairedJson,
        repairAttempted,
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Output Control</h1>
        <p className="text-muted-foreground">
          Structured outputs, JSON validation, and schema enforcement with Zod
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          📖 <Link href="https://github.com/yourusername/ai-web-dev-training/blob/main/docs/04-shipping-ai-features/output-control.md" className="text-primary hover:underline">Read the documentation</Link>
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/">
          <Button variant="default">Structured Outputs</Button>
        </Link>
        <Link href="/validation">
          <Button variant="outline">Validation Strategies</Button>
        </Link>
        <Link href="/streaming">
          <Button variant="outline">JSON Streaming</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Schema Selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-primary" />
                Output Schemas
              </CardTitle>
              <CardDescription>Select a schema to test</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(SCHEMAS) as SchemaKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSchemaChange(key)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedSchema === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium text-sm">{SCHEMAS[key].name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {SCHEMAS[key].description}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRepair}
                  onChange={(e) => setAutoRepair(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Auto-repair malformed JSON</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSchema}
                  onChange={(e) => setShowSchema(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show JSON schema</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show metadata</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show raw HTTP</span>
              </label>
            </CardContent>
          </Card>

          {/* Key Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-primary" />
                Key Concepts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Schema Definition</strong>
                <p>Define expected output structure with Zod for type safety.</p>
              </div>
              <div>
                <strong className="text-foreground">Prompt Engineering</strong>
                <p>Include schema in prompt to guide model output format.</p>
              </div>
              <div>
                <strong className="text-foreground">Validation</strong>
                <p>Parse and validate response against schema.</p>
              </div>
              <div>
                <strong className="text-foreground">Repair</strong>
                <p>Attempt to fix common JSON formatting issues.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle/Right Column - Input & Output */}
        <div className="lg:col-span-2 space-y-6">
          {/* Schema Display */}
          {showSchema && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4" />
                    JSON Schema: {schemaInfo.name}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(JSON.stringify(jsonSchema, null, 2))}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(jsonSchema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Input Text</CardTitle>
              <CardDescription className="text-xs">
                Text to extract structured data from
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter text to extract data from..."
                className="min-h-[150px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleExtract}
                  disabled={isLoading || !input.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <FileJson className="w-4 h-4 mr-2" />
                      Extract Structured Data
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setInput(schemaInfo.example);
                    setResult(null);
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card className={result.success ? 'border-green-300' : 'border-red-300'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-700">Extraction Successful</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="text-red-700">Extraction Failed</span>
                      </>
                    )}
                  </CardTitle>
                  {result.repairAttempted && (
                    <Badge variant={result.success ? 'success' : 'secondary'}>
                      <Wrench className="w-3 h-3 mr-1" />
                      Repair {result.success ? 'Succeeded' : 'Attempted'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.success && result.data && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Validated Output</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(JSON.stringify(result.data, null, 2))}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="text-xs bg-green-50 dark:bg-green-950/30 p-4 rounded-lg overflow-x-auto border border-green-200">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}

                {result.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-700">{result.error}</div>
                    </div>
                  </div>
                )}

                {showRawData && result.rawOutput && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Raw Model Output</h4>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {result.rawOutput}
                    </pre>
                  </div>
                )}

                {result.repairedJson && result.repairedJson !== result.rawOutput && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Repaired JSON
                    </h4>
                    <pre className="text-xs bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg overflow-x-auto border border-yellow-200">
                      {result.repairedJson}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Output Control Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="success" className="text-xs">DO</Badge>
                  Good Practices
                </h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Use low temperature (0.1-0.3) for JSON</li>
                  <li>• Include schema in system prompt</li>
                  <li>• Validate with Zod or similar</li>
                  <li>• Implement repair strategies</li>
                  <li>• Add retry logic for failures</li>
                  <li>• Log validation errors</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">DON'T</Badge>
                  Anti-Patterns
                </h4>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>• Trust raw model output</li>
                  <li>• Use high temperature for JSON</li>
                  <li>• Skip validation</li>
                  <li>• Ignore partial failures</li>
                  <li>• Use eval() to parse JSON</li>
                  <li>• Expose raw errors to users</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
