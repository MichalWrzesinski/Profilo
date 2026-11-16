'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { api, type Problem } from '@/lib/api/client';
import styles from './auth.module.css';
import { problemMessage } from './messages';

const schema = z.object({ email: z.email('Wpisz pełny adres e-mail, np. anna@example.pl') });
type Values = z.input<typeof schema>;

/** „Nie pamiętam hasła”: ask for a reset link (ACC-US-4). The answer never says whether
 * the account exists (ACC-BR-7). */
export function ResetRequestForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    try {
      const { response, error } = await api.POST('/api/v1/auth/password-resets', {
        body: values,
      });
      if (response.status === 202) return setSentTo(values.email);
      setAlert(problemMessage(error as Problem | undefined));
    } catch {
      setAlert('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie');
    }
  });

  if (sentTo) {
    return (
      <>
        <Alert variant="success">
          Jeśli konto z adresem <b>{sentTo}</b> istnieje, wysłaliśmy na nie link do ustawienia
          nowego hasła. Link jest ważny przez 1 godzinę
        </Alert>
        <p className="hint">Nie widzisz wiadomości? Sprawdź folder spam</p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={() => setSentTo(null)}>
            Wyślij jeszcze raz
          </button>
          <Link className="btn btn-ghost" href="/logowanie">
            Wróć do logowania
          </Link>
        </div>
      </>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      {alert && <Alert variant="danger">{alert}</Alert>}
      <Field
        label="E-mail do logowania"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <button
        type="submit"
        className={`btn btn-primary btn-block${isSubmitting ? ' is-loading' : ''}`}
        disabled={isSubmitting}
      >
        Wyślij link
      </button>
      <p className={styles.back}>
        <Link href="/logowanie">Wróć do logowania</Link>
      </p>
    </form>
  );
}
