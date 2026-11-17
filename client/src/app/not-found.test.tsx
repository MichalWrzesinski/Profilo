import { render, screen } from '@testing-library/react';
import { SessionProvider } from '@/lib/session';
import NotFound from './not-found';

describe('404 page', () => {
  it('says the page was not found and offers a new page', () => {
    render(
      <SessionProvider>
        <NotFound />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Nie znaleźliśmy tej strony' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Załóż własną stronę' })).toHaveAttribute(
      'href',
      '/rejestracja',
    );
  });
});
