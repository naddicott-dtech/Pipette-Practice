import { describe, it, expect } from 'vitest';
import { FAILURE_COPY, FAILURE_CODES, WARNING_CODES } from './failures';
import type { FailureCode, WarningCode } from './types';

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

  it('seven failure codes and four warning codes (post-2026-05-08 SHORT_LOAD)', () => {
    expect(FAILURE_CODES).toHaveLength(7);
    expect(WARNING_CODES).toHaveLength(4);
  });
});
