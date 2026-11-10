type Props = { step: number; total?: number; label: string };

export function Stepper({ step, total = 4, label }: Props) {
  return (
    <div className="stepper" aria-label={`Krok ${step} z ${total}: ${label}`}>
      <span className="bars" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : undefined} />
        ))}
      </span>
      <b>
        Krok {step} z {total}
      </b>
      <span className="hide-m">· {label}</span>
    </div>
  );
}
