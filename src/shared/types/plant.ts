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

// Decided by the server so every client draws the same line; see certaintyOf.
export type Certainty = "high" | "low";

export interface Detection {
  userId: string;
  detectionId: string;
  imageKey: string;
  candidates: PlantCandidate[];
  certainty: Certainty;
  status: DetectionStatus;
  location?: { latitude: number; longitude: number } | undefined;
  createdAt: string;
  confirmedSpecies?: string | undefined;
  enrichment?: PlantEnrichment | undefined;
  confirmedAt?: string | undefined;
}

export interface DetectionPage<T = Detection> {
  items: T[];
  nextCursor?: string | undefined;
}

// What the API returns for a stored detection: the private key plus a
// short-lived URL the client can actually load.
export type DetectionView = Detection & { imageUrl: string };

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
  certainty: Certainty;
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
