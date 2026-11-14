'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/Alert';
import { LinkIcon, shortUrl } from '@/components/LinkIcon';
import { api, type Problem } from '@/lib/api/client';
import type { OwnerProfile } from './fields';
import styles from './LinksSection.module.css';

type Link = OwnerProfile['draft']['links'][number];
type Change = () => Promise<OwnerProfile | null>;
type FieldErrors = { url?: string; label?: string };

export const MAX_LINKS = 20;

type Props = {
  links: Link[];
  /** Runs a link change between autosaves and adopts the returned profile. */
  run: (change: Change) => Promise<void>;
};

const labelOf = (links: Link[], id: unknown) =>
  links.find((link) => link.id === id)?.label ?? 'link';

/** Polish screen reader messages for drag and drop with mouse or keyboard. */
export function announcements(links: Link[]): Announcements {
  const place = (id: unknown) => links.findIndex((link) => link.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Przenosisz link ${labelOf(links, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `Link ${labelOf(links, active.id)} jest na miejscu ${place(over.id)} z ${links.length}.`
        : `Link ${labelOf(links, active.id)} jest poza listą.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Link ${labelOf(links, active.id)} jest teraz na miejscu ${place(over.id)}.`
        : `Kolejność się nie zmieniła.`,
    onDragCancel: ({ active }) =>
      `Anulowano przenoszenie linku ${labelOf(links, active.id)}. Kolejność się nie zmieniła.`,
  };
}

/** Order after dropping `active` on `over`, or null when nothing moved. */
export function droppedOrder(ids: string[], active: unknown, over: unknown): string[] | null {
  if (over === undefined || over === null || active === over) return null;
  return arrayMove(ids, ids.indexOf(String(active)), ids.indexOf(String(over)));
}

const INSTRUCTIONS =
  'Aby przenieść link, naciśnij spację lub Enter, użyj strzałek w górę i w dół, a potem ' +
  'naciśnij spację lub Enter, aby upuścić. Escape anuluje.';

/** Links in the draft: list, inline add/edit form, order by dragging or ↑/↓ (PRF-BR-11). */
export function LinksSection({ links, run }: Props) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // While a new order is being saved, show it instead of the server's.
  const shown = order
    ? order.map((id) => links.find((link) => link.id === id)).filter((l): l is Link => !!l)
    : links;
  const full = links.length >= MAX_LINKS;

  const call = async (change: () => Promise<OwnerProfile | null>) => {
    setError(null);
    await run(async () => {
      try {
        return await change();
      } catch {
        setError('Nie udało się zapisać linków. Sprawdź połączenie i spróbuj ponownie.');
        return null;
      }
    });
  };

  const move = async (ids: string[]) => {
    setOrder(ids);
    await call(async () => {
      const { data, error: problem } = await api.PUT('/api/v1/me/profile/links/order', {
        body: { linkIds: ids },
      });
      if (!data) {
        setError(
          (problem as Problem | undefined)?.detail ?? 'Nie udało się zmienić kolejności linków.',
        );
      }
      return data ?? null;
    });
    setOrder(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const ids = droppedOrder(
      shown.map((link) => link.id),
      active.id,
      over?.id,
    );
    if (ids) void move(ids);
  };

  const shift = (index: number, by: -1 | 1) => {
    const ids = shown.map((link) => link.id);
    void move(arrayMove(ids, index, index + by));
  };

  const remove = (link: Link) =>
    call(async () => {
      const { response } = await api.DELETE('/api/v1/me/profile/links/{linkId}', {
        params: { path: { linkId: link.id } },
      });
      if (!response.ok) {
        setError('Nie udało się usunąć linku. Spróbuj ponownie.');
        return null;
      }
      const { data } = await api.GET('/api/v1/me/profile');
      return data ?? null;
    });

  return (
    <section className="panel-sec" aria-labelledby="ed-links">
      <header>
        <h3 id="ed-links">Linki</h3>
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {links.length} / {MAX_LINKS}
        </span>
      </header>
      <div className="body">
        {error && <Alert variant="danger">{error}</Alert>}
        {shown.length === 0 && editing !== 'new' && (
          <div className="empty">
            <div className="ill">
              <Link2 className="i" aria-hidden="true" />
            </div>
            <b>Nie masz jeszcze linków</b>
            <p>Dodaj LinkedIn, portfolio albo stronę firmy, żeby łatwiej było Cię znaleźć.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setEditing('new')}
            >
              <Plus className="i sm" aria-hidden="true" />
              Dodaj pierwszy link
            </button>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: announcements(shown),
            screenReaderInstructions: { draggable: INSTRUCTIONS },
          }}
        >
          <SortableContext
            items={shown.map((link) => link.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.list} aria-label="Twoje linki">
              {shown.map((link, index) =>
                editing === link.id ? (
                  <li key={link.id}>
                    <LinkForm
                      link={link}
                      onCancel={() => setEditing(null)}
                      onSaved={() => setEditing(null)}
                      run={run}
                    />
                  </li>
                ) : (
                  <SortableRow
                    key={link.id}
                    link={link}
                    first={index === 0}
                    last={index === shown.length - 1}
                    onUp={() => shift(index, -1)}
                    onDown={() => shift(index, 1)}
                    onEdit={() => setEditing(link.id)}
                    onRemove={() => void remove(link)}
                  />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
        {editing === 'new' ? (
          <LinkForm onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} run={run} />
        ) : (
          shown.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={full}
              onClick={() => setEditing('new')}
            >
              <Plus className="i sm" aria-hidden="true" />
              Dodaj link
            </button>
          )
        )}
        {full && <p className="hint">Masz już 20 linków — to najwięcej, ile można dodać.</p>}
        {shown.length > 1 && (
          <p className="hint" style={{ marginTop: 'var(--space-2)' }}>
            Przeciągnij, aby zmienić kolejność. Na telefonie użyj strzałek.
          </p>
        )}
      </div>
    </section>
  );
}

type RowProps = {
  link: Link;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

function SortableRow({ link, first, last, onUp, onDown, onEdit, onRemove }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });
  return (
    <li
      ref={setNodeRef}
      className={`link-row${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={`handle ${styles.handle}`}
        aria-label={`Przeciągnij, aby zmienić kolejność: ${link.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="i" aria-hidden="true" />
      </button>
      <LinkIcon service={link.service} />
      <span className="txt">
        <b>{link.label}</b>
        <small>{shortUrl(link.url)}</small>
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${styles.arrow}`}
          aria-label={`Przesuń w górę: ${link.label}`}
          disabled={first}
          onClick={onUp}
        >
          <ArrowUp className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${styles.arrow}`}
          aria-label={`Przesuń w dół: ${link.label}`}
          disabled={last}
          onClick={onDown}
        >
          <ArrowDown className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`Edytuj ${link.label}`}
          onClick={onEdit}
        >
          <Pencil className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`Usuń ${link.label}`}
          onClick={onRemove}
        >
          <Trash2 className="i sm" aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}

type FormProps = {
  link?: Link;
  onCancel: () => void;
  onSaved: () => void;
  run: (change: Change) => Promise<void>;
};

function LinkForm({ link, onCancel, onSaved, run }: FormProps) {
  const [url, setUrl] = useState(link?.url ?? '');
  const [label, setLabel] = useState(link?.label ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = link?.id ?? 'new';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return setErrors({ url: 'Wpisz adres strony.' });
    if (link && !label.trim()) return setErrors({ label: 'Wpisz etykietę.' });
    setSaving(true);
    setErrors({});
    setGeneral(null);
    let saved = false;
    await run(async () => {
      try {
        const body = { url: url.trim(), ...(label.trim() ? { label: label.trim() } : {}) };
        const { data, error, response } = link
          ? await api.PATCH('/api/v1/me/profile/links/{linkId}', {
              params: { path: { linkId: link.id } },
              body,
            })
          : await api.POST('/api/v1/me/profile/links', { body });
        if (data) {
          saved = true;
          return data;
        }
        const problem = error as Problem | undefined;
        const fields: FieldErrors = {};
        for (const item of problem?.errors ?? []) {
          if (item.field === 'url' || item.field === 'label') fields[item.field] = item.message;
        }
        if (Object.keys(fields).length) setErrors(fields);
        else if (response.status === 409 && problem?.detail) setGeneral(problem.detail);
        else setGeneral('Nie udało się zapisać linku. Spróbuj ponownie.');
      } catch {
        setGeneral('Nie udało się zapisać linku. Sprawdź połączenie i spróbuj ponownie.');
      }
      return null;
    });
    setSaving(false);
    if (saved) onSaved();
  };

  const hint = (field: keyof FieldErrors) => (
    <span id={`link-${id}-${field}-error`} aria-live="polite" className={styles.slot}>
      {errors[field] && (
        <span className="hint is-error">
          <CircleAlert className="i sm" aria-hidden="true" />
          {errors[field]}
        </span>
      )}
    </span>
  );

  return (
    <form className={`card ${styles.form}`} onSubmit={(event) => void submit(event)} noValidate>
      {general && <Alert variant="danger">{general}</Alert>}
      <div className="field">
        <label className="field-label" htmlFor={`link-${id}-url`}>
          Adres strony
        </label>
        <input
          id={`link-${id}-url`}
          className={`input${errors.url ? ' is-error' : ''}`}
          value={url}
          inputMode="url"
          autoComplete="url"
          placeholder="np. linkedin.com/in/twoje-imie"
          aria-invalid={errors.url ? true : undefined}
          aria-describedby={`link-${id}-url-error`}
          onChange={(event) => setUrl(event.target.value)}
          autoFocus
        />
        {hint('url')}
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`link-${id}-label`}>
          Etykieta {!link && <span className="opt">(opcjonalnie)</span>}
        </label>
        <input
          id={`link-${id}-label`}
          className={`input${errors.label ? ' is-error' : ''}`}
          value={label}
          maxLength={40}
          placeholder={link ? undefined : 'Puste pole: nazwa serwisu albo domena'}
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={`link-${id}-label-error`}
          onChange={(event) => setLabel(event.target.value)}
        />
        {hint('label')}
      </div>
      <div className={styles.formActions}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Anuluj
        </button>
        <button
          type="submit"
          className={`btn btn-primary btn-sm${saving ? ' is-loading' : ''}`}
          disabled={saving}
        >
          Zapisz link
        </button>
      </div>
    </form>
  );
}
