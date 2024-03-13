import axios, { AxiosError } from 'axios';
import { compile } from 'path-to-regexp';

export type Payload = {
  Body?: unknown;
  Querystring?: unknown;
  Params?: Record<string, string>;
  Headers?: unknown;
  Reply: unknown;
};

export type AxiosOptions = {
  Axios?: {
    signal?: AbortSignal;
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
    onDownloadProgress?: (progressEvent: ProgressEvent) => void;
  };
};

export type Options<Config extends Payload, Error> = {
  baseURL: string;
  effect?: Effect<Config, Error>;
  paramsSerializer?: (params: any) => string;
};

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;

export type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false
> = true extends N ? [] : [...TuplifyUnion<Exclude<T, L>>, L];

export type Effect<Config extends Payload, Error> = (
  action: Fetcher<Config, Error>,
  params: Omit<Options<Config, Error>, 'effect'> & {
    endpoint: string;
    method: string;
  }
) => Fetcher<Config, Error>;

export type Schema<API> = {
  [Endpoint in keyof API]: TuplifyUnion<keyof API[Endpoint]>;
};

export type Methods<MethodsRecord extends object, Error> = {
  [Method in keyof MethodsRecord]: Fetcher<MethodsRecord[Method], Error>;
};

export type Endpoints<EndpointsRecord extends object, Error> = {
  [Endpoint in keyof EndpointsRecord]: Methods<
    EndpointsRecord[Endpoint],
    Error
  >;
};

export type Fetcher<Config extends Payload, Error> = (
  data: Omit<Config, 'Reply'> & AxiosOptions
) => Promise<Exclude<Config['Reply'], Error>>;

export const fetcher =
  <Config extends Payload, Error>(
    baseURL: string,
    url: string,
    method: string,
    paramsSerializer?: Options<Config, Error>['paramsSerializer']
  ): Fetcher<Config, Error> =>
  async ({ Body, Querystring, Params, Headers, Axios } = {} as never) => {
    try {
      const { data } = await axios({
        url: compile(url, { encode: encodeURIComponent })(Params),
        method,
        baseURL,
        data: Body,
        params: Querystring,
        withCredentials: true,
        signal: Axios?.signal,
        headers: Headers as any,
        onUploadProgress: Axios?.onUploadProgress,
        onDownloadProgress: Axios?.onDownloadProgress,
        paramsSerializer,
      });

      return data;
    } catch (error) {
      const { response, message } = error as AxiosError<Error>;

      throw (response?.data as any)?.error ?? message ?? 'Unknown error';
    }
  };

export const makeApi = <API extends object, Error, Effect = void>(
  schema: Schema<API>,
  options: Options<Payload, Error>
): Effect extends void ? Endpoints<API, Error> : Effect => {
  const result = schema as any;
  const { baseURL, effect, paramsSerializer } = options;

  for (const endpoint in result) {
    result[endpoint] = result[endpoint].reduce(
      (acc: Record<string, Fetcher<Payload, Error>>, method: string) => {
        const handler = fetcher(baseURL, endpoint, method, paramsSerializer);

        acc[method] = effect
          ? effect(handler, { endpoint, method, baseURL, paramsSerializer })
          : handler;

        return acc;
      },
      {}
    );
  }

  return result;
};
