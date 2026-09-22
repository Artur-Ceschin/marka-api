import type { GeocodingGateway } from "@/infra/gateways/geocoding";
import type { Locale } from "@/shared/locale";
import type { Location } from "@/shared/types/plant";

type Geocoder = Pick<GeocodingGateway, "describe">;

/**
 * Names a coordinate for the UI to show before anything is saved.
 *
 * Stores nothing and reads nothing. Its whole job is to keep the AWS
 * credentials on the server: the browser could call a geocoder directly, but
 * that means an API key shipped to every visitor and every user's coordinates
 * handed to a third party from their own device.
 *
 * Two things make the preview honest rather than merely fast:
 *
 * The caller passes coordinates already through `homeLocationSchema`, so the
 * point named here is the same rounded point `PATCH /me` would store. Naming
 * the raw coordinate instead would be a real bug near a boundary — the user
 * would be shown one city, save, and see a different one come back.
 *
 * `SingleUse` rather than `Storage`: this result is rendered and discarded,
 * and Amazon Location's terms price and permit the two differently. Claiming
 * storage rights for a label nobody keeps would be wrong in the expensive
 * direction.
 *
 * Never fails. An unresolvable point answers `{ name: null }`, which is the
 * same thing the client already handles when a saved profile has no name.
 */
export class PreviewLocationUseCase {
  constructor(private geocoder: Geocoder) {}

  async execute(
    location: Location,
    locale: Locale,
  ): Promise<{ name: string | null }> {
    const name = await this.geocoder.describe(location, locale, "SingleUse");

    return { name: name ?? null };
  }
}
