import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";
import type { Locale } from "@/shared/locale";
import type { PlantCandidate } from "@/shared/types/plant";

const BASE_URL = "https://my-api.plantnet.org/v2/identify";

// Past the top few, scores are near zero and only clutter the choice. Capping
// also keeps the identification token, which carries the candidates, small.
const MAX_RESULTS = 5;
const MAX_IMAGES_PER_CANDIDATE = 3;

// PlantNet's codes, from its /v2/languages route. It lists pt-br separately
// from pt, so Brazilian common names are available rather than European ones.
const PLANTNET_LANG: Record<Locale, string> = { en: "en", "pt-BR": "pt-br" };

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
  // Only with include-related-images=true. Not in PlantNet's published
  // reference, so every field is optional and read defensively: a shape
  // change costs the thumbnails, never the identification.
  images?: {
    organ?: string;
    author?: string;
    license?: string;
    url?: { o?: string; m?: string; s?: string };
  }[];
}

const FIXTURE: PlantCandidate[] = [
  {
    species: "Rosa × damascena",
    scientificName: "Rosa × damascena Herrm.",
    commonNames: ["Damask rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.92,
    images: [],
  },
  {
    species: "Rosa gallica",
    scientificName: "Rosa gallica L.",
    commonNames: ["French rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.78,
    images: [],
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
  async identify(image: Buffer, locale: Locale): Promise<PlantCandidate[]> {
    if (!env.PLANTNET_API_KEY) {
      console.warn("[PlantNet] No API key set — returning fixture data");
      return FIXTURE;
    }

    const form = new FormData();
    form.append(
      "images",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "plant.jpg",
    );
    form.append("organs", "auto");

    // PLANTNET_PROJECT is the regional lever — "weurope", "canada", etc.
    // instead of "all".
    const url = new URL(`${BASE_URL}/${env.PLANTNET_PROJECT}`);
    url.searchParams.set("api-key", env.PLANTNET_API_KEY);
    url.searchParams.set("nb-results", String(MAX_RESULTS));
    url.searchParams.set("include-related-images", "true");
    // Changes common names only; scientific names are the same in every language.
    url.searchParams.set("lang", PLANTNET_LANG[locale]);

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
      images: (result.images ?? [])
        .slice(0, MAX_IMAGES_PER_CANDIDATE)
        .flatMap((image) => {
          // Medium size: large enough for a thumbnail on a high-DPI screen
          // without loading PlantNet's originals.
          const url = image.url?.m ?? image.url?.s ?? image.url?.o;

          return url
            ? [
                {
                  url,
                  organ: image.organ,
                  author: image.author,
                  license: image.license,
                },
              ]
            : [];
        }),
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
