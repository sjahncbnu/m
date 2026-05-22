import { describe, expect, it } from 'vitest';
import { computeNiceAxisDomain, formatTick } from './niceAxis';

describe('nice axis utilities', () => {
  it('includes the origin when data starts near zero', () => {
    const domain = computeNiceAxisDomain([0, 0.2, 1.1, 4.9]);

    expect(domain.min).toBeLessThanOrEqual(0);
    expect(domain.ticks).toContain(0);
  });

  it('does not force zero for nearly constant acceleration around 9.8', () => {
    const domain = computeNiceAxisDomain([9.79, 9.8, 9.81, 9.8]);

    expect(domain.min).toBeGreaterThan(0);
    expect(domain.ticks).not.toContain(0);
  });

  it('handles values crossing zero with a clean zero tick', () => {
    const domain = computeNiceAxisDomain([-1.2, -0.4, 0.8, 1.4]);

    expect(domain.min).toBeLessThanOrEqual(0);
    expect(domain.max).toBeGreaterThanOrEqual(0);
    expect(domain.ticks).toContain(0);
  });

  it('formats floating-point artifacts as readable labels', () => {
    expect(formatTick(0.30000000000000004)).toBe('0.3');
  });
});
