import { cropToSquare, loadImage } from './cropImage';

type Draw = [unknown, number, number, number, number, number, number, number, number];

function stubImage(fails = false) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

function stubCanvas({ context = true, blob = true } = {}) {
  const draws: Draw[] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (context ? { drawImage: (...args: Draw) => draws.push(args) } : null),
    toBlob: (done: (b: Blob | null) => void, type: string, quality: number) =>
      done(blob ? new Blob([`${type} ${quality}`], { type }) : null),
  };
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : create(tag),
  );
  return { canvas, draws };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cropToSquare', () => {
  it('draws the chosen square into a canvas of at most 1024 px and encodes JPEG', async () => {
    stubImage();
    const { canvas, draws } = stubCanvas();

    const blob = await cropToSquare('blob:x', { x: 10, y: 20, width: 1500, height: 1500 });

    expect([canvas.width, canvas.height]).toEqual([1024, 1024]);
    expect(draws[0]!.slice(1)).toEqual([10, 20, 1500, 1500, 0, 0, 1024, 1024]);
    expect(blob.type).toBe('image/jpeg');
    expect(await blob.text()).toBe('image/jpeg 0.92');
  });

  it('keeps small crops at their size', async () => {
    stubImage();
    const { canvas } = stubCanvas();

    await cropToSquare('blob:x', { x: 0, y: 0, width: 300.4, height: 300.4 });

    expect(canvas.width).toBe(300);
  });

  it.each([
    [{ context: false }, 'Canvas is not available'],
    [{ blob: false }, 'Cannot encode the image'],
  ])('fails when the browser cannot draw (%#)', async (options, message) => {
    stubImage();
    stubCanvas(options);

    await expect(cropToSquare('blob:x', { x: 0, y: 0, width: 10, height: 10 })).rejects.toThrow(
      message,
    );
  });

  it('fails for a file the browser cannot decode', async () => {
    stubImage(true);

    await expect(loadImage('blob:x')).rejects.toThrow('Cannot read the image');
  });
});
