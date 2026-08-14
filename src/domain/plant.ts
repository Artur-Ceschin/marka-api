export interface Plant {
  species: string;
  confidence: number;
  endemic: boolean;
  plantType:
    | "trees"
    | "shrubs"
    | "herbs"
    | "climbers"
    | "creepers"
    | "ferns"
    | "mosses"
    | "fungi";
}

export interface IdentifyPlantRequest {
  imageData: Buffer;
  location?:
    | {
        latitude: number;
        longitude: number;
      }
    | undefined;
}

export interface IdentifyPlantResponse {
  success: boolean;
  plant: Plant[];
  timestamp: string;
}
