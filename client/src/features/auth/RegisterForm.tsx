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
import type { components } from '@/lib/api/schema';
import { plural } from '@/lib/plural';
import { solveInBackground } from '@/lib/proofOfWork';
import { useSession } from '@/lib/session';
import { problemMessage } from './messages';

const schema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Wpisz imię i nazwisko lub pseudonim')
    .max(60, 'Nazwa może mieć najwyżej 60 znaków'),
  email: z.email('Wpisz pełny adres e-mail, np. anna@example.pl'),
  password: z
    .string()
    .min(10, 'Hasło jest za krótkie. Użyj co najmniej 10 znaków')
    .max(128, 'Hasło może mieć najwyżej 128 znaków'),
  acceptTerms: z.literal(true, { error: 'Zaakceptuj regulamin, aby założyć konto' }),
});

type Values = z.input<typeof schema>;
type ChallengeProblem = components['schemas']['ChallengeProblem'];
type FormAlert = { kind: 'email_taken' } | { kind: 'error'; message: string };

const FIELDS = ['displayName', 'email', 'password', 'acceptTerms'] as const;

/** `nick`: the address chosen on the landing, passed on to wizard step 1. */
export function RegisterForm({ nick }: { nick?: string } = {}) {
  const router = useRouter();
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState<FormAlert | null>(null);
  const [verifying, setVerifying] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const errorCount = FIELDS.filter((field) => errors[field]).length;

  const send = (values: Values, challenge: string | null) =>
    api.POST('/api/v1/accounts', { body: { ...values, acceptTerms: true, challenge } });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    let { data, error, response } = await send(values, null);
    if (response.status === 428) {
      // Many registrations from this network: prove some work first (TASK-018).
      setVerifying(true);
      try {
        const solution = await solveInBackground((error as ChallengeProblem).challenge);
        ({ data, error, response } = await send(values, solution));
      } finally {
        setVerifying(false);
      }
    }
    if (data) {
      signIn(data);
      router.push(nick ? `/kreator?adres=${encodeURIComponent(nick)}` : '/kreator');
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
    } else if (response.status === 428) {
      setAlert({
        kind: 'error',
        message: 'Nie udało się potwierdzić, że nie jesteś automatem. Spróbuj ponownie.',
      });
    } else {
      setAlert({ kind: 'error', message: problemMessage(problem) });
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      {alert?.kind === 'email_taken' && (
        <Alert variant="danger">
          Konto z tym adresem już istnieje. <Link href="/logowanie">Zaloguj się</Link> albo{' '}
          <Link href="/nie-pamietam-hasla">zresetuj hasło</Link>.
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
        hint="Tak podpiszesz swoją stronę, ale w każdej chwili możesz to zmienić"
        error={errors.displayName?.message}
        {...register('displayName')}
      />
      <Field
        label="E-mail do logowania"
        type="email"
        autoComplete="email"
        hint="Nie pokażemy go na Twojej stronie"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Hasło"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        hint="Co najmniej 10 znaków"
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
      {/* Always rendered: screen readers announce the text when it appears. */}
      <p className="hint" role="status" aria-live="polite">
        {verifying && 'Sprawdzamy, czy nie jesteś automatem. To potrwa kilka sekund…'}
      </p>
    </form>
  );
}
