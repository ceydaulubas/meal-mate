import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('introduces MealMate and reports the foundation status', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /plan meals you love, together/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/project foundation is ready/i)).toBeInTheDocument();
  });
});
