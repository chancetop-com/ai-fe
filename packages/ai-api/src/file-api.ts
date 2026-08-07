import { APIException, NetworkConnectionException } from './exception';
import { assertOkResponse } from './api-request';
import { FileApiOptions, FileShareResponse } from './file-api-types';
import { buildAuthHeaders, joinApiUrl, safeParse } from './utils';

export class FileApi {
  #baseUrl: string;
  #apiKey?: string;
  #fetch: typeof fetch;
  #headers: Record<string, string>;

  constructor(options: FileApiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? fetch.bind(globalThis);
    this.#headers = options.headers ?? {};
  }

  getFileContentUrl(fileId: string): string {
    return joinApiUrl(this.#baseUrl, `/api/files/${encodeURIComponent(fileId)}/content`);
  }

  async fetchFileBlob(source: { fileId?: string; contentUrl?: string }): Promise<Blob> {
    let url: string;
    const headers: Record<string, string> = { ...this.#headers };

    if (source.contentUrl) {
      url = source.contentUrl;
    } else if (source.fileId) {
      url = this.getFileContentUrl(source.fileId);
      Object.assign(headers, buildAuthHeaders(this.#apiKey, headers));
    } else {
      throw new Error('fileId or contentUrl is required');
    }

    let response: Response;
    try {
      response = await this.#fetch(url, { headers });
    } catch (error) {
      throw new NetworkConnectionException(
        `Failed to fetch file: ${url}`,
        url,
        error instanceof Error ? error.message : 'UNKNOWN'
      );
    }

    await assertOkResponse(response, url);
    return response.blob();
  }

  async share(fileId: string): Promise<FileShareResponse> {
    const url = joinApiUrl(this.#baseUrl, `/api/files/${encodeURIComponent(fileId)}/share`);
    const headers = buildAuthHeaders(this.#apiKey, {
      ...this.#headers,
      'Content-Type': 'application/json',
    });

    let response: Response;
    try {
      response = await this.#fetch(url, { method: 'POST', headers });
    } catch (error) {
      throw new NetworkConnectionException(
        `Failed to share file: ${url}`,
        url,
        error instanceof Error ? error.message : 'UNKNOWN'
      );
    }

    await assertOkResponse(response, url);

    const text = await response.text();
    const data = safeParse<FileShareResponse>(text);
    if (!data?.share_url) {
      throw new APIException('Invalid share response', response.status, url, data, null, 'invalid_json');
    }
    return data;
  }
}
