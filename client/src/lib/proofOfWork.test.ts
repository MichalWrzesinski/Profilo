import { sha256Hex as sha256Sync, solve, solveInBackground, type Challenge } from './proofOfWork';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function challengeFor(number: number, maxnumber = 500): Promise<Challenge> {
  const salt = 'abc123?expires=9999999999';
  return {
    algorithm: 'SHA-256',
    challenge: await sha256Hex(`${salt}${number}`),
    maxnumber,
    salt,
    signature: 'podpis',
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    ['zażółć gęślą jaźń?expires=1', ''],
  ])('matches the standard for %j', async (text, expected) => {
    expect(sha256Sync(text)).toBe(expected || (await sha256Hex(text)));
  });

  it('works without crypto.subtle (plain HTTP)', async () => {
    const challenge = await challengeFor(42);
    vi.stubGlobal('crypto', {});

    expect(JSON.parse(atob((await solve(challenge))!)).number).toBe(42);
  });
});

describe('solve', () => {
  it('refuses an absurd challenge', async () => {
    expect(await solve({ ...(await challengeFor(1)), maxnumber: 1e9 })).toBeNull();
  });

  it('finds the number and encodes the ALTCHA payload', async () => {
    const solution = await solve(await challengeFor(321));

    expect(JSON.parse(atob(solution!))).toEqual({
      algorithm: 'SHA-256',
      challenge: (await challengeFor(321)).challenge,
      number: 321,
      salt: 'abc123?expires=9999999999',
      signature: 'podpis',
    });
  });

  it('gives up beyond maxnumber', async () => {
    expect(await solve(await challengeFor(30, 10))).toBeNull();
  });
});

describe('solveInBackground', () => {
  it('solves on the main thread without web workers', async () => {
    vi.stubGlobal('Worker', undefined);

    expect(await solveInBackground(await challengeFor(5))).not.toBeNull();
  });

  it('uses a web worker and ends it', async () => {
    const terminate = vi.fn();
    class FakeWorker {
      onmessage: ((event: MessageEvent<string | null>) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = terminate;
      postMessage() {
        queueMicrotask(() => this.onmessage?.({ data: 'rozwiazanie' } as MessageEvent<string>));
      }
    }
    vi.stubGlobal('Worker', FakeWorker);

    expect(await solveInBackground(await challengeFor(5))).toBe('rozwiazanie');
    expect(terminate).toHaveBeenCalled();
  });

  it('falls back to the main thread when the worker fails', async () => {
    class BrokenWorker {
      onmessage: (() => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();
      postMessage() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Worker', BrokenWorker);

    const solution = await solveInBackground(await challengeFor(7));

    expect(JSON.parse(atob(solution!)).number).toBe(7);
  });
});
