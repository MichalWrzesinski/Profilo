import { render, screen } from '@testing-library/react';
import { pathname } from '@/test/navigation';
import { ServiceFrame } from './ServiceFrame';

afterEach(() => {
  pathname.current = '/';
});

it.each(['/', '/panel', '/panel/konto', '/edytor', '/kreator', '/logowanie', '/opublikowano'])(
  'shows the service footer on %s',
  (path) => {
    pathname.current = path;
    render(
      <ServiceFrame>
        <main>Treść</main>
      </ServiceFrame>,
    );
    expect(screen.getByRole('contentinfo')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('href', '/regulamin');
  },
);

it.each(['/user/anna', '/podglad', '/przyklad'])('keeps the card layout on %s', (path) => {
  pathname.current = path;
  render(
    <ServiceFrame>
      <main>Wizytówka</main>
    </ServiceFrame>,
  );
  expect(screen.queryByRole('contentinfo')).toBeNull();
});
