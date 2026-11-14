'use client';

import { CircleAlert, ImageIcon, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import type { Area } from 'react-easy-crop';
import { OwnerImage } from '@/components/OwnerImage';
import { api, uploadWithProgress, type Problem } from '@/lib/api/client';
import { initials } from '@/lib/publicProfile';
import { CropDialog } from './CropDialog';
import { cropToSquare } from './cropImage';
import type { OwnerProfile } from './fields';
import styles from './ImagesSection.module.css';

type Kind = 'avatar' | 'background';
type Change = () => Promise<OwnerProfile | null>;

export const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TOO_LARGE = 'Plik jest za duży. Wybierz obraz do 10 MB.';
const UNSUPPORTED = 'To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.';

type Props = {
  profile: OwnerProfile;
  run: (change: Change) => Promise<void>;
  busy?: boolean;
};

/** Checks done before uploading; the API checks the content again. */
export function checkFile(file: File): string | null {
  if (!TYPES.includes(file.type)) return UNSUPPORTED;
  if (file.size > MAX_BYTES) return TOO_LARGE;
  return null;
}

/** Profile photo (square crop) and background image in the editor (PRF-BR-13). */
export function ImagesSection({ profile, run, busy = false }: Props) {
  const [cropping, setCropping] = useState<string | null>(null);
  const [progress, setProgress] = useState<Partial<Record<Kind, number>>>({});
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const inputs = {
    avatar: useRef<HTMLInputElement>(null),
    background: useRef<HTMLInputElement>(null),
  };
  const { avatar, background, displayName } = profile.draft;

  const fail = (kind: Kind, message: string | null) =>
    setErrors((current) => ({ ...current, [kind]: message ?? undefined }));

  const send = (kind: Kind, blob: Blob, name: string) =>
    run(async () => {
      fail(kind, null);
      setProgress((current) => ({ ...current, [kind]: 0 }));
      try {
        const form = new FormData();
        form.append('file', blob, name);
        const { status, body } = await uploadWithProgress(
          `/api/v1/me/profile/images/${kind}`,
          'PUT',
          form,
          (fraction) => setProgress((current) => ({ ...current, [kind]: fraction })),
        );
        if (status === 200) return body as OwnerProfile;
        const problem = body as Problem | null;
        fail(
          kind,
          status === 413
            ? TOO_LARGE
            : (problem?.errors?.[0]?.message ??
                problem?.detail ??
                'Nie udało się wgrać obrazu. Spróbuj ponownie.'),
        );
      } catch {
        fail(kind, 'Nie udało się wgrać obrazu. Sprawdź połączenie i spróbuj ponownie.');
      } finally {
        setProgress((current) => ({ ...current, [kind]: undefined }));
      }
      return null;
    });

  const choose = (kind: Kind) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // the same file can be chosen again
    if (!file) return;
    const problem = checkFile(file);
    if (problem) return fail(kind, problem);
    fail(kind, null);
    if (kind === 'avatar') setCropping(URL.createObjectURL(file));
    else void send('background', file, file.name);
  };

  const closeCrop = () => {
    if (cropping) URL.revokeObjectURL(cropping);
    setCropping(null);
    inputs.avatar.current?.focus();
  };

  const cropped = async (area: Area) => {
    const src = cropping;
    setCropping(null);
    if (!src) return;
    try {
      const blob = await cropToSquare(src, area);
      await send('avatar', blob, 'avatar.jpg');
    } catch {
      fail('avatar', 'Nie udało się przyciąć zdjęcia. Wybierz inny plik.');
    } finally {
      URL.revokeObjectURL(src);
    }
  };

  const remove = (kind: Kind) =>
    run(async () => {
      fail(kind, null);
      try {
        const { data } = await api.DELETE('/api/v1/me/profile/images/{kind}', {
          params: { path: { kind } },
        });
        if (data) return data;
      } catch {
        // reported below
      }
      fail(kind, 'Nie udało się usunąć obrazu. Spróbuj ponownie.');
      return null;
    });

  const row = (kind: Kind) => {
    const image = kind === 'avatar' ? avatar : background;
    const label =
      kind === 'avatar'
        ? image
          ? 'Zmień zdjęcie'
          : 'Dodaj zdjęcie'
        : image
          ? 'Zmień grafikę tła'
          : 'Dodaj grafikę tła';
    const uploading = progress[kind];
    const describedBy = `img-${kind}-hint img-${kind}-error`;
    return (
      <div className={styles.upload}>
        {kind === 'avatar' ? (
          <div className="avatar avatar-sm" aria-hidden="true">
            {image ? <OwnerImage url={image.urls['256']!} alt="" /> : initials(displayName)}
          </div>
        ) : (
          <div className={`${styles.bgThumb}${image ? '' : ' hero-art'}`} aria-hidden="true">
            {image && <OwnerImage url={image.urls['960']!} alt="" />}
          </div>
        )}
        <div className={styles.controls}>
          <div className={styles.buttons}>
            <label
              className={`btn btn-secondary btn-sm${busy ? ' is-disabled' : ''}`}
              htmlFor={`img-${kind}`}
            >
              <ImageIcon className="i sm" aria-hidden="true" />
              {label}
            </label>
            <input
              ref={inputs[kind]}
              id={`img-${kind}`}
              type="file"
              accept={TYPES.join(',')}
              className="sr-only"
              disabled={busy}
              aria-describedby={describedBy}
              onChange={choose(kind)}
            />
            {image && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => void remove(kind)}
              >
                <Trash2 className="i sm" aria-hidden="true" />
                {kind === 'avatar' ? 'Usuń zdjęcie' : 'Usuń grafikę'}
              </button>
            )}
          </div>
          {uploading !== undefined && (
            <progress
              className={styles.progress}
              max={1}
              value={uploading}
              aria-label={kind === 'avatar' ? 'Wgrywanie zdjęcia' : 'Wgrywanie grafiki'}
            />
          )}
          <p id={`img-${kind}-hint`} className="hint">
            {kind === 'avatar'
              ? 'JPG, PNG lub WebP, do 10 MB.'
              : 'Bez grafiki użyjemy wzoru w kolorze przewodnim.'}
          </p>
          <span id={`img-${kind}-error`} aria-live="polite" className={styles.slot}>
            {errors[kind] && (
              <span className="hint is-error">
                <CircleAlert className="i sm" aria-hidden="true" />
                {errors[kind]}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {row('avatar')}
      {row('background')}
      {cropping && (
        <CropDialog src={cropping} onCancel={closeCrop} onDone={(a) => void cropped(a)} />
      )}
    </>
  );
}
