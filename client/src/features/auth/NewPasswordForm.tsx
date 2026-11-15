'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { api, type Problem } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { problemMessage } from './messages';

const schema = z.object({
  newPassword: z
    .string()
    .min(10, 'Hasło jest za krótkie. Użyj co najmniej 10 znaków.')
    .max(128, 'Hasło może mieć najwyżej 128 znaków.'),
});
type Values = z.input<typeof schema>;

function Expired() {
  return (
    <>
      <Alert variant="danger">
        <b>Link wygasł.</b> Link do zmiany hasła działa przez 1 godzinę i tylko raz.
      </Alert>
      <Link className="btn btn-primary btn-block" href="/nie-pamietam-hasla">
        Wyślij nowy link
      </Link>
    </>
  );
}

/** New password from the e-mail link (ACC-BR-7): logs in and ends every other session. */
export function NewPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const { signIn } = useSession();
  const [state, setState] = useState<'form' | 'expired' | 'done'>(
    token.length < 20 ? 'expired' : 'form',
  );
  const [alert, setAlert] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setAlert(null);
    try {
      const { data, error, response } = await api.POST('/api/v1/auth/password-resets/confirm', {
        body: { token, newPassword },
      });
      if (data) {
        signIn(data);
        return setState('done');
      }
      const problem = error as Problem | undefined;
      if (response.status === 410) return setState('expired');
      const fieldError = problem?.errors?.find((item) => item.field === 'newPassword');
      if (response.status === 422 && fieldError) {
        return setError('newPassword', { message: fieldError.message });
      }
      setAlert(problemMessage(problem));
    } catch {
      setAlert('Nie udało się połączyć. Sprawdź połączenie i spróbuj ponownie.');
    }
  });

  if (state === 'expired') return <Expired />;
  if (state === 'done') {
    return (
      <>
        <Alert variant="success">
          <b>Hasło zmienione.</b> Jesteś zalogowany(-a). Wylogowaliśmy Cię na innych urządzeniach.
        </Alert>
        <Link className="btn btn-primary btn-block" href="/panel">
          Przejdź do panelu
        </Link>
      </>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      {alert && <Alert variant="danger">{alert}</Alert>}
      <Field
        label="Nowe hasło"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        hint="Co najmniej 10 znaków. Po zmianie wylogujemy Cię na innych urządzeniach."
        error={errors.newPassword?.message}
        addon={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? 'Ukryj' : 'Pokaż'}
          </button>
        }
        {...register('newPassword')}
      />
      <button
        type="submit"
        className={`btn btn-primary btn-block${isSubmitting ? ' is-loading' : ''}`}
        disabled={isSubmitting}
      >
        Ustaw nowe hasło
      </button>
    </form>
  );
}
