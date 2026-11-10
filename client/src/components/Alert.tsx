import type { ReactNode } from 'react';

type Props = { variant: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode };

export function Alert({ variant, children }: Props) {
  return (
    <div className={`alert alert-${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <span className="grow">{children}</span>
    </div>
  );
}
