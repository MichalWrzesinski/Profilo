import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { OwnerProfile } from './fields';
import { checkFile, ImagesSection, MAX_BYTES } from './ImagesSection';

const upload = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const crop = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', async (original) => ({
  ...(await original<typeof import('@/lib/api/client')>()),
  uploadWithProgress: upload,
  authorizedFetch: vi.fn(async () => new Response(new Blob(['x'], { type: 'image/webp' }))),
  api: { DELETE: remove },
}));
vi.mock('./cropImage', () => ({ cropToSquare: crop }));
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onCropComplete({}, { x: 0, y: 0, width: 800, height: 800 })}
    >
      kadr
    </button>
  ),
}));

const AVATAR = {
  id: 'a1',
  urls: { '128': '/media/a1/128.webp', '256': '/media/a1/256.webp', '512': '/media/a1/512.webp' },
};
const BACKGROUND = {
  id: 'b1',
  urls: {
    '960': '/media/b1/960.webp',
    '1600': '/media/b1/1600.webp',
    '2400': '/media/b1/2400.webp',
  },
};

function profile(images: { avatar?: unknown; background?: unknown } = {}) {
  return {
    version: 4,
    draft: { displayName: 'Anna Wiśniewska', avatar: null, background: null, ...images },
  } as unknown as OwnerProfile;
}

function setup(initial = profile()) {
  const run = vi.fn();
  function Host() {
    const [current, setCurrent] = useState(initial);
    run.mockImplementation(async (change: () => Promise<OwnerProfile | null>) => {
      const next = await change();
      if (next) setCurrent(next);
    });
    return <ImagesSection profile={current} run={run} />;
  }
  render(<Host />);
  return { run, user: userEvent.setup() };
}

const file = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type });

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.clearAllMocks());

describe('checkFile', () => {
  it.each([
    [file('a.jpg', 'image/jpeg'), null],
    [file('a.webp', 'image/webp'), null],
    [file('a.pdf', 'application/pdf'), 'To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.'],
    [file('a.jpg', 'image/jpeg', MAX_BYTES + 1), 'Plik jest za duży. Wybierz obraz do 10 MB.'],
  ])('%s', (input, message) => {
    expect(checkFile(input)).toBe(message);
  });
});

describe('ImagesSection', () => {
  it('shows initials and the default graphic without images', () => {
    setup();

    expect(screen.getByText('AW')).toBeInTheDocument();
    expect(screen.getByText('Dodaj zdjęcie')).toBeInTheDocument();
    expect(screen.getByText('Dodaj grafikę tła')).toBeInTheDocument();
    expect(document.querySelector('.hero-art')).not.toBeNull();
  });

  it('crops the photo, uploads it with progress and shows it', async () => {
    let report: (fraction: number) => void = () => {};
    let finish: (value: { status: number; body: unknown }) => void = () => {};
    upload.mockImplementation((_url, _method, _form, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => (finish = resolve));
    });
    crop.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
    const { user } = setup();

    await user.upload(screen.getByLabelText('Dodaj zdjęcie'), file('zdjecie.jpg', 'image/jpeg'));
    expect(screen.getByRole('dialog', { name: 'Dopasuj zdjęcie' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Zapisz zdjęcie' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Powiększenie'), { target: { value: '2' } });
    expect(screen.getByLabelText('Powiększenie')).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'kadr' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz zdjęcie' }));

    await waitFor(() => expect(upload).toHaveBeenCalled());
    act(() => report(0.5));
    expect(screen.getByRole('progressbar', { name: 'Wgrywanie zdjęcia' })).toHaveValue(0.5);
    await act(async () => finish({ status: 200, body: profile({ avatar: AVATAR }) }));

    expect(await screen.findByText('Zmień zdjęcie')).toBeInTheDocument();
    expect(upload.mock.calls[0]![0]).toBe('/api/v1/me/profile/images/avatar');
    expect((upload.mock.calls[0]![2] as FormData).get('file')).toBeInstanceOf(Blob);
    expect(crop).toHaveBeenCalledWith('blob:test', { x: 0, y: 0, width: 800, height: 800 });
  });

  it('closes the crop dialog with Escape or „Anuluj” without uploading', async () => {
    const { user } = setup();

    await user.upload(screen.getByLabelText('Dodaj zdjęcie'), file('a.jpg', 'image/jpeg'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.upload(screen.getByLabelText('Dodaj zdjęcie'), file('a.jpg', 'image/jpeg'));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it('reports a photo that cannot be cropped', async () => {
    crop.mockRejectedValue(new Error('canvas'));
    const { user } = setup();

    await user.upload(screen.getByLabelText('Dodaj zdjęcie'), file('a.jpg', 'image/jpeg'));
    await user.click(screen.getByRole('button', { name: 'kadr' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz zdjęcie' }));

    expect(
      await screen.findByText('Nie udało się przyciąć zdjęcia. Wybierz inny plik.'),
    ).toBeVisible();
  });

  it('uploads a background without cropping', async () => {
    upload.mockResolvedValue({ status: 200, body: profile({ background: BACKGROUND }) });
    const { user } = setup();

    await user.upload(screen.getByLabelText('Dodaj grafikę tła'), file('tlo.png', 'image/png'));

    expect(await screen.findByText('Zmień grafikę tła')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a wrong file before uploading', () => {
    setup();

    // `user.upload` honours `accept`; a change event shows what a drop of any file does.
    fireEvent.change(screen.getByLabelText('Dodaj grafikę tła'), {
      target: { files: [file('a.pdf', 'application/pdf')] },
    });

    expect(
      screen.getByText('To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.'),
    ).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        status: 415,
        body: {
          status: 415,
          code: 'unsupported_image',
          detail: 'To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.',
        },
      },
      'To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik.',
    ],
    [{ status: 413, body: null }, 'Plik jest za duży. Wybierz obraz do 10 MB.'],
    [
      {
        status: 422,
        body: {
          errors: [{ field: 'file', code: 'image_too_small', message: 'Obraz jest za mały.' }],
        },
      },
      'Obraz jest za mały.',
    ],
    [{ status: 500, body: null }, 'Nie udało się wgrać obrazu. Spróbuj ponownie.'],
  ])('shows the API answer and keeps the previous image (%#)', async (result, message) => {
    upload.mockResolvedValue(result);
    const { user } = setup(profile({ background: BACKGROUND }));

    await user.upload(screen.getByLabelText('Zmień grafikę tła'), file('tlo.jpg', 'image/jpeg'));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByText('Zmień grafikę tła')).toBeInTheDocument();
  });

  it('reports a network failure', async () => {
    upload.mockRejectedValue(new Error('offline'));
    const { user } = setup();

    await user.upload(screen.getByLabelText('Dodaj grafikę tła'), file('tlo.jpg', 'image/jpeg'));

    expect(
      await screen.findByText('Nie udało się wgrać obrazu. Sprawdź połączenie i spróbuj ponownie.'),
    ).toBeVisible();
  });

  it('removes an image', async () => {
    remove.mockResolvedValue({ data: profile() });
    const { user } = setup(profile({ avatar: AVATAR }));

    await user.click(screen.getByRole('button', { name: 'Usuń zdjęcie' }));

    expect(await screen.findByText('Dodaj zdjęcie')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith('/api/v1/me/profile/images/{kind}', {
      params: { path: { kind: 'avatar' } },
    });
  });

  it.each([
    [() => Promise.resolve({ data: undefined })],
    [() => Promise.reject(new Error('offline'))],
  ])('reports a failed removal (%#)', async (result) => {
    remove.mockImplementation(result);
    const { user } = setup(profile({ background: BACKGROUND }));

    await user.click(screen.getByRole('button', { name: 'Usuń grafikę' }));

    expect(await screen.findByText('Nie udało się usunąć obrazu. Spróbuj ponownie.')).toBeVisible();
  });

  it('waits while another change runs', () => {
    render(<ImagesSection profile={profile({ avatar: AVATAR })} run={vi.fn()} busy />);

    expect(screen.getByLabelText('Zmień zdjęcie')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usuń zdjęcie' })).toBeDisabled();
  });
});
