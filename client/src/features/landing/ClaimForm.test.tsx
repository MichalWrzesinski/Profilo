import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimForm } from './ClaimForm';

it('shows the address as it will be while typing, in full below the field', async () => {
  render(<ClaimForm host="profilo.pl" />);
  const field = screen.getByRole('textbox', { name: 'Wybrany adres strony' });
  expect(field).toHaveAccessibleDescription('profilo.pl/user/twoja-nazwa');

  await userEvent.type(field, 'Łucja Żółć & Syn!');

  expect(field).toHaveValue('lucja-zolc-syn');
  expect(field).toHaveAccessibleDescription('profilo.pl/user/lucja-zolc-syn');
});
