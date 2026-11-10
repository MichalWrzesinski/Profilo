'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { useSession } from '@/lib/session';

type State = 'idle' | 'sending' | 'sent' | 'wait' | 'error';

const MESSAGES: Partial<Record<State, string>> = {
  sent: 'Wysłaliśmy nowy link. Poprzednie linki już nie działają.',
  wait: 'Nowy link możesz wysłać za minutę.',
  error: 'Nie udało się wysłać linku. Spróbuj ponownie za chwilę.',
};

/** Warning banner shown in the panel until the login e-mail is confirmed (ACC-BR-4). */
export function ConfirmEmailBanner() {
  const { account, markEmailConfirmed } = useSession();
  const [state, setState] = useState<State>('idle');

  if (!account || account.emailConfirmed) return null;

  const resend = async () => {
    setState('sending');
    const { response } = await api.POST('/api/v1/auth/email-confirmations');
    if (response.status === 202) setState('sent');
    else if (response.status === 429) setState('wait');
    else if (response.status === 409) markEmailConfirmed();
    else setState('error');
  };

  return (
    <div className="alert alert-warning banner" role="status">
      <span className="grow">
        <b>Potwierdź e-mail, żeby opublikować stronę.</b> Wysłaliśmy link na {account.email}.
        {MESSAGES[state] && <> {MESSAGES[state]}</>}
      </span>
      <button
        type="button"
        className={`btn btn-ghost btn-sm${state === 'sending' ? ' is-loading' : ''}`}
        disabled={state === 'sending'}
        onClick={resend}
      >
        Wyślij ponownie
      </button>
    </div>
  );
}
