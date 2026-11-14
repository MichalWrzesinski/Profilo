import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { WizardExitProvider, useWizardExit, useWizardExitHandler } from './WizardExit';

function Step({ leave }: { leave: (href: string) => void }) {
  useWizardExit(leave);
  return null;
}

function Bar() {
  const exit = useWizardExitHandler();
  return (
    <button type="button" onClick={() => exit?.get()?.('/edytor')}>
      wyjdź
    </button>
  );
}

describe('WizardExit', () => {
  it('lets the mounted step handle leaving and forgets it when the step unmounts', async () => {
    const leave = vi.fn();
    function Host() {
      const [shown, setShown] = useState(true);
      return (
        <WizardExitProvider>
          {shown && <Step leave={leave} />}
          <Bar />
          <button type="button" onClick={() => setShown(false)}>
            ukryj
          </button>
        </WizardExitProvider>
      );
    }
    render(<Host />);

    await userEvent.click(screen.getByRole('button', { name: 'wyjdź' }));
    await userEvent.click(screen.getByRole('button', { name: 'ukryj' }));
    await userEvent.click(screen.getByRole('button', { name: 'wyjdź' }));

    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith('/edytor');
  });

  it('keeps a newer step registered when an older one unmounts', async () => {
    const first = vi.fn();
    const second = vi.fn();
    function Host() {
      const [steps, setSteps] = useState<'both' | 'second'>('both');
      return (
        <WizardExitProvider>
          {steps === 'both' && <Step leave={first} />}
          <Step leave={second} />
          <Bar />
          <button type="button" onClick={() => setSteps('second')}>
            ukryj pierwszy
          </button>
        </WizardExitProvider>
      );
    }
    render(<Host />);

    await userEvent.click(screen.getByRole('button', { name: 'ukryj pierwszy' }));
    await userEvent.click(screen.getByRole('button', { name: 'wyjdź' }));

    expect(second).toHaveBeenCalledWith('/edytor');
    expect(first).not.toHaveBeenCalled();
  });

  it('does nothing outside a wizard', () => {
    render(<Step leave={vi.fn()} />);
  });
});
