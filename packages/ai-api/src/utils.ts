import { BaseRequestOption, RequestOptions } from './types';

export function safeParse<T = any>(data: string): T | null {
  try {
    return parseWithDate(data);
  } catch (e) {
    return null;
  }
}

/**
 * If an ISO format date (2018-05-24T12:00:00.123Z) appears in the JSON, it will be transformed to JS Date type.
 */
export function parseWithDate(data: string) {
  const ISO_DATE_FORMAT =
    /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-][01]\d:[0-5]\d)$/;
  return JSON.parse(data, (key: any, value: any) => {
    if (typeof value === 'string' && ISO_DATE_FORMAT.test(value)) {
      return new Date(value);
    }
    return value;
  });
}

export function mergeRequestOptions<T extends any>(
  baseRequestOptions: BaseRequestOption,
  requestOptions: RequestOptions<T>
) {
  const { baseUrl } = baseRequestOptions;
  const { url, pathParams, ...restOptions } = requestOptions;
  return {
    url: normalizeUrl(baseUrl, url, pathParams),
    ...restOptions,
  } as RequestOptions<T>;
}

function normalizeUrl(
  baseUrl: string = '',
  url: string = '',
  pathParams: Record<string, string> = {}
) {
  return url.startsWith('http') || url.startsWith('https')
    ? urlParams(url, pathParams)
    : baseUrl + urlParams(url, pathParams);
}

export function urlParams(pattern: string, params: object): string {
  if (!params) {
    return pattern;
  }
  let url = pattern;
  Object.entries(params).forEach(([name, value]) => {
    const encodedValue = encodeURIComponent(value.toString());
    url = url.replace(':' + name, encodedValue);
  });
  return url;
}

export const defaultRetryTimes = 3;
