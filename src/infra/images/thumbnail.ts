import { decode, encode } from "jpeg-js";

// Long edge in pixels: a catalogue card is at most ~160 CSS px wide, so this
// stays sharp on a 2x screen while weighing a few kilobytes.
export const THUMBNAIL_EDGE = 320;
const THUMBNAIL_QUALITY = 75;

// Decompression-bomb guards: a 10 MB upload can still declare dimensions that
// would need gigabytes once decoded. The web client sends at most 1536 px on
// the long edge (about 2.4 MP), so these leave plenty of room.
const MAX_RESOLUTION_MP = 25;
const MAX_MEMORY_MB = 256;

/**
 * A small JPEG for catalogue grids, or undefined when the photo is not a JPEG.
 *
 * Pure JavaScript rather than sharp: sharp ships native binaries per platform,
 * which do not survive this project's single-file esbuild bundles. PNG uploads
 * get no thumbnail and the client falls back to the full image — the web app
 * always uploads JPEG, so that path is rare.
 *
 * EXIF orientation is not applied: the web client bakes rotation in when it
 * re-encodes the photo, so its uploads carry none.
 */
export function makeThumbnail(image: Buffer): Buffer | undefined {
  if (!isJpeg(image)) {
    return undefined;
  }

  const source = decode(image, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: MAX_RESOLUTION_MP,
    maxMemoryUsageInMB: MAX_MEMORY_MB,
  });

  const scale = Math.min(
    1,
    THUMBNAIL_EDGE / Math.max(source.width, source.height),
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const data = boxDownscale(source.data, source.width, source.height, {
    width,
    height,
  });

  return Buffer.from(encode({ data, width, height }, THUMBNAIL_QUALITY).data);
}

// Every JPEG starts with the SOI marker FF D8 followed by another marker.
function isJpeg(image: Buffer): boolean {
  return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
}

/**
 * Shrinks RGBA pixels by averaging each block of source pixels that lands on
 * one target pixel.
 *
 * Averaging, not picking one pixel per block: nearest-neighbour sampling at a
 * 5x reduction throws away 24 of every 25 pixels, which turns leaf veins and
 * fine texture into jagged noise. The average is what the eye would see.
 */
function boxDownscale(
  source: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  target: { width: number; height: number },
): Uint8Array {
  const output = new Uint8Array(target.width * target.height * 4);
  const xRatio = sourceWidth / target.width;
  const yRatio = sourceHeight / target.height;

  for (let y = 0; y < target.height; y++) {
    const top = Math.floor(y * yRatio);
    const bottom = Math.max(top + 1, Math.floor((y + 1) * yRatio));

    for (let x = 0; x < target.width; x++) {
      const left = Math.floor(x * xRatio);
      const right = Math.max(left + 1, Math.floor((x + 1) * xRatio));
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let sy = top; sy < bottom; sy++) {
        for (let sx = left; sx < right; sx++) {
          const index = (sy * sourceWidth + sx) * 4;
          red += source[index] ?? 0;
          green += source[index + 1] ?? 0;
          blue += source[index + 2] ?? 0;
          count++;
        }
      }

      const out = (y * target.width + x) * 4;
      output[out] = red / count;
      output[out + 1] = green / count;
      output[out + 2] = blue / count;
      output[out + 3] = 255;
    }
  }

  return output;
}
