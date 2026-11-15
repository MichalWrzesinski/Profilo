import { solve, type Challenge } from './proofOfWorkSolver';

/** Web worker: solves the registration challenge off the main thread. Any failure answers
 * null, so the form shows a message instead of waiting forever. */
self.onmessage = async (event: MessageEvent<Challenge>) => {
  try {
    self.postMessage(await solve(event.data));
  } catch {
    self.postMessage(null);
  }
};
