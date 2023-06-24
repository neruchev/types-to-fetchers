import axios, { AxiosError } from 'axios';
import { compile } from 'path-to-regexp';

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

export type Effect<Config extends BaseConfig, Error> = (
  action: Fetcher<Config, Error>
) => Fetcher<Config, Error>;

export type BaseConfig = {
  Body?: unknown;
  Querystring?: unknown;
  Params?: Record<string, string>;
  Headers?: unknown;
  Reply: unknown;
};

export type Options<Config extends BaseConfig, Error> = {
  baseURL: string;
  effect?: Effect<Config, Error>;
};

export type Input<API> = {
  [Endpoint in keyof API]: TuplifyUnion<keyof API[Endpoint]>;
};

export type Output<API> = {
  [Endpoint in keyof API]: {
    [Method in keyof API[Endpoint]]: Fetcher<
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      API[Endpoint][Method],
      Error
    >;
  };
};

export type Fetcher<Config extends BaseConfig, Error> = (
  data: Omit<Config, 'Reply' | 'Headers'>
) => Promise<Exclude<Config['Reply'], Error>>;

export const fetcher =
  <Config extends BaseConfig, Error>(
    baseURL: string,
    url: string,
    method: string
  ): Fetcher<Config, Error> =>
  async ({ Body, Querystring, Params }) => {
    try {
      const { data } = await axios({
        url: compile(url)(Params),
        method,
        baseURL,
        data: Body,
        params: Querystring,
        withCredentials: true,
      });

      return data;
    } catch (error) {
      const { response, message } = error as AxiosError<Error>;

      throw (response?.data as any)?.error ?? message ?? 'Unknown error';
    }
  };

export const makeApi = <API, Error, Effect = void>(
  schema: Input<API>,
  options: Options<BaseConfig, Error>
): Effect extends void ? Output<API> : Effect => {
  const result = schema as any;
  const { baseURL, effect } = options;

  for (const endpoint in result) {
    result[endpoint] = result[endpoint].reduce(
      (acc: Record<string, Fetcher<BaseConfig, Error>>, method: string) => {
        const handler = fetcher(baseURL, endpoint, method);
        acc[method] = effect ? effect(handler) : handler;

        return acc;
      },
      {}
    );
  }

  return result;
};
