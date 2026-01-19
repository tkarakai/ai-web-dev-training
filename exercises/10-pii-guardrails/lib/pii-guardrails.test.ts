/**
 * Tests for PII Detection & Guardrails
 *
 * Run: bun test lib/pii-guardrails.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  PIIScanner,
  PII_PATTERNS,
  applyGuardrails,
  createScanner,
  generateReport,
  REDACTION_FORMATS,
} from './pii-guardrails';

describe('PII_PATTERNS', () => {
  it('has patterns for common PII types', () => {
    expect(PII_PATTERNS.email).toBeDefined();
    expect(PII_PATTERNS.phone).toBeDefined();
    expect(PII_PATTERNS.ssn).toBeDefined();
    expect(PII_PATTERNS.credit_card).toBeDefined();
    expect(PII_PATTERNS.api_key).toBeDefined();
  });

  it('all patterns have risk levels', () => {
    for (const [type, config] of Object.entries(PII_PATTERNS)) {
      expect(config.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(config.riskLevel);
    }
  });

  it('critical PII has critical risk level', () => {
    expect(PII_PATTERNS.ssn.riskLevel).toBe('critical');
    expect(PII_PATTERNS.credit_card.riskLevel).toBe('critical');
    expect(PII_PATTERNS.api_key.riskLevel).toBe('critical');
  });
});

describe('PIIScanner - Email Detection', () => {
  const scanner = new PIIScanner({ enabledTypes: ['email'] });

  it('detects simple email', () => {
    const result = scanner.scan('Contact me at john@example.com');
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].type).toBe('email');
    expect(result.matches[0].value).toBe('john@example.com');
  });

  it('detects multiple emails', () => {
    const result = scanner.scan('Send to alice@test.com and bob@test.org');
    expect(result.matches.length).toBe(2);
  });

  it('handles edge cases', () => {
    const result = scanner.scan('user.name+tag@sub.domain.co.uk');
    expect(result.matches.length).toBe(1);
  });
});

describe('PIIScanner - Phone Detection', () => {
  const scanner = new PIIScanner({ enabledTypes: ['phone'] });

  it('detects US phone formats', () => {
    const formats = [
      '(123) 456-7890',
      '123-456-7890',
      '1234567890',
      '+1 123-456-7890',
    ];

    for (const phone of formats) {
      const result = scanner.scan(`Call me at ${phone}`);
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });
});

describe('PIIScanner - SSN Detection', () => {
  const scanner = new PIIScanner({ enabledTypes: ['ssn'] });

  it('detects SSN format', () => {
    const result = scanner.scan('My SSN is 123-45-6789');
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].type).toBe('ssn');
    expect(result.matches[0].riskLevel).toBe('critical');
  });

  it('detects SSN without dashes', () => {
    const result = scanner.scan('SSN: 123456789');
    expect(result.matches.length).toBe(1);
  });
});

describe('PIIScanner - Credit Card Detection', () => {
  const scanner = new PIIScanner({ enabledTypes: ['credit_card'] });

  it('detects Visa', () => {
    const result = scanner.scan('Card: 4111111111111111');
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].riskLevel).toBe('critical');
  });

  it('detects Mastercard', () => {
    const result = scanner.scan('Card: 5500000000000004');
    expect(result.matches.length).toBe(1);
  });

  it('detects Amex', () => {
    const result = scanner.scan('Card: 340000000000009');
    expect(result.matches.length).toBe(1);
  });
});

describe('PIIScanner - API Key Detection', () => {
  const scanner = new PIIScanner({ enabledTypes: ['api_key'] });

  it('detects common API key formats', () => {
    const keys = [
      'sk_live_1234567890abcdefghij',
      'pk_test_abcdefghij1234567890',
      'api_key_abc123def456ghi789jkl',
    ];

    for (const key of keys) {
      const result = scanner.scan(`API Key: ${key}`);
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });
});

describe('PIIScanner - Redaction', () => {
  const scanner = new PIIScanner();

  it('redacts detected PII', () => {
    const result = scanner.scan('Email: john@example.com');
    expect(result.redactedText).not.toContain('john@example.com');
    expect(result.redactedText).toContain('[EMAIL:');
  });

  it('preserves non-PII text', () => {
    const result = scanner.scan('Hello, how are you?');
    expect(result.redactedText).toBe('Hello, how are you?');
    expect(result.matches.length).toBe(0);
  });

  it('handles multiple PII instances', () => {
    const result = scanner.scan('Contact john@test.com or jane@test.com');
    expect(result.redactedText).not.toContain('john@');
    expect(result.redactedText).not.toContain('jane@');
    expect(result.matches.length).toBe(2);
  });
});

describe('PIIScanner - Custom Redaction Formats', () => {
  it('simple format', () => {
    const scanner = new PIIScanner({
      redactionFormat: REDACTION_FORMATS.simple,
    });
    const result = scanner.scan('Email: john@example.com');
    expect(result.redactedText).toBe('Email: [REDACTED]');
  });

  it('asterisks format', () => {
    const scanner = new PIIScanner({
      redactionFormat: REDACTION_FORMATS.asterisks,
    });
    const result = scanner.scan('Email: john@example.com');
    expect(result.redactedText).toContain('*'.repeat('john@example.com'.length));
  });

  it('typeOnly format', () => {
    const scanner = new PIIScanner({
      redactionFormat: REDACTION_FORMATS.typeOnly,
    });
    const result = scanner.scan('Email: john@example.com');
    expect(result.redactedText).toBe('Email: [EMAIL]');
  });
});

describe('PIIScanner - Selective Types', () => {
  it('only scans enabled types', () => {
    const scanner = new PIIScanner({
      enabledTypes: ['email'],
    });

    const result = scanner.scan('Email: john@test.com, Phone: 123-456-7890');
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].type).toBe('email');
  });

  it('containsPII respects enabled types', () => {
    const scanner = new PIIScanner({
      enabledTypes: ['ssn'],
    });

    expect(scanner.containsPII('john@test.com')).toBe(false);
    expect(scanner.containsPII('SSN: 123-45-6789')).toBe(true);
  });
});

describe('PIIScanner - Risk Summary', () => {
  const scanner = new PIIScanner();

  it('calculates risk summary correctly', () => {
    const result = scanner.scan(
      'SSN: 123-45-6789, Email: john@test.com, IP: 192.168.1.1'
    );

    expect(result.riskSummary.critical).toBe(1); // SSN
    expect(result.riskSummary.medium).toBe(1); // Email
    expect(result.riskSummary.low).toBe(1); // IP
  });

  it('sets hasHighRisk correctly', () => {
    const lowRiskResult = scanner.scan('IP: 192.168.1.1');
    expect(lowRiskResult.hasHighRisk).toBe(false);

    const highRiskResult = scanner.scan('SSN: 123-45-6789');
    expect(highRiskResult.hasHighRisk).toBe(true);
  });
});

describe('applyGuardrails', () => {
  const scanner = new PIIScanner();

  it('blocks on critical PII by default', () => {
    const result = applyGuardrails('SSN: 123-45-6789', scanner);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('critical');
  });

  it('allows low-risk PII by default', () => {
    const result = applyGuardrails('IP: 192.168.1.1', scanner);
    expect(result.allowed).toBe(true);
  });

  it('respects blockOnHigh option', () => {
    const scanner = new PIIScanner({ enabledTypes: ['driver_license'] });
    const text = "Driver's License: ABC123456";

    const defaultResult = applyGuardrails(text, scanner);
    expect(defaultResult.allowed).toBe(true);

    const strictResult = applyGuardrails(text, scanner, { blockOnHigh: true });
    expect(strictResult.allowed).toBe(false);
  });

  it('respects maxMatches option', () => {
    const result = applyGuardrails(
      'Contact a@test.com, b@test.com, c@test.com',
      scanner,
      { maxMatches: 2 }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('3 PII matches');
  });

  it('supports custom check function', () => {
    const result = applyGuardrails('john@test.com', scanner, {
      customCheck: (scanResult) => ({
        allowed: !scanResult.matches.some((m) => m.value.includes('john')),
        reason: 'Name "john" not allowed',
      }),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('john');
  });
});

describe('createScanner presets', () => {
  it('strict preset enables all types', () => {
    const scanner = createScanner('strict');
    expect(scanner.containsPII('IP: 192.168.1.1')).toBe(true);
  });

  it('moderate preset skips low-risk', () => {
    const scanner = createScanner('moderate');
    expect(scanner.containsPII('IP: 192.168.1.1')).toBe(false);
    expect(scanner.containsPII('john@test.com')).toBe(true);
  });

  it('minimal preset only critical', () => {
    const scanner = createScanner('minimal');
    expect(scanner.containsPII('john@test.com')).toBe(false);
    expect(scanner.containsPII('SSN: 123-45-6789')).toBe(true);
  });
});

describe('generateReport', () => {
  const scanner = new PIIScanner();

  it('generates readable report', () => {
    const result = scanner.scan('Email: john@test.com, SSN: 123-45-6789');
    const report = generateReport(result);

    expect(report).toContain('PII Scan Report');
    expect(report).toContain('Total matches: 2');
    expect(report).toContain('High risk: YES');
    expect(report).toContain('email');
    expect(report).toContain('ssn');
  });

  it('handles no matches', () => {
    const result = scanner.scan('Hello world');
    const report = generateReport(result);

    expect(report).toContain('Total matches: 0');
    expect(report).toContain('High risk: No');
  });
});

describe('Edge Cases', () => {
  const scanner = new PIIScanner();

  it('handles empty string', () => {
    const result = scanner.scan('');
    expect(result.matches.length).toBe(0);
    expect(result.redactedText).toBe('');
  });

  it('handles text with no PII', () => {
    const result = scanner.scan('This is a normal sentence without any sensitive data.');
    expect(result.matches.length).toBe(0);
    expect(result.redactedText).toBe('This is a normal sentence without any sensitive data.');
  });

  it('handles overlapping patterns correctly', () => {
    // A string that might match multiple patterns
    const result = scanner.scan('Number: 123456789');
    // Should not have duplicate/overlapping matches
    const positions = result.matches.map((m) => m.start);
    const uniquePositions = new Set(positions);
    expect(positions.length).toBe(uniquePositions.size);
  });
});
