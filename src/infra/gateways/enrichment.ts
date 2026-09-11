import OpenAI from "openai";
import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";
import type { PlantEnrichment } from "@/shared/types/plant";

const MODEL = "gpt-5-nano";

const ENRICHMENT_SCHEMA = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description: "Two or three sentences a non-botanist would find useful.",
    },
    care: {
      type: "string",
      description: "Light, water and soil in a few practical sentences.",
    },
    toxicity: {
      type: "string",
      description:
        "Whether it is toxic to humans, cats or dogs, and how. Say plainly if it is not toxic.",
    },
    nativeStatus: {
      type: "string",
      description:
        "Where it is native, and whether it is invasive near the given coordinates.",
    },
  },
  // strict mode requires every property listed and no extras.
  required: ["description", "care", "toxicity", "nativeStatus"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "You write plant care information for a plant identification app. " +
  "The species has already been confirmed by the user — do not question it " +
  "or suggest alternatives. Be concrete and practical. On toxicity, be " +
  "explicit about pets, and never guess: if you are not sure, say the user " +
  "should check with a vet or poison control.";

let client: OpenAI | undefined;

function openai(): OpenAI {
  client ??= new OpenAI();
  return client;
}

const FIXTURE: PlantEnrichment = {
  description: "Fixture enrichment — no OPENAI_API_KEY configured.",
  care: "Fixture care instructions.",
  toxicity: "Fixture toxicity information. Do not rely on this.",
  nativeStatus: "Fixture native status.",
};

export class PlantEnrichmentGateway {
  async enrich({
    species,
    image,
    location,
  }: {
    species: string;
    image: Buffer;
    location?: { latitude: number; longitude: number } | undefined;
  }): Promise<PlantEnrichment> {
    if (!env.OPENAI_API_KEY) {
      console.warn("[Enrichment] No API key set — returning fixture data");
      return FIXTURE;
    }

    const where = location
      ? `The photo was taken near ${location.latitude}, ${location.longitude}.`
      : "The location is unknown, so keep native and invasive status general.";

    try {
      const response = await openai().responses.create({
        model: MODEL,
        // Reasoning tokens bill as output tokens, and this task is recall and
        // formatting rather than reasoning — leaving effort unset would spend
        // the saving that picking nano was meant to make.
        reasoning: { effort: "minimal" },
        text: {
          format: {
            type: "json_schema",
            name: "plant_enrichment",
            schema: ENRICHMENT_SCHEMA,
            strict: true,
          },
        },
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `This plant has been identified as ${species}. ${where}`,
              },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${image.toString("base64")}`,
                detail: "auto",
              },
            ],
          },
        ],
      });

      return this.parse(response);
    } catch (error) {
      if (error instanceof OpenAI.RateLimitError) {
        throw new AppError(
          429,
          "TOO_MANY_REQUESTS",
          "Too busy right now. Try again shortly",
        );
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        502,
        "ENRICHMENT_FAILED",
        "Could not load plant details right now",
      );
    }
  }

  private parse(response: OpenAI.Responses.Response): PlantEnrichment {
    // A safety decline comes back as a refusal block on a 200, so it has to be
    // checked before trusting the text.
    const refused = response.output.some(
      (item) =>
        item.type === "message" &&
        item.content.some((block) => block.type === "refusal"),
    );

    if (refused) {
      throw new AppError(
        422,
        "ENRICHMENT_REFUSED",
        "Could not generate details for that plant",
      );
    }

    const text = response.output_text;

    if (!text) {
      throw new AppError(
        502,
        "ENRICHMENT_FAILED",
        "Could not load plant details right now",
      );
    }

    return JSON.parse(text) as PlantEnrichment;
  }
}

export const plantEnrichment = new PlantEnrichmentGateway();
