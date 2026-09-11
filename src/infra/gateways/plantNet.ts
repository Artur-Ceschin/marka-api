import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";
import type { PlantCandidate } from "@/shared/types/plant";

const BASE_URL = "https://my-api.plantnet.org/v2/identify";

// The subset of PlantNet's response we depend on. Declared rather than
// trusted so a shape change surfaces here instead of downstream.
interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    scientificName: string;
    commonNames?: string[];
    family?: { scientificNameWithoutAuthor?: string };
    genus?: { scientificName?: string };
  };
}

const FIXTURE: PlantCandidate[] = [
  {
    species: "Rosa × damascena",
    scientificName: "Rosa × damascena Herrm.",
    commonNames: ["Damask rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.92,
  },
  {
    species: "Rosa gallica",
    scientificName: "Rosa gallica L.",
    commonNames: ["French rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.78,
  },
];

export class PlantIdentification {
  /**
   * PlantNet takes the image bytes, not a URL, so the caller reads the object
   * from S3 first. Results come back ordered by descending score.
   *
   * Without an API key this returns a fixture so the rest of the flow is
   * exercisable locally — it logs loudly, because silently serving fake
   * species data is the kind of thing that reaches production.
   */
  async identify(
    image: Buffer,
    location?: { latitude: number; longitude: number },
  ): Promise<PlantCandidate[]> {
    if (!env.PLANTNET_API_KEY) {
      console.warn("[PlantNet] No API key set — returning fixture data");
      return FIXTURE;
    }

    const form = new FormData();
    form.append("images", new Blob([new Uint8Array(image)]), "plant.jpg");
    form.append("organs", "auto");

    const url = new URL(`${BASE_URL}/${env.PLANTNET_PROJECT}`);
    url.searchParams.set("api-key", env.PLANTNET_API_KEY);
    // PlantNet uses coordinates to weight regionally plausible species.
    if (location) {
      url.searchParams.set("lat", String(location.latitude));
      url.searchParams.set("lon", String(location.longitude));
    }

    const response = await fetch(url, { method: "POST", body: form });

    if (!response.ok) {
      throw this.toAppError(response.status);
    }

    const body = (await response.json()) as { results?: PlantNetResult[] };

    return (body.results ?? []).map((result) => ({
      species: result.species.scientificNameWithoutAuthor,
      scientificName: result.species.scientificName,
      commonNames: result.species.commonNames ?? [],
      family: result.species.family?.scientificNameWithoutAuthor ?? "",
      genus: result.species.genus?.scientificName ?? "",
      confidence: result.score,
    }));
  }

  private toAppError(status: number): AppError {
    // 404 is PlantNet's "nothing matched", not a missing endpoint.
    if (status === 404) {
      return new AppError(
        422,
        "NO_MATCH",
        "No plant could be identified in that photo. Try a clearer shot of the leaves or flower",
      );
    }

    if (status === 429) {
      return new AppError(
        429,
        "TOO_MANY_REQUESTS",
        "Identification is busy right now. Try again shortly",
      );
    }

    if (status === 400 || status === 413) {
      return new AppError(
        400,
        "INVALID_IMAGE",
        "That image could not be processed. Use a JPEG or PNG under 50MB",
      );
    }

    // 401/403 mean our key is wrong — our problem, so a 500.
    return new AppError(
      502,
      "IDENTIFICATION_FAILED",
      "Plant identification is unavailable right now",
    );
  }
}

export const plantIdentification = new PlantIdentification();
