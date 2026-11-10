'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/Alert';
import { api, refreshSession } from '@/lib/api/client';
import { useSession } from '@/lib/session';

type State =
  'checking' | 'confirmed' | 'expired' | 'resent' | 'already' | 'wait' | 'error' | 'resendError';

export function ConfirmEmail() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const { signIn, status } = useSession();
  const [state, setState] = useState<State>('checking');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // confirm once (React strict mode runs effects twice)
    started.current = true;
    void (async () => {
      if (token.length < 20) return setState('expired');
      const { response } = await api.POST('/api/v1/auth/email-confirmations/confirm', {
        body: { token },
      });
      if (response.status === 410 || response.status === 422) return setState('expired');
      if (response.status !== 204) return setState('error');
      const session = await refreshSession();
      if (!session) {
        router.replace('/logowanie?potwierdzono=1');
        return;
      }
      // The link may belong to another account than the one signed in: read the truth.
      const { data: account } = await api.GET('/api/v1/me');
      signIn({ ...session, account: account ?? session.account });
      setState('confirmed');
    })();
  }, [token, router, signIn]);

  const sendNewLink = async () => {
    if (status !== 'authenticated') {
      const session = await refreshSession();
      if (!session) {
        router.push('/logowanie');
        return;
      }
      signIn(session);
    }
    const { response } = await api.POST('/api/v1/auth/email-confirmations');
    const next: Record<number, State> = { 202: 'resent', 409: 'already', 429: 'wait' };
    setState(next[response.status] ?? 'resendError');
  };

  if (state === 'checking') {
    return (
      <p className="muted" role="status">
        Sprawdzamy link…
      </p>
    );
  }
  if (state === 'confirmed') {
    return (
      <>
        <Alert variant="success">Adres potwierdzony. Możesz już opublikować swoją stronę.</Alert>
        <Link className="btn btn-primary btn-block" href="/panel">
          Przejdź do panelu
        </Link>
      </>
    );
  }
  if (state === 'resent') {
    return <Alert variant="success">Wysłaliśmy nowy link. Sprawdź skrzynkę.</Alert>;
  }
  if (state === 'already') {
    return (
      <>
        <Alert variant="success">Twój adres jest już potwierdzony.</Alert>
        <Link className="btn btn-primary btn-block" href="/panel">
          Przejdź do panelu
        </Link>
      </>
    );
  }
  const messages: Partial<Record<State, string>> = {
    expired: 'Link wygasł albo został już użyty.',
    wait: 'Nowy link możesz wysłać za minutę.',
    resendError: 'Nie udało się wysłać nowego linku. Spróbuj ponownie za chwilę.',
    error: 'Nie udało się potwierdzić adresu. Spróbuj ponownie za chwilę.',
  };
  return (
    <>
      <Alert variant="danger">{messages[state]}</Alert>
      <button type="button" className="btn btn-primary btn-block" onClick={sendNewLink}>
        Wyślij nowy link
      </button>
    </>
  );
}
