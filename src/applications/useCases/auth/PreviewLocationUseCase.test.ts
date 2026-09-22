import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewLocationSchema } from "@/applications/schemas/auth";
import { PreviewLocationUseCase } from "@/applications/useCases/auth/PreviewLocationUseCase";
import type { Locale } from "@/shared/locale";
import type { Location } from "@/shared/types/plant";

function makeGeocoder(name?: string) {
  const asked: {
    location: Location;
    locale: Locale;
    intendedUse?: string | undefined;
  }[] = [];

  return {
    asked,
    describe: async (
      location: Location,
      locale: Locale,
      intendedUse?: string,
    ) => {
      asked.push({ location, locale, intendedUse });
      return name;
    },
  };
}

describe("PreviewLocationUseCase", () => {
  it("names the coordinate in the requested language", async () => {
    const geocoder = makeGeocoder("Boa Vista, Roraima, Brazil");

    const result = await new PreviewLocationUseCase(geocoder).execute(
      { latitude: 3.37, longitude: -59.83 },
      "pt-BR",
    );

    assert.deepEqual(result, { name: "Boa Vista, Roraima, Brazil" });
    assert.equal(geocoder.asked[0]?.locale, "pt-BR");
  });

  it("asks for SingleUse, because nothing is stored", async () => {
    const geocoder = makeGeocoder("Boa Vista, Roraima, Brazil");

    await new PreviewLocationUseCase(geocoder).execute(
      { latitude: 3.37, longitude: -59.83 },
      "en",
    );

    // Amazon Location's terms price and permit a displayed result differently
    // from one written to a database.
    assert.equal(geocoder.asked[0]?.intendedUse, "SingleUse");
  });

  it("answers null rather than failing when nothing is found", async () => {
    const result = await new PreviewLocationUseCase(makeGeocoder()).execute(
      { latitude: 0, longitude: 0 },
      "en",
    );

    // The client already handles a saved profile with no name; mid-ocean
    // coordinates take the same path instead of an error state.
    assert.deepEqual(result, { name: null });
  });

  it("previews the same rounded point that PATCH /me would store", () => {
    const parsed = previewLocationSchema.parse({
      latitude: 3.3712345,
      longitude: -59.8354321,
    });

    // Otherwise a user near a boundary could be shown one city, save, and get
    // a different one back.
    assert.deepEqual(parsed, { latitude: 3.37, longitude: -59.84 });
  });
});
