'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { api, type Problem } from '@/lib/api/client';
import { plural } from '@/lib/plural';
import { useSession } from '@/lib/session';
import { problemMessage } from './messages';

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Wpisz imię i nazwisko lub pseudonim.')
    .max(60, 'Nazwa może mieć najwyżej 60 znaków.'),
  email: z.email('Wpisz pełny adres e-mail, np. anna@example.pl.'),
  password: z
    .string()
    .min(10, 'Hasło jest za krótkie. Użyj co najmniej 10 znaków.')
    .max(128, 'Hasło może mieć najwyżej 128 znaków.'),
  acceptTerms: z.literal(true, { error: 'Zaakceptuj regulamin, aby założyć konto.' }),
});

type Values = z.input<typeof schema>;
type FormAlert = { kind: 'email_taken' } | { kind: 'error'; message: string };

const FIELDS = ['displayName', 'email', 'password', 'acceptTerms'] as const;

export function RegisterForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const errorCount = FIELDS.filter((field) => errors[field]).length;

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    const { data, error, response } = await api.POST('/api/v1/accounts', {
      body: { ...values, acceptTerms: true, challenge: null },
    });
    if (data) {
      signIn(data);
      router.push('/panel');
      return;
    }
    const problem = error as Problem | undefined;
    if (response.status === 409) {
      setAlert({ kind: 'email_taken' });
    } else if (response.status === 422 && problem?.errors?.length) {
      for (const fieldError of problem.errors) {
        const field = FIELDS.find((name) => name === fieldError.field) ?? 'password';
        setError(field, { message: fieldError.message });
      }
    } else {
      setAlert({ kind: 'error', message: problemMessage(problem) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      {alert?.kind === 'email_taken' && (
        <Alert variant="danger">
          Konto z tym adresem już istnieje. <Link href="/logowanie">Zaloguj się</Link>.
        </Alert>
      )}
      {alert?.kind === 'error' && <Alert variant="danger">{alert.message}</Alert>}
      {submitCount > 0 && errorCount > 0 && (
        <Alert variant="danger">
          Popraw {errorCount}{' '}
          {plural(errorCount, 'pole zaznaczone', 'pola zaznaczone', 'pól zaznaczonych')} poniżej.
        </Alert>
      )}

      <Field
        label="Imię i nazwisko lub pseudonim"
        autoComplete="name"
        hint="Tak podpiszesz swoją stronę. Zmienisz to w każdej chwili."
        error={errors.displayName?.message}
        {...register('displayName')}
      />
      <Field
        label="E-mail do logowania"
        type="email"
        autoComplete="email"
        hint="Nie pokażemy go na Twojej stronie."
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Hasło"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        hint="Co najmniej 10 znaków."
        error={errors.password?.message}
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
        {...register('password')}
      />

      <div className="field">
        <label className="checkbox">
          <input type="checkbox" {...register('acceptTerms')} />
          <span>
            Akceptuję <Link href="/regulamin">Regulamin</Link> i zapoznałem(-am) się z{' '}
            <Link href="/prywatnosc">Polityką prywatności</Link>.
          </span>
        </label>
        {errors.acceptTerms && (
          <span className="hint is-error" role="alert">
            {errors.acceptTerms.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        className={`btn btn-primary btn-block${isSubmitting ? ' is-loading' : ''}`}
        disabled={isSubmitting}
      >
        Załóż konto
      </button>
    </form>
  );
}
