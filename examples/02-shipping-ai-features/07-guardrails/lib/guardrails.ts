/**
 * Guardrails utilities for safe AI usage
 * - PII detection and redaction
 * - Secret detection
 * - Data classification
 */

// Detection result types
export interface Detection {
  type: DetectionType;
  value: string;
  redacted: string;
  start: number;
  end: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export type DetectionType =
  | 'api_key'
  | 'github_token'
  | 'aws_key'
  | 'private_key'
  | 'password'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'jwt_token';

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ClassificationResult {
  classification: DataClassification;
  reasons: string[];
  canSendToLLM: boolean;
  requiresApproval: boolean;
}

export interface ScanResult {
  safe: boolean;
  detections: Detection[];
  classification: ClassificationResult;
  redactedContent: string;
  summary: string;
}

// Pattern definitions for detection
const DETECTION_PATTERNS: Array<{
  type: DetectionType;
  pattern: RegExp;
  severity: Detection['severity'];
  redactedLabel: string;
}> = [
  // API Keys
  {
    type: 'api_key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    redactedLabel: '[OPENAI_KEY]',
  },
  {
    type: 'api_key',
    pattern: /sk-proj-[a-zA-Z0-9_-]{80,}/g,
    severity: 'critical',
    redactedLabel: '[OPENAI_PROJECT_KEY]',
  },
  {
    type: 'api_key',
    pattern: /AIza[a-zA-Z0-9_-]{35}/g,
    severity: 'critical',
    redactedLabel: '[GOOGLE_API_KEY]',
  },
  // GitHub tokens
  {
    type: 'github_token',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'critical',
    redactedLabel: '[GITHUB_PAT]',
  },
  {
    type: 'github_token',
    pattern: /github_pat_[a-zA-Z0-9_]{22,}/g,
    severity: 'critical',
    redactedLabel: '[GITHUB_PAT]',
  },
  // AWS keys
  {
    type: 'aws_key',
    pattern: /AKIA[A-Z0-9]{16}/g,
    severity: 'critical',
    redactedLabel: '[AWS_ACCESS_KEY]',
  },
  {
    type: 'aws_key',
    pattern: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    severity: 'critical',
    redactedLabel: '[AWS_SECRET_KEY]',
  },
  // Private keys
  {
    type: 'private_key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    severity: 'critical',
    redactedLabel: '[PRIVATE_KEY]',
  },
  // Passwords in code
  {
    type: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    severity: 'critical',
    redactedLabel: '[PASSWORD]',
  },
  // JWT tokens
  {
    type: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    severity: 'high',
    redactedLabel: '[JWT_TOKEN]',
  },
  // PII - Email
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: 'medium',
    redactedLabel: '[EMAIL]',
  },
  // PII - Phone numbers
  {
    type: 'phone',
    pattern: /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    severity: 'medium',
    redactedLabel: '[PHONE]',
  },
  // PII - SSN
  {
    type: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    severity: 'critical',
    redactedLabel: '[SSN]',
  },
  // PII - Credit cards
  {
    type: 'credit_card',
    pattern: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|6(?:011|5[0-9]{2})|3[47][0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,
    severity: 'critical',
    redactedLabel: '[CREDIT_CARD]',
  },
  // IP addresses (private ranges often sensitive)
  {
    type: 'ip_address',
    pattern: /\b(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}\b/g,
    severity: 'low',
    redactedLabel: '[INTERNAL_IP]',
  },
];

// Classify content sensitivity
export function classifyContent(content: string): ClassificationResult {
  const reasons: string[] = [];
  let classification: DataClassification = 'public';
  let canSendToLLM = true;
  let requiresApproval = false;

  // Check for restricted content markers
  const restrictedPatterns = [
    { pattern: /HIPAA|PHI|protected health/i, reason: 'Contains health information markers' },
    { pattern: /FERPA|student record/i, reason: 'Contains education record markers' },
    { pattern: /PCI|cardholder/i, reason: 'Contains payment card industry markers' },
    { pattern: /classified|top secret|confidential:/i, reason: 'Contains classification markers' },
  ];

  for (const { pattern, reason } of restrictedPatterns) {
    if (pattern.test(content)) {
      classification = 'restricted';
      reasons.push(reason);
      canSendToLLM = false;
    }
  }

  // Check for confidential content
  const confidentialPatterns = [
    { pattern: /customer\s+data|user\s+record/i, reason: 'References customer data' },
    { pattern: /salary|compensation|payroll/i, reason: 'Contains compensation information' },
    { pattern: /contract|agreement|NDA/i, reason: 'References legal agreements' },
    { pattern: /social security|SSN/i, reason: 'References SSN' },
  ];

  for (const { pattern, reason } of confidentialPatterns) {
    if (pattern.test(content) && classification !== 'restricted') {
      classification = 'confidential';
      reasons.push(reason);
      requiresApproval = true;
    }
  }

  // Check for internal content
  const internalPatterns = [
    { pattern: /internal\s+use|proprietary/i, reason: 'Marked as internal' },
    { pattern: /architecture|system\s+design/i, reason: 'Contains architecture details' },
    { pattern: /roadmap|strategy/i, reason: 'Contains strategic information' },
  ];

  for (const { pattern, reason } of internalPatterns) {
    if (pattern.test(content) && classification === 'public') {
      classification = 'internal';
      reasons.push(reason);
    }
  }

  if (reasons.length === 0) {
    reasons.push('No sensitive patterns detected');
  }

  return { classification, reasons, canSendToLLM, requiresApproval };
}

// Scan content for secrets and PII
export function scanContent(content: string): ScanResult {
  const detections: Detection[] = [];
  let redactedContent = content;

  // Run all patterns
  for (const { type, pattern, severity, redactedLabel } of DETECTION_PATTERNS) {
    // Reset pattern state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Avoid duplicate detections at the same position
      const isDuplicate = detections.some(
        (d) => d.start === match.index && d.end === match.index + match[0].length
      );

      if (!isDuplicate) {
        detections.push({
          type,
          value: match[0],
          redacted: redactedLabel,
          start: match.index,
          end: match.index + match[0].length,
          severity,
        });
      }
    }
  }

  // Sort by position for proper redaction
  detections.sort((a, b) => b.start - a.start);

  // Apply redactions (reverse order to maintain positions)
  for (const detection of detections) {
    redactedContent =
      redactedContent.slice(0, detection.start) +
      detection.redacted +
      redactedContent.slice(detection.end);
  }

  // Classify the content
  const classification = classifyContent(content);

  // Determine if safe to send
  const criticalDetections = detections.filter((d) => d.severity === 'critical');
  const safe = criticalDetections.length === 0 && classification.canSendToLLM;

  // Generate summary
  let summary = '';
  if (detections.length === 0) {
    summary = 'No sensitive data detected.';
  } else {
    const byType = detections.reduce(
      (acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const typeSummaries = Object.entries(byType).map(
      ([type, count]) => `${count} ${type.replace(/_/g, ' ')}${count > 1 ? 's' : ''}`
    );

    summary = `Found: ${typeSummaries.join(', ')}.`;
  }

  return {
    safe,
    detections,
    classification,
    redactedContent,
    summary,
  };
}

// Sample texts for the demo
export const sampleTexts = {
  clean: {
    label: 'Clean Code',
    content: `function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// Format currency for display
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}`,
  },
  secrets: {
    label: 'Contains Secrets',
    content: `// API configuration
const config = {
  openaiKey: 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234',
  githubToken: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
  awsAccessKey: 'AKIAIOSFODNN7EXAMPLE',
  password: 'super_secret_password_123',
};

// Database connection
const dbUrl = \`postgres://admin:\${config.password}@db.example.com:5432/prod\`;`,
  },
  pii: {
    label: 'Contains PII',
    content: `// Customer support ticket
const ticket = {
  customer: {
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '555-123-4567',
    ssn: '123-45-6789',
  },
  issue: 'Payment not processed',
  cardNumber: '4532-1234-5678-9012',
};

// Send notification to customer
await sendEmail(ticket.customer.email, 'Your ticket has been received');`,
  },
  mixed: {
    label: 'Mixed Content',
    content: `/**
 * User authentication service
 * CONFIDENTIAL - Internal use only
 */
import { sign } from 'jsonwebtoken';

const JWT_SECRET = 'super_secret_jwt_key_do_not_share';

interface User {
  id: string;
  email: string;  // e.g., user@company.com
}

export function generateToken(user: User): string {
  // Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
  return sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
}`,
  },
  internal: {
    label: 'Internal Documentation',
    content: `# System Architecture Overview
INTERNAL USE ONLY

## Infrastructure
- Primary DB: 192.168.1.100
- Replica DB: 192.168.1.101
- Cache: 192.168.1.50

## Roadmap Q2
1. Migrate to Kubernetes
2. Implement new pricing strategy
3. Launch enterprise tier

Contact: devops@company.com for access requests.`,
  },
};

export type SampleTextKey = keyof typeof sampleTexts;

// Severity colors
export const severityColors: Record<Detection['severity'], string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

// Classification colors
export const classificationColors: Record<DataClassification, string> = {
  public: 'bg-green-100 text-green-700',
  internal: 'bg-blue-100 text-blue-700',
  confidential: 'bg-orange-100 text-orange-700',
  restricted: 'bg-red-100 text-red-700',
};
