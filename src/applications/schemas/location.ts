import z from "zod";

// Both or neither: a latitude without a longitude is not a location.
export const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().positive().max(100_000).optional(),
});

// ~1.1 km at the equator. Enough for the one thing location is used for —
// enrichment's native/invasive answer, which is regional — and coarse enough
// that the stored point is a neighbourhood rather than a doorstep.
const HOME_PRECISION = 2;

const round = (value: number) => Number(value.toFixed(HOME_PRECISION));

/**
 * A home location, rounded before it is ever written.
 *
 * Detections round on the client by convention; a home location is rounded
 * here instead, because it is the one coordinate stored indefinitely and it
 * points at where the user lives. A client that forgets to round should not be
 * able to persist a doorstep, so this does not trust it to.
 *
 * `accuracy` is dropped: it describes a GPS reading, and a saved home is a
 * place the user chose, so there is no reading to describe.
 */
export const homeLocationSchema = locationSchema.transform(
  ({ latitude, longitude }) => ({
    latitude: round(latitude),
    longitude: round(longitude),
  }),
);
