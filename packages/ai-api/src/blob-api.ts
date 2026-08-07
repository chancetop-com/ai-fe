import { APIException, NetworkConnectionException } from './exception';
import { assertOkResponse } from './api-request';
import { BlobApiOptions, BlobUploadCategory, BlobUploadCredential } from './blob-api-types';
import { buildAuthHeaders, joinApiUrl, safeParse } from './utils';

export class BlobApi {
  #baseUrl: string;
  #apiKey?: string;
  #fetch: typeof fetch;
  #headers: Record<string, string>;

  constructor(options: BlobApiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch.bind(globalThis);
    this.#headers = options.headers ?? {};
  }

  async getUploadCredential(contentType: string, category: BlobUploadCategory): Promise<BlobUploadCredential> {
    const params = new URLSearchParams({
      content_type: contentType,
      category,
    });
    const url = joinApiUrl(this.#baseUrl, `/api/blob/upload-credential?${params}`);
    const headers = buildAuthHeaders(this.#apiKey, this.#headers);

    let response: Response;
    try {
      response = await this.#fetch(url, { method: 'GET', headers });
    } catch (error) {
      throw new NetworkConnectionException(
        `Failed to request: ${url}`,
        url,
        error instanceof Error ? error.message : 'UNKNOWN'
      );
    }

    await assertOkResponse(response, url);

    const text = await response.text();
    const data = safeParse<BlobUploadCredential>(text);
    if (!data?.upload_url || !data.blob_url) {
      throw new APIException('Invalid credential response', response.status, url, data, null, 'invalid_json');
    }
    return data;
  }

  async uploadFile(credential: BlobUploadCredential, file: Blob, contentType: string): Promise<void> {
    let response: Response;
    try {
      response = await this.#fetch(credential.upload_url, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'x-ms-blob-content-type': contentType,
        },
        body: file,
      });
    } catch (error) {
      throw new NetworkConnectionException(
        'Failed to upload blob',
        credential.upload_url,
        error instanceof Error ? error.message : 'UNKNOWN'
      );
    }

    await assertOkResponse(response, credential.upload_url);
  }
}
