import { describe, it, expect } from 'vitest';
import { FAILURE_COPY, FAILURE_CODES, WARNING_CODES, VERDICT_COPY } from './failures';
import type { FailureCode, WarningCode } from './types';
import type { VerdictCode } from './verdict';

const ALL_VERDICTS: VerdictCode[] = [
  'clean',
  'faint',
  'overdraw',
  'muddled',
  'mislabeled',
  'loose-tip',
  'missing',
];

describe('FAILURE_COPY completeness', () => {
  const allCodes: (FailureCode | WarningCode)[] = [
    ...FAILURE_CODES,
    ...WARNING_CODES,
  ];

  it.each(allCodes)('has copy for %s', (code) => {
    const copy = FAILURE_COPY[code];
    expect(copy).toBeDefined();
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
  });

  it.each(allCodes)('has a non-empty hint for %s', (code) => {
    const copy = FAILURE_COPY[code];
    expect(copy.hint).toBeDefined();
    expect((copy.hint as string).length).toBeGreaterThan(0);
  });

  it('FAILURE_CODES and WARNING_CODES are disjoint', () => {
    for (const f of FAILURE_CODES) {
      expect(WARNING_CODES).not.toContain(f);
    }
  });

  it('every key in FAILURE_COPY is a known code', () => {
    const known = new Set<string>([...FAILURE_CODES, ...WARNING_CODES]);
    for (const key of Object.keys(FAILURE_COPY)) {
      expect(known.has(key)).toBe(true);
    }
  });

  it('seven failure codes and five warning codes (post-2026-05-08 OVERDRAW)', () => {
    expect(FAILURE_CODES).toHaveLength(7);
    expect(WARNING_CODES).toHaveLength(5);
  });
});

describe('VERDICT_COPY completeness', () => {
  it.each(ALL_VERDICTS)('has copy for %s', (verdict) => {
    const copy = VERDICT_COPY[verdict];
    expect(copy).toBeDefined();
    expect(copy.label.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
  });

  it('every key in VERDICT_COPY is a known verdict', () => {
    const known = new Set<string>(ALL_VERDICTS);
    for (const key of Object.keys(VERDICT_COPY)) {
      expect(known.has(key)).toBe(true);
    }
  });
});
