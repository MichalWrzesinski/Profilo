'use client';

import { useEffect, useRef, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import styles from './ImagesSection.module.css';

type Props = {
  src: string;
  onCancel: () => void;
  onDone: (area: Area) => void;
};

/** Square crop for the profile photo (PRF-BR-13): drag, zoom, or use the arrow keys. */
export function CropDialog({ src, onCancel, onDone }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onCancel]);

  return (
    <div className="scrim">
      <div
        ref={dialog}
        className={`modal ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        aria-describedby="crop-hint"
      >
        <h2 id="crop-title">Dopasuj zdjęcie</h2>
        <p id="crop-hint" className="muted">
          Przesuń zdjęcie myszą, palcem albo strzałkami. Kwadrat to to, co zobaczą odwiedzający.
        </p>
        <div className={styles.cropArea}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <label className="field-label" htmlFor="crop-zoom">
          Powiększenie
        </label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          data-autofocus
          onChange={(event) => setZoom(Number(event.target.value))}
          className={styles.zoom}
        />
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!area}
            onClick={() => area && onDone(area)}
          >
            Zapisz zdjęcie
          </button>
        </div>
      </div>
    </div>
  );
}
