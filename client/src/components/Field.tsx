import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Rendered inside the input group, after the input (e.g. a show-password button). */
  addon?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, hint, error, addon, id, ...input },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = `${inputId}-desc`;
  const control = (
    <input
      ref={ref}
      id={inputId}
      className={`input${error && !addon ? ' is-error' : ''}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error || hint ? describedBy : undefined}
      {...input}
    />
  );
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      {addon ? (
        <div className={`input-group${error ? ' is-error' : ''}`}>
          {control}
          <span className="state">{addon}</span>
        </div>
      ) : (
        control
      )}
      {error ? (
        <span id={describedBy} className="hint is-error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={describedBy} className="hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
});
