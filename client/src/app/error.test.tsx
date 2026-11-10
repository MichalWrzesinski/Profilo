import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from './error';

describe('error page', () => {
  it('explains the failure in Polish and retries', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('API down')} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Nie udało się wczytać strony' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(reset).toHaveBeenCalled();
  });
});
