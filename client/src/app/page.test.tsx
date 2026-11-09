import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home placeholder', () => {
  it('shows the Profilo logo and headline', () => {
    render(<Home />);
    expect(screen.getByRole('img', { name: 'Profilo' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Twoja wizytówka w sieci.' }),
    ).toBeInTheDocument();
  });
});
