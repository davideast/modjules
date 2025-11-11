export interface Platform {
  saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string,
  ): Promise<void>;
  sleep(ms: number): Promise<void>;
  createDataUrl(data: string, mimeType: string): string;
}
