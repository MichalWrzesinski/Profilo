const posted = vi.fn();

beforeAll(async () => {
  vi.stubGlobal('postMessage', posted);
  await import('./proofOfWork.worker');
});

afterAll(() => vi.unstubAllGlobals());

it('answers with the solution', async () => {
  const salt = 's?expires=1';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}3`));
  const challenge = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  );

  await (self.onmessage as (event: MessageEvent) => Promise<void>)({
    data: { algorithm: 'SHA-256', challenge, maxnumber: 10, salt, signature: 'x' },
  } as MessageEvent);

  expect(JSON.parse(atob(posted.mock.calls.at(-1)![0])).number).toBe(3);
});

it('answers null when solving fails', async () => {
  await (self.onmessage as (event: MessageEvent) => Promise<void>)({ data: null } as MessageEvent);

  expect(posted).toHaveBeenLastCalledWith(null);
});
