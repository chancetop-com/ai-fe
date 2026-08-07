export interface BlobUploadCredential {
  upload_url: string;
  blob_url: string;
  container: string;
  blob_name: string;
  expires_at?: string;
}

export type BlobUploadCategory = 'multimodal' | 'sandbox';

export interface BlobApiOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}
