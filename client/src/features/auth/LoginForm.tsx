'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/Alert';
import { Field } from '@/components/Field';
import { api, type Problem } from '@/lib/api/client';
import { useSession } from '@/lib/session';
import { problemMessage } from './messages';

const schema = z.object({
  email: z.email('Wpisz pełny adres e-mail, np. anna@example.pl.'),
  password: z.string().min(1, 'Wpisz hasło.'),
});

type Values = z.input<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [alert, setAlert] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    const { data, error } = await api.POST('/api/v1/auth/login', { body: values });
    if (data) {
      signIn(data);
      router.push('/panel');
      return;
    }
    setAlert(problemMessage(error as Problem | undefined));
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      {alert && <Alert variant="danger">{alert}</Alert>}
      <Field
        label="E-mail"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        label="Hasło"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <button
        type="submit"
        className={`btn btn-primary btn-block${isSubmitting ? ' is-loading' : ''}`}
        disabled={isSubmitting}
      >
        Zaloguj się
      </button>
    </form>
  );
}
