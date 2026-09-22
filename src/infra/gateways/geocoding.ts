import {
  GeoPlacesClient,
  ReverseGeocodeCommand,
  type ReverseGeocodeIntendedUse,
} from "@aws-sdk/client-geo-places";
import { lazy } from "@/kernel/lazy";
import { env } from "@/shared/env";
import type { Locale } from "@/shared/locale";
import type { Location } from "@/shared/types/plant";

const client = lazy(() => new GeoPlacesClient({ region: env.AWS_REGION }));

// Amazon Location takes a BCP 47 tag. pt-BR is accepted as-is; en needs no
// region. Anything unsupported falls back to the local language of the place.
const LANGUAGE: Record<Locale, string> = {
  en: "en",
  "pt-BR": "pt-BR",
};

/**
 * Turns a stored home location into something worth showing a user.
 *
 * Two things are deliberate about the request:
 *
 * `QueryPosition` is `[longitude, latitude]` — GeoJSON order, the reverse of
 * how a `Location` stores it. Swapping these silently returns a plausible
 * place on the other side of the world rather than an error, so the mapping
 * happens here, once, and a test pins it.
 *
 * `Filter.IncludePlaceTypes: ["Locality"]` asks for a town or city, not a
 * street address. The coordinate was rounded to about 1.1 km before it was
 * stored, so a street-level answer would be inventing precision that was
 * thrown away on purpose — and it would put a user's street in a field the UI
 * renders in plain text.
 *
 * `IntendedUse` is not cosmetic: Amazon Location's terms distinguish a result
 * shown once from one written to a database. A preview that is rendered and
 * discarded is "SingleUse"; a name saved on the profile is "Storage". Callers
 * say which, and the default is the stricter one.
 *
 * Never throws. A failed lookup means the profile saves with coordinates and
 * no name, exactly like a thumbnail that could not be generated — losing the
 * label is not a reason to lose the user's edit.
 */
export class GeocodingGateway {
  async describe(
    location: Location,
    locale: Locale,
    intendedUse: ReverseGeocodeIntendedUse = "Storage",
  ): Promise<string | undefined> {
    try {
      const { ResultItems } = await client().send(
        new ReverseGeocodeCommand({
          QueryPosition: [location.longitude, location.latitude],
          Filter: { IncludePlaceTypes: ["Locality"] },
          MaxResults: 1,
          Language: LANGUAGE[locale],
          IntendedUse: intendedUse,
        }),
      );

      const [best] = ResultItems ?? [];

      if (!best) {
        return undefined;
      }

      // Label is the full formatted line ("Boa Vista, Roraima, Brazil");
      // Title is just the locality. Prefer the label, fall back to the title.
      return best.Address?.Label ?? best.Title;
    } catch (error) {
      console.error("[geocoding] reverse geocode failed", error);
      return undefined;
    }
  }
}
