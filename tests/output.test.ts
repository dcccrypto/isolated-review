import { describe, it, expect } from 'vitest';
import { renderJson, renderPretty } from '../src/utils/output.js';
import { createTheme } from '../src/utils/theme.js';
import type { ReviewResult } from '../src/providers/types.js';

const result: ReviewResult = {
  summary: 'One paragraph gist.',
  findings: [
    {
      title: 'Off-by-one',
      severity: 'critical',
      location: { startLine: 42, endLine: 48 },
      explanation: 'e'
    },
    {
      title: 'Naming',
      severity: 'low',
      location: { startLine: 7 },
      explanation: 'e'
    }
  ]
};

describe('renderJson', () => {
  it('returns stable pretty JSON', () => {
    const out = renderJson(result);
    expect(JSON.parse(out)).toEqual(result);
    expect(out.startsWith('{\n')).toBe(true);
  });
});

describe('renderPretty (plain theme for assertions)', () => {
  const theme = createTheme({ plain: true });

  it('shows header with file and model', () => {
    const out = renderPretty({
      filePath: '/tmp/proj/src/a.ts',
      primaryModel: 'claude-sonnet-4-5',
      primary: result,
      elapsedMs: 4200,
      theme,
      includePatch: false
    });
    expect(out).toContain('review');
    expect(out).toContain('src/a.ts');
    expect(out).toContain('claude-sonnet-4-5');
    expect(out).toContain('Summary');
    expect(out).toContain('Critical  (1)');
    expect(out).toContain('Low  (1)');
    expect(out).not.toContain('Medium  (');
    expect(out).toContain('Reviewed in 4.2s');
  });

  it('renders location as basename:startLine-endLine under each finding', () => {
    const out = renderPretty({
      filePath: '/tmp/proj/src/a.ts',
      primaryModel: 'claude',
      primary: result,
      elapsedMs: 1000,
      theme,
      includePatch: false
    });
    expect(out).toContain('a.ts:42-48');
    expect(out).toContain('a.ts:7');
    expect(out).not.toContain('a.ts:7-7');
  });

  it('omits the location line when a finding has no location', () => {
    const noLoc: ReviewResult = {
      summary: 's',
      findings: [{ title: 'No loc', severity: 'medium', explanation: 'e' }]
    };
    const out = renderPretty({
      filePath: '/tmp/proj/src/a.ts',
      primaryModel: 'claude',
      primary: noLoc,
      elapsedMs: 1000,
      theme,
      includePatch: false
    });
    expect(out).not.toMatch(/a\.ts:\d/);
  });

  it('renders a verified block under a divider when provided', () => {
    const out = renderPretty({
      filePath: 'src/a.ts',
      primaryModel: 'gpt-4o',
      verifierModel: 'claude',
      primary: result,
      verified: { summary: 'Refined.', findings: [] },
      elapsedMs: 5100,
      theme,
      includePatch: false
    });
    expect(out).toContain('VERIFIED');
    expect(out).toContain('Refined.');
  });
});
