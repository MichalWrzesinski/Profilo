import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('links the hint to the input', () => {
    render(<Field label="Nazwa" hint="Pomoc" />);
    const input = screen.getByLabelText('Nazwa');
    expect(input).toHaveAccessibleDescription('Pomoc');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('shows the error instead of the hint', () => {
    render(<Field label="Nazwa" hint="Pomoc" error="Błąd" />);
    expect(screen.getByLabelText('Nazwa')).toHaveAccessibleDescription('Błąd');
    expect(screen.queryByText('Pomoc')).toBeNull();
  });

  it('renders without hint or error', () => {
    render(<Field label="Nazwa" id="x" />);
    expect(screen.getByLabelText('Nazwa')).not.toHaveAttribute('aria-describedby');
  });
});
