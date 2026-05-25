// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { ChooseSim } from './ChooseSim';

afterEach(cleanup);

describe('ChooseSim', () => {
  it('links to both simulations (hash routes, as shipped)', () => {
    render(
      <HashRouter>
        <ChooseSim />
      </HashRouter>,
    );

    const gel = screen.getByRole('link', { name: /Gel Electrophoresis/i });
    const streak = screen.getByRole('link', { name: /Streaking/i });

    expect(gel.getAttribute('href')).toBe('#/electrophoresis');
    expect(streak.getAttribute('href')).toBe('#/streak');
  });
});
