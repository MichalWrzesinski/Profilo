import { render, screen } from '@testing-library/react';
import { Placeholder } from './LegalDocument';

it('shows a supplied value as plain text', () => {
  render(<Placeholder value="Profilo sp. z o.o." label="nazwa operatora" />);

  expect(screen.getByText('Profilo sp. z o.o.').tagName).not.toBe('MARK');
});

it('marks a missing value', () => {
  render(<Placeholder value={null} label="NIP" />);

  expect(screen.getByText('[do uzupełnienia: NIP]').tagName).toBe('MARK');
});
