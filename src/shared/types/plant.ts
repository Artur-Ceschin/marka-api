// Mirrors what PlantNet actually returns. The previous shape invented
// `endemic` and `plantType`, which the API does not provide.
export interface PlantCandidate {
  species: string;
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  confidence: number;
}

export interface PlantEnrichment {
  description: string;
  care: string;
  toxicity: string;
  nativeStatus: string;
}

export type DetectionStatus = "pending_confirmation" | "confirmed" | "rejected";

export interface Detection {
  userId: string;
  detectionId: string;
  imageUrl: string;
  candidates: PlantCandidate[];
  status: DetectionStatus;
  location?: { latitude: number; longitude: number } | undefined;
  createdAt: string;
  // Written only once the user picks a species — enrichment is generated
  // against a confirmed identification, never a guess.
  confirmedSpecies?: string | undefined;
  enrichment?: PlantEnrichment | undefined;
  confirmedAt?: string | undefined;
}

export interface DetectionPage {
  items: Detection[];
  nextCursor?: string | undefined;
}

export interface IdentifyPlantRequest {
  key: string;
  location?: { latitude: number; longitude: number } | undefined;
}

export interface DailyQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface IdentifyPlantResponse {
  success: boolean;
  detectionId: string;
  candidates: PlantCandidate[];
  status: DetectionStatus;
  timestamp: string;
  // Returned so the client can show "3 identifications left today" without a
  // second request.
  quota: DailyQuota;
}

export interface ConfirmDetectionResponse {
  success: boolean;
  detectionId: string;
  species: string;
  enrichment: PlantEnrichment;
  status: DetectionStatus;
}
