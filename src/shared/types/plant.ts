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
  detectionId: string;
  plant: Plant[];
  timestamp: string;
}

export interface Detection {
  userId: string;
  detectionId: string;
  imageUrl: string;
  plants: Plant[];
  location?: { latitude: number; longitude: number } | undefined;
  createdAt: string;
}

export interface DetectionPage {
  items: Detection[];
  nextCursor?: string | undefined;
}
