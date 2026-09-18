import type { Locale } from "@/shared/locale";

// Mirrors what PlantNet actually returns. The previous shape invented
// `endemic` and `plantType`, which the API does not provide.
export interface PlantCandidate {
  species: string;
  scientificName: string;
  commonNames: string[];
  family: string;
  genus: string;
  confidence: number;
  images: CandidateImage[];
}

// A PlantNet reference photo of the species, so the user can compare it with
// their plant. Hotlinked from PlantNet and mostly CC BY-SA, which requires
// crediting the author wherever it is shown.
export interface CandidateImage {
  url: string;
  organ?: string | undefined;
  author?: string | undefined;
  license?: string | undefined;
}

export interface PlantEnrichment {
  description: string;
  care: string;
  toxicity: string;
  nativeStatus: string;
}

// Only a chosen species is ever stored, so every detection is confirmed. Kept
// as a field so the response shape clients already parse does not change.
export type DetectionStatus = "confirmed";

// Decided by the server so every client draws the same line; see certaintyOf.
export type Certainty = "high" | "low";

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number | undefined;
}

export interface Detection {
  userId: string;
  detectionId: string;
  imageKey: string;
  thumbnailKey?: string | undefined;
  candidates: PlantCandidate[];
  certainty: Certainty;
  status: DetectionStatus;
  location?: Location | undefined;
  // When the plant was seen. For a gallery photo that can be long before
  // createdAt, which is when it was identified.
  observedAt?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
  confirmedSpecies?: string | undefined;
  enrichment?: PlantEnrichment | undefined;
  confirmedAt?: string | undefined;
  // The language the enrichment was written in, fixed when the species was
  // saved. Absent on rows saved before languages existed, which are English.
  locale?: Locale | undefined;
}

export interface DetectionKey {
  userId: string;
  detectionId: string;
}

// What a user may edit after identification. null removes a value; an absent
// key leaves it as it is.
export interface DetectionChanges {
  notes?: string | null | undefined;
  observedAt?: string | null | undefined;
  location?: Location | null | undefined;
}

export interface DetectionPage<T = Detection> {
  items: T[];
  nextCursor?: string | undefined;
}

// What the API returns for a stored detection: the private key plus a
// short-lived URL the client can actually load.
export type DetectionView = Detection & {
  imageUrl: string;
  thumbnailUrl?: string | undefined;
};

export interface IdentifyPlantRequest {
  key: string;
  location?: Location | undefined;
  observedAt?: string | undefined;
  locale: Locale;
}

export interface DailyQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface IdentifyPlantResponse {
  success: boolean;
  // Signed proof of this result, sent back to POST /detections. It replaces
  // the pending row /identify used to store.
  identificationToken: string;
  expiresIn: number;
  candidates: PlantCandidate[];
  certainty: Certainty;
  timestamp: string;
  // Returned so the client can show "3 identifications left today" without a
  // second request.
  quota: DailyQuota;
}

export type ConfirmDetectionResponse = DetectionView & { success: true };
