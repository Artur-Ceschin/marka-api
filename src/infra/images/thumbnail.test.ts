import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decode, encode } from "jpeg-js";
import { makeThumbnail, THUMBNAIL_EDGE } from "@/infra/images/thumbnail";

function jpeg(width: number, height: number, rgb = [40, 120, 60]): Buffer {
  const data = new Uint8Array(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0] ?? 0;
    data[i + 1] = rgb[1] ?? 0;
    data[i + 2] = rgb[2] ?? 0;
    data[i + 3] = 255;
  }

  return Buffer.from(encode({ data, width, height }, 90).data);
}

describe("makeThumbnail", () => {
  it("shrinks the long edge to the thumbnail size, keeping the aspect ratio", () => {
    const thumbnail = makeThumbnail(jpeg(1536, 768));

    assert.ok(thumbnail);
    const { width, height } = decode(thumbnail, { useTArray: true });
    assert.equal(width, THUMBNAIL_EDGE);
    assert.equal(height, THUMBNAIL_EDGE / 2);
  });

  it("keeps the colours of the photo", () => {
    // Averaging a solid block must give back the same colour, give or take
    // JPEG's own rounding.
    const thumbnail = makeThumbnail(jpeg(1000, 1000, [200, 30, 90]));

    assert.ok(thumbnail);
    const { data } = decode(thumbnail, { useTArray: true });
    assert.ok(Math.abs((data[0] ?? 0) - 200) <= 4);
    assert.ok(Math.abs((data[1] ?? 0) - 30) <= 4);
    assert.ok(Math.abs((data[2] ?? 0) - 90) <= 4);
  });

  it("never enlarges a photo that is already small", () => {
    const thumbnail = makeThumbnail(jpeg(200, 100));

    assert.ok(thumbnail);
    assert.equal(decode(thumbnail, { useTArray: true }).width, 200);
  });

  it("is much smaller than the photo it came from", () => {
    const photo = jpeg(1536, 1152);

    const thumbnail = makeThumbnail(photo);

    assert.ok(thumbnail);
    assert.ok(thumbnail.length < photo.length);
  });

  it("returns nothing for a non-JPEG, so the full image is used instead", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    assert.equal(makeThumbnail(png), undefined);
  });
});
