import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimNickInput } from './ClaimNickInput';

it('shows the address as it will be while typing', async () => {
  render(<ClaimNickInput />);
  const field = screen.getByRole('textbox', { name: 'Wybrany adres strony' });

  await userEvent.type(field, 'Łucja Żółć & Syn!');

  expect(field).toHaveValue('lucja-zolc-syn');
});
