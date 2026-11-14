import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Accent, Layout } from '@/features/editor/fields';
import { AccentPicker, LayoutPicker, accentName, layoutName } from './AppearancePicker';

function Host() {
  const [layout, setLayout] = useState<Layout>('classic');
  const [accent, setAccent] = useState<Accent>('granat');
  return (
    <>
      <LayoutPicker value={layout} onChange={setLayout} />
      <AccentPicker value={accent} onChange={setAccent} />
    </>
  );
}

describe('appearance pickers', () => {
  it('chooses a layout and a colour with the mouse', async () => {
    render(<Host />);

    await userEvent.click(screen.getByRole('radio', { name: /Wizytówka/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Bordo' }));

    expect(screen.getByRole('radio', { name: /Wizytówka/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Bordo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Bordo', { selector: 'b' })).toBeInTheDocument();
    expect(screen.queryByText(/domyślny/)).toBeNull();
  });

  it('moves with the arrow keys, wrapping around, with one tab stop per group', async () => {
    render(<Host />);
    const user = userEvent.setup();
    expect(screen.getByText(/domyślny/)).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('radio', { name: /Klasyczny/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /Wizytówka/ })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Wizytówka/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Klasyczny/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.keyboard('{Enter}');

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Granat' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Fiolet' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Fiolet' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Granat' })).toHaveAttribute('tabindex', '-1');
  });

  it('names layouts and colours', () => {
    expect(layoutName('split')).toBe('Dzielony');
    expect(accentName('miedz')).toBe('Miedź');
    expect(layoutName('x' as Layout)).toBe('');
    expect(accentName('x' as Accent)).toBe('');
  });
});
