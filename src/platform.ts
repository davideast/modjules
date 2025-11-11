export interface Platform {
  saveFile(filepath: string, data: string, encoding: 'base64'): Promise<void>;
  sleep(ms: number): Promise<void>;
}
