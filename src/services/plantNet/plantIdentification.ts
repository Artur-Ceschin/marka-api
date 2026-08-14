import { Plant } from "@/domain/plant";

export class PlantIdentification {
  async identify(
    imageUrl: string,
    location?: { latitude: number; longitude: number },
  ): Promise<Plant[]> {
    const mockResults: Plant[] = [
      {
        species: "Rosa × damascena",
        confidence: 0.92,
        endemic: false,
        plantType: "shrubs",
      },
      {
        species: "Rosa gallica",
        confidence: 0.78,
        endemic: false,
        plantType: "shrubs",
      },
    ];

    console.log(
      `[PlantNet] Identified plants from ${imageUrl} at location`,
      location,
    );
    return mockResults;
  }
}

export const plantIdentification = new PlantIdentification();
