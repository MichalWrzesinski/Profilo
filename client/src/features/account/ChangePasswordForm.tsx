'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { problemMessage } from '@/features/auth/messages';
import { api, type Problem } from '@/lib/api/client';
import { useSession } from '@/lib/session';

const schema = z.object({
  currentPassword: z.string().min(1, 'Wpisz obecne hasło.'),
  newPassword: z
    .string()
    .min(10, 'Hasło jest za krótkie. Użyj co najmniej 10 znaków.')
    .max(128, 'Hasło może mieć najwyżej 128 znaków.'),
});
type Values = z.input<typeof schema>;

/** „Zmień hasło” (ACC-US-5): confirmed accounts only; every other session ends. */
export function ChangePasswordForm() {
  const { account, signIn } = useSession();
  const [done, setDone] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const confirmed = account?.emailConfirmed ?? false;

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    setDone(false);
    try {
      const { data, error, response } = await api.PUT('/api/v1/me/password', { body: values });
      if (data) {
        signIn(data); // the old access token stops working
        reset();
        return setDone(true);
      }
      const problem = error as Problem | undefined;
      if (problem?.code === 'invalid_password') {
        return setError('currentPassword', { message: 'Obecne hasło jest nieprawidłowe.' });
      }
      const fieldError = problem?.errors?.find((item) => item.field === 'newPassword');
      if (response.status === 422 && fieldError) {
        return setError('newPassword', { message: fieldError.message });
      }
      setAlert(problemMessage(problem));
    } catch {
      setAlert('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.');
    }
  });

  return (
    <section className="card card-pad" aria-labelledby="password-title">
      <h2 id="password-title">Zmień hasło</h2>
      {!confirmed ? (
        <p className="hint">Najpierw potwierdź adres e-mail — wtedy zmienisz hasło.</p>
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate>
          {done && (
            <Alert variant="success">
              Hasło zmienione. Wylogowaliśmy Cię na innych urządzeniach.
            </Alert>
          )}
          {alert && <Alert variant="danger">{alert}</Alert>}
          <Field
            label="Obecne hasło"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Field
            label="Nowe hasło"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            hint="Co najmniej 10 znaków. Po zmianie wylogujemy Cię na innych urządzeniach."
            error={errors.newPassword?.message}
            addon={
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-pressed={show}
                onClick={() => setShow((shown) => !shown)}
              >
                {show ? 'Ukryj' : 'Pokaż'}
              </button>
            }
            {...register('newPassword')}
          />
          <button
            type="submit"
            className={`btn btn-primary${isSubmitting ? ' is-loading' : ''}`}
            disabled={isSubmitting}
          >
            Zmień hasło
          </button>
        </form>
      )}
    </section>
  );
}
