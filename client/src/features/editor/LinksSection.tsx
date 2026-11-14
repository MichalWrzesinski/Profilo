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
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  /** A link change is waiting or running: the row buttons wait too. */
  busy?: boolean;
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
export function LinksSection({ links, run, busy = false }: Props) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const root = useRef<HTMLDivElement>(null);
  // Where focus goes once the list has re-rendered (the focused element may be gone).
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    const section = root.current;
    if (!target || !section) return;
    // The owner has moved on (e.g. typing in another field): leave their focus alone.
    const active = document.activeElement;
    if (active && active !== document.body && !section.contains(active)) {
      focusNext.current = null;
      return;
    }
    let element = section.querySelector<HTMLElement>(`[data-focus="${target}"]`);
    if (target === 'add' && element?.hasAttribute('disabled')) {
      // „Dodaj link” is disabled at 20 links: focus the last link instead.
      element = [...section.querySelectorAll<HTMLElement>('[data-focus^="edit-"]')].at(-1) ?? null;
    }
    if (element && !element.hasAttribute('disabled')) {
      element.focus();
      focusNext.current = null;
    }
  });
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

  const move = async (ids: string[], moved?: string) => {
    setOrder(ids);
    let saved = false;
    await call(async () => {
      const { data, error: problem } = await api.PUT('/api/v1/me/profile/links/order', {
        body: { linkIds: ids },
      });
      if (!data) {
        setError(
          (problem as Problem | undefined)?.detail ?? 'Nie udało się zmienić kolejności linków.',
        );
      }
      saved = Boolean(data);
      return data ?? null;
    });
    setOrder(null);
    if (saved && moved) {
      const place = ids.indexOf(moved) + 1;
      setAnnouncement(
        `Link ${labelOf(links, moved)} jest teraz na miejscu ${place} z ${ids.length}.`,
      );
    }
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
    const id = ids[index]!;
    const target = index + by;
    // At the first or last place the pressed arrow is disabled: focus the other one.
    const edge = target === 0 || target === ids.length - 1;
    focusNext.current = `${edge ? (by < 0 ? 'down' : 'up') : by < 0 ? 'up' : 'down'}-${id}`;
    void move(arrayMove(ids, index, target), id);
  };

  const remove = (link: Link, index: number) => {
    const neighbour = shown[index + 1] ?? shown[index - 1];
    focusNext.current = neighbour ? `edit-${neighbour.id}` : 'add';
    return call(async () => {
      const { response } = await api.DELETE('/api/v1/me/profile/links/{linkId}', {
        params: { path: { linkId: link.id } },
      });
      if (!response.ok) {
        focusNext.current = null;
        setError('Nie udało się usunąć linku. Spróbuj ponownie.');
        return null;
      }
      // DELETE answers without the profile: read it (twice at most) for the new version.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data } = await api.GET('/api/v1/me/profile');
        if (data) return data;
      }
      setError('Link został usunięty, ale nie udało się odświeżyć strony. Odśwież stronę.');
      return null;
    });
  };

  const closeForm = (id: string | 'new') => {
    focusNext.current = id === 'new' ? 'add' : `edit-${id}`;
    setEditing(null);
  };

  return (
    <section className="panel-sec" aria-labelledby="ed-links" ref={root}>
      <header>
        <h3 id="ed-links">Linki</h3>
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {links.length} / {MAX_LINKS}
        </span>
      </header>
      <div className="body">
        <span className="sr-only" role="status">
          {announcement}
        </span>
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
              data-focus="add"
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
                      onCancel={() => closeForm(link.id)}
                      onSaved={() => closeForm(link.id)}
                      run={run}
                    />
                  </li>
                ) : (
                  <SortableRow
                    key={link.id}
                    link={link}
                    first={index === 0}
                    last={index === shown.length - 1}
                    busy={busy}
                    onUp={() => shift(index, -1)}
                    onDown={() => shift(index, 1)}
                    onEdit={() => setEditing(link.id)}
                    onRemove={() => void remove(link, index)}
                  />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
        {editing === 'new' ? (
          <LinkForm onCancel={() => closeForm('new')} onSaved={() => closeForm('new')} run={run} />
        ) : (
          shown.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              data-focus="add"
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
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

function SortableRow({ link, first, last, busy, onUp, onDown, onEdit, onRemove }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id, disabled: busy });
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
          data-focus={`up-${link.id}`}
          disabled={first || busy}
          onClick={onUp}
        >
          <ArrowUp className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-icon ${styles.arrow}`}
          aria-label={`Przesuń w dół: ${link.label}`}
          data-focus={`down-${link.id}`}
          disabled={last || busy}
          onClick={onDown}
        >
          <ArrowDown className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`Edytuj ${link.label}`}
          data-focus={`edit-${link.id}`}
          disabled={busy}
          onClick={onEdit}
        >
          <Pencil className="i sm" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`Usuń ${link.label}`}
          disabled={busy}
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
    <form
      className={`card ${styles.form}${errors.url || errors.label || general ? ` ${styles.formError}` : ''}`}
      onSubmit={(event) => void submit(event)}
      noValidate
    >
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
