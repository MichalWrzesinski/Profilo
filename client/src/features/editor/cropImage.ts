import type { Area } from 'react-easy-crop';

/** Longest side sent to the API; the server makes 128/256/512 px variants from it. */
const MAX_SIDE = 1024;

/** Load a file into an image element (decoded by the browser, nothing sent anywhere). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Cannot read the image'));
    image.src = src;
  });
}

/** The chosen square as a JPEG (EXIF is not copied by the canvas). */
export async function cropToSquare(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const side = Math.min(MAX_SIDE, Math.round(area.width));
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, side, side);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Cannot encode the image'))),
      'image/jpeg',
      0.92,
    ),
  );
}
