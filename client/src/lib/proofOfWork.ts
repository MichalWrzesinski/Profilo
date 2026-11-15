import { solve, type Challenge } from './proofOfWorkSolver';

export { sha256Hex, solve, type Challenge } from './proofOfWorkSolver';

/**
 * Solve in a web worker so the page stays responsive; on the main thread without one (the
 * page then pauses for the few seconds it takes). The worker is not cancelled when the form
 * goes away: it ends by itself once solved, within `maxnumber` hashes.
 */
export function solveInBackground(challenge: Challenge): Promise<string | null> {
  if (typeof Worker === 'undefined') return solve(challenge);
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./proofOfWork.worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = (solution: string | null) => {
      worker.terminate();
      resolve(solution);
    };
    worker.onmessage = (event: MessageEvent<string | null>) => finish(event.data);
    worker.onerror = () => {
      worker.terminate();
      void solve(challenge).then(resolve); // a blocked worker: slower, but it still works
    };
    worker.postMessage(challenge);
  });
}
