export class PlantBucket {
  async upload(imageData: Buffer): Promise<string> {
    const mockKey = `plants/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const mockUrl = `https://marka-plants.s3.amazonaws.com/${mockKey}`;

    console.log(`[S3] Uploaded ${imageData.byteLength} bytes to ${mockUrl}`);
    return mockUrl;
  }
}

export const plantBucket = new PlantBucket();
