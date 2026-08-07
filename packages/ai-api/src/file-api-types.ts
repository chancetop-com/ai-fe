export interface FileApiOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface FileShareResponse {
  token: string;
  share_url: string;
}
