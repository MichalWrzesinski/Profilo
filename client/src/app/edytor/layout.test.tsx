import { render, screen } from '@testing-library/react';
import { tokenStore } from '@/lib/api/client';
import { SessionProvider } from '@/lib/session';
import { json, mockFetch, SESSION } from '@/test/fetch';
import { router } from '@/test/navigation';
import EditorLayout from './layout';
import EditorPage, { metadata } from './page';

afterEach(() => {
  tokenStore.set(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('/edytor', () => {
  it('waits for the session, then shows the editor', async () => {
    mockFetch(async (request) =>
      request.url.endsWith('/auth/refresh') ? json(200, SESSION) : json(500, { status: 500 }),
    );

    render(
      <SessionProvider>
        <EditorLayout>
          <EditorPage />
        </EditorLayout>
      </SessionProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Wczytywanie');
    expect(await screen.findByText(/Nie udało się wczytać Twojej strony/)).toBeVisible();
    expect(metadata.title).toBe('Edycja strony — Profilo');
  });

  it('sends anonymous visitors to the login page', async () => {
    mockFetch(() => json(401, { status: 401, code: 'unauthorized' }));

    render(
      <SessionProvider>
        <EditorLayout>
          <p>treść</p>
        </EditorLayout>
      </SessionProvider>,
    );

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/logowanie'));
    expect(screen.queryByText('treść')).toBeNull();
  });
});
