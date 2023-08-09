import { fetcher, makeApi } from '../src';
import axios from 'axios';

jest.mock('axios');
const mocked = jest.mocked(axios, { shallow: true });

mocked.mockImplementation((config: any) => {
  if (config?.onUploadProgress) {
    config.onUploadProgress({ loaded: 50, total: 100 });
  }
  if (config?.onDownloadProgress) {
    config.onDownloadProgress({ loaded: 50, total: 100 });
  }

  return Promise.resolve({ data: { foo: 'bar' } }) as never;
});

interface API {
  '/': {
    GET: {
      Reply: {
        version: string;
        mode: 'production' | 'development';
      };
    };
  };
  '/foo/:bar': {
    GET: {
      Params: { bar: string };
      Reply: string;
    };
    POST: {
      Params: { bar: string };
      Body: { baz: string };
      Reply: Error | string;
    };
  };
}

describe('Fetcher', () => {
  test('Fetcher call returns a function', () => {
    expect(typeof fetcher('', '', '')).toBe('function');
    expect(typeof fetcher('https://example.com', '/', 'GET')).toBe('function');
  });

  test("Url without format expression won't compile", () => {
    const { signal } = new AbortController();

    fetcher('', '/x', 'GET')({ Axios: { signal } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x',
      withCredentials: true,
      signal,
    });
  });

  test('Compiling a url with a format expression will return the compiled url', () => {
    const { signal } = new AbortController();

    fetcher('', '/x/:y', 'GET')({ Params: { y: 'z' }, Axios: { signal } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x/z',
      withCredentials: true,
      signal,
    });
  });

  test('The Body forwards correctly', () => {
    const { signal } = new AbortController();

    fetcher('', '/', 'POST')({ Body: { a: 'b' }, Axios: { signal } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'POST',
      url: '/',
      withCredentials: true,
      data: { a: 'b' },
      signal,
    });
  });

  test('The Querystring forwards correctly', () => {
    const { signal } = new AbortController();

    fetcher('', '/', 'GET')({ Querystring: { a: 'b' }, Axios: { signal } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/',
      withCredentials: true,
      params: { a: 'b' },
      signal,
    });
  });

  test('Response returned correctly', async () => {
    const { signal } = new AbortController();

    const response = await fetcher('', '/', 'GET')({ Axios: { signal } });

    expect(response).toEqual({ foo: 'bar' });
  });

  test('Signal exist, work correctly', async () => {
    const { signal } = new AbortController();

    const response = await fetcher('', '/', 'GET')({ Axios: { signal } });

    expect(axios).toHaveBeenCalledWith(expect.objectContaining({ signal }));
    expect(response).toEqual({ foo: 'bar' });
  });

  test('onUploadProgress is called during upload', async () => {
    const onUploadProgressMock = jest.fn();

    await fetcher(
      'https://example.com',
      '/upload',
      'POST'
    )({
      Body: { some: 'data' },
      Axios: { onUploadProgress: onUploadProgressMock },
    });

    expect(onUploadProgressMock).toHaveBeenCalled();
  });

  test('onDownloadProgress is called during download', async () => {
    const onDownloadProgressMock = jest.fn();

    await fetcher(
      'https://example.com',
      '/download',
      'GET'
    )({
      Axios: { onDownloadProgress: onDownloadProgressMock },
    });

    expect(onDownloadProgressMock).toHaveBeenCalled();
  });
});

describe('Make API', () => {
  test('The generator output snapshot is correctly', () => {
    const api = makeApi<API, {}>(
      {
        '/': ['GET'],
        '/foo/:bar': ['GET', 'POST'],
      },
      { baseURL: '/x' }
    );

    expect(api).toMatchSnapshot();
  });

  test('The effect forwards correctly', async () => {
    const api = makeApi<API, {}>(
      {
        '/': ['GET'],
        '/foo/:bar': ['GET', 'POST'],
      },
      {
        baseURL: 'hrrps://api.mysite.com/',
        effect: (_, params) => ({ params } as never),
      }
    );

    expect(api).toMatchSnapshot();
  });

  test('The baseURL forwards correctly', () => {
    const { signal } = new AbortController();

    const api = makeApi<API, {}>(
      {
        '/': ['GET'],
        '/foo/:bar': ['GET', 'POST'],
      },
      { baseURL: 'hrrps://api.mysite.com/' }
    );

    api['/'].GET({ Axios: { signal } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: 'hrrps://api.mysite.com/',
      method: 'GET',
      url: '/',
      withCredentials: true,
      signal,
    });
  });
});
