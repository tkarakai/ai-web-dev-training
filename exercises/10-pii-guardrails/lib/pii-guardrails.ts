/**
 * PII Detection & Guardrails
 *
 * Detect and redact personally identifiable information (PII) before
 * sending to LLMs or storing in logs.
 *
 * KEY CONCEPTS:
 * 1. Pattern-based detection - Regex patterns for common PII types
 * 2. Redaction - Replace sensitive data with placeholders
 * 3. Risk classification - Categorize data by sensitivity level
 * 4. Guardrails - Block or warn on high-risk content
 */

// =============================================================================
// TYPES
// =============================================================================

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'date_of_birth'
  | 'address'
  | 'name'
  | 'passport'
  | 'driver_license'
  | 'bank_account'
  | 'api_key';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  riskLevel: RiskLevel;
}

export interface ScanResult {
  originalText: string;
  redactedText: string;
  matches: PIIMatch[];
  hasHighRisk: boolean;
  riskSummary: Record<RiskLevel, number>;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  scanResult: ScanResult;
}

// =============================================================================
// PII PATTERNS
// =============================================================================

/**
 * Regex patterns for common PII types
 *
 * Note: These are simplified patterns for demonstration.
 * Production systems should use more comprehensive patterns.
 */
export const PII_PATTERNS: Record<PIIType, { pattern: RegExp; riskLevel: RiskLevel }> = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    riskLevel: 'medium',
  },

  phone: {
    // US phone formats: (123) 456-7890, 123-456-7890, 1234567890
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    riskLevel: 'medium',
  },

  ssn: {
    // US Social Security Number: 123-45-6789
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    riskLevel: 'critical',
  },

  credit_card: {
    // Major card formats: Visa, Mastercard, Amex, Discover
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    riskLevel: 'critical',
  },

  ip_address: {
    // IPv4 addresses
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    riskLevel: 'low',
  },

  date_of_birth: {
    // Common date formats that might be DOB
    pattern: /\b(?:DOB|born|birthday|birth date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
    riskLevel: 'medium',
  },

  address: {
    // US street addresses (simplified)
    pattern: /\b\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b\.?(?:\s*(?:Apt|Suite|Unit|#)\s*\d+)?/gi,
    riskLevel: 'medium',
  },

  passport: {
    // US passport number format
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    riskLevel: 'critical',
  },

  driver_license: {
    // Generic pattern - varies by state
    pattern: /\b(?:DL|Driver'?s?\s*License)[:\s#]*([A-Z0-9]{5,15})\b/gi,
    riskLevel: 'high',
  },

  bank_account: {
    // Bank account numbers (simplified)
    pattern: /\b(?:account|acct)[:\s#]*(\d{8,17})\b/gi,
    riskLevel: 'critical',
  },

  api_key: {
    // Common API key formats
    pattern: /\b(?:sk|pk|api)[_-](?:live|test|prod)?[_-]?[A-Za-z0-9]{20,50}\b/g,
    riskLevel: 'critical',
  },

  name: {
    // Names following common patterns (Mr., Mrs., Dr., etc.)
    pattern: /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    riskLevel: 'low',
  },
};

// =============================================================================
// SCANNER
// =============================================================================

/**
 * PII Scanner with configurable patterns and redaction
 */
export class PIIScanner {
  private patterns: Map<PIIType, { pattern: RegExp; riskLevel: RiskLevel }>;
  private enabledTypes: Set<PIIType>;
  private redactionFormat: (type: PIIType, value: string) => string;

  constructor(options: {
    enabledTypes?: PIIType[];
    customPatterns?: Partial<Record<PIIType, { pattern: RegExp; riskLevel: RiskLevel }>>;
    redactionFormat?: (type: PIIType, value: string) => string;
  } = {}) {
    // Initialize with default patterns
    this.patterns = new Map(Object.entries(PII_PATTERNS) as [PIIType, { pattern: RegExp; riskLevel: RiskLevel }][]);

    // Apply custom patterns
    if (options.customPatterns) {
      for (const [type, config] of Object.entries(options.customPatterns)) {
        this.patterns.set(type as PIIType, config);
      }
    }

    // Set enabled types (default: all)
    this.enabledTypes = new Set(
      options.enabledTypes || (Object.keys(PII_PATTERNS) as PIIType[])
    );

    // Set redaction format
    this.redactionFormat = options.redactionFormat || defaultRedactionFormat;
  }

  /**
   * Scan text for PII
   */
  scan(text: string): ScanResult {
    const matches: PIIMatch[] = [];

    for (const [type, { pattern, riskLevel }] of this.patterns) {
      if (!this.enabledTypes.has(type)) continue;

      // Reset regex lastIndex
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Get the actual matched value (might be in a capture group)
        const value = match[1] || match[0];
        const start = match.index + (match[0].indexOf(value));

        matches.push({
          type,
          value,
          start,
          end: start + value.length,
          riskLevel,
        });
      }
    }

    // Sort by position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep higher risk)
    const dedupedMatches = this.deduplicateMatches(matches);

    // Build redacted text
    const redactedText = this.redact(text, dedupedMatches);

    // Calculate risk summary
    const riskSummary: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const match of dedupedMatches) {
      riskSummary[match.riskLevel]++;
    }

    const hasHighRisk = riskSummary.critical > 0 || riskSummary.high > 0;

    return {
      originalText: text,
      redactedText,
      matches: dedupedMatches,
      hasHighRisk,
      riskSummary,
    };
  }

  /**
   * Redact PII from text
   */
  private redact(text: string, matches: PIIMatch[]): string {
    if (matches.length === 0) return text;

    let result = '';
    let lastEnd = 0;

    for (const match of matches) {
      result += text.slice(lastEnd, match.start);
      result += this.redactionFormat(match.type, match.value);
      lastEnd = match.end;
    }

    result += text.slice(lastEnd);
    return result;
  }

  /**
   * Remove overlapping matches, keeping higher risk ones
   */
  private deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
    const result: PIIMatch[] = [];
    const riskOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

    for (const match of matches) {
      const overlapping = result.findIndex(
        (m) => !(match.end <= m.start || match.start >= m.end)
      );

      if (overlapping === -1) {
        result.push(match);
      } else {
        // Keep higher risk match
        const existing = result[overlapping];
        if (riskOrder.indexOf(match.riskLevel) < riskOrder.indexOf(existing.riskLevel)) {
          result[overlapping] = match;
        }
      }
    }

    return result.sort((a, b) => a.start - b.start);
  }

  /**
   * Quick check if text contains any PII
   */
  containsPII(text: string): boolean {
    for (const [type, { pattern }] of this.patterns) {
      if (!this.enabledTypes.has(type)) continue;
      pattern.lastIndex = 0;
      if (pattern.test(text)) return true;
    }
    return false;
  }

  /**
   * Get only the redacted text
   */
  redactText(text: string): string {
    return this.scan(text).redactedText;
  }
}

/**
 * Default redaction format: [TYPE:****]
 */
function defaultRedactionFormat(type: PIIType, value: string): string {
  const masked = value.length > 4
    ? value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2)
    : '*'.repeat(value.length);
  return `[${type.toUpperCase()}:${masked}]`;
}

/**
 * Alternative redaction formats
 */
export const REDACTION_FORMATS = {
  // [EMAIL:j***@***.com]
  default: defaultRedactionFormat,

  // [REDACTED]
  simple: (_type: PIIType, _value: string) => '[REDACTED]',

  // ***
  asterisks: (_type: PIIType, value: string) => '*'.repeat(value.length),

  // [EMAIL]
  typeOnly: (type: PIIType, _value: string) => `[${type.toUpperCase()}]`,

  // <PII_EMAIL_1>
  placeholder: (type: PIIType, _value: string) => {
    const counter = (placeholder as any).counters || ((placeholder as any).counters = {});
    counter[type] = (counter[type] || 0) + 1;
    return `<PII_${type.toUpperCase()}_${counter[type]}>`;
  },
};

const placeholder = REDACTION_FORMATS.placeholder;

// =============================================================================
// GUARDRAILS
// =============================================================================

/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
  /** Block if any critical PII found */
  blockOnCritical?: boolean;

  /** Block if any high-risk PII found */
  blockOnHigh?: boolean;

  /** Block if total matches exceed threshold */
  maxMatches?: number;

  /** Minimum risk level to report */
  minRiskLevel?: RiskLevel;

  /** Custom blocking logic */
  customCheck?: (result: ScanResult) => { allowed: boolean; reason?: string };
}

/**
 * Apply guardrails to text
 *
 * Returns whether the text is allowed and why
 */
export function applyGuardrails(
  text: string,
  scanner: PIIScanner,
  config: GuardrailConfig = {}
): GuardrailResult {
  const {
    blockOnCritical = true,
    blockOnHigh = false,
    maxMatches,
    customCheck,
  } = config;

  const scanResult = scanner.scan(text);

  // Check critical risk
  if (blockOnCritical && scanResult.riskSummary.critical > 0) {
    return {
      allowed: false,
      reason: `Contains ${scanResult.riskSummary.critical} critical-risk PII item(s)`,
      scanResult,
    };
  }

  // Check high risk
  if (blockOnHigh && scanResult.riskSummary.high > 0) {
    return {
      allowed: false,
      reason: `Contains ${scanResult.riskSummary.high} high-risk PII item(s)`,
      scanResult,
    };
  }

  // Check max matches
  if (maxMatches !== undefined && scanResult.matches.length > maxMatches) {
    return {
      allowed: false,
      reason: `Contains ${scanResult.matches.length} PII matches (max: ${maxMatches})`,
      scanResult,
    };
  }

  // Custom check
  if (customCheck) {
    const customResult = customCheck(scanResult);
    if (!customResult.allowed) {
      return {
        allowed: false,
        reason: customResult.reason,
        scanResult,
      };
    }
  }

  return {
    allowed: true,
    scanResult,
  };
}

// =============================================================================
// MIDDLEWARE HELPERS
// =============================================================================

/**
 * Wrap LLM calls with PII protection
 */
export function withPIIProtection<T>(
  scanner: PIIScanner,
  config: GuardrailConfig = {}
) {
  return async (
    input: string,
    fn: (sanitizedInput: string) => Promise<T>
  ): Promise<{ result?: T; blocked?: string; scanResult: ScanResult }> => {
    const guardrailResult = applyGuardrails(input, scanner, config);

    if (!guardrailResult.allowed) {
      return {
        blocked: guardrailResult.reason,
        scanResult: guardrailResult.scanResult,
      };
    }

    // Use redacted text for the LLM call
    const result = await fn(guardrailResult.scanResult.redactedText);

    return {
      result,
      scanResult: guardrailResult.scanResult,
    };
  };
}

/**
 * Create a pre-configured scanner for common use cases
 */
export function createScanner(preset: 'strict' | 'moderate' | 'minimal'): PIIScanner {
  switch (preset) {
    case 'strict':
      // All PII types enabled
      return new PIIScanner();

    case 'moderate':
      // Skip low-risk types
      return new PIIScanner({
        enabledTypes: ['email', 'phone', 'ssn', 'credit_card', 'bank_account', 'api_key', 'driver_license', 'passport'],
      });

    case 'minimal':
      // Only critical types
      return new PIIScanner({
        enabledTypes: ['ssn', 'credit_card', 'bank_account', 'api_key'],
      });
  }
}

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Generate a human-readable report of PII findings
 */
export function generateReport(result: ScanResult): string {
  const lines: string[] = [];

  lines.push('=== PII Scan Report ===');
  lines.push(`Total matches: ${result.matches.length}`);
  lines.push(`High risk: ${result.hasHighRisk ? 'YES' : 'No'}`);
  lines.push('');

  // Risk breakdown
  lines.push('Risk Summary:');
  for (const [level, count] of Object.entries(result.riskSummary)) {
    if (count > 0) {
      lines.push(`  ${level}: ${count}`);
    }
  }
  lines.push('');

  // Individual matches
  if (result.matches.length > 0) {
    lines.push('Matches:');
    for (const match of result.matches) {
      const preview = match.value.length > 20
        ? match.value.slice(0, 17) + '...'
        : match.value;
      lines.push(`  [${match.riskLevel.toUpperCase()}] ${match.type}: "${preview}" at ${match.start}`);
    }
  }

  return lines.join('\n');
}
