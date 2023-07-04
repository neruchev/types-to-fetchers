import { fetcher, makeApi } from '../src';
import axios from 'axios';

jest.mock('axios');
const mocked = jest.mocked(axios, { shallow: true });
mocked.mockResolvedValue({ data: { foo: 'bar' } } as never);

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
    expect(typeof fetcher('', '', '', new AbortController().signal)).toBe(
      'function'
    );
    expect(
      typeof fetcher(
        'https://example.com',
        '/',
        'GET',
        new AbortController().signal
      )
    ).toBe('function');
  });

  test("Url without format expression won't compile", () => {
    const abortController = new AbortController();

    fetcher('', '/x', 'GET', abortController.signal)({});

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x',
      withCredentials: true,
      signal: abortController.signal,
    });
  });

  test('Compiling a url with a format expression will return the compiled url', () => {
    const abortController = new AbortController();

    fetcher('', '/x/:y', 'GET', abortController.signal)({ Params: { y: 'z' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x/z',
      withCredentials: true,
      signal: abortController.signal,
    });
  });

  test('The Body forwards correctly', () => {
    const abortController = new AbortController();

    fetcher('', '/', 'POST', abortController.signal)({ Body: { a: 'b' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'POST',
      url: '/',
      withCredentials: true,
      data: { a: 'b' },
      signal: abortController.signal,
    });
  });

  test('The Querystring forwards correctly', () => {
    const abortController = new AbortController();

    fetcher(
      '',
      '/',
      'GET',
      abortController.signal
    )({ Querystring: { a: 'b' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/',
      withCredentials: true,
      params: { a: 'b' },
      signal: abortController.signal,
    });
  });

  test('Response returned correctly', async () => {
    const response = await fetcher(
      '',
      '/',
      'GET',
      new AbortController().signal
    )({});

    expect(response).toEqual({ foo: 'bar' });
  });

  test('Signal exist, work correctly', async () => {
    const controller = new AbortController();

    const response = await fetcher('', '/', 'GET', controller.signal)({});

    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      })
    );

    expect(response).toEqual({ foo: 'bar' });
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
        effect: (_, params) => params as never,
      }
    );

    expect(api).toMatchSnapshot();
  });

  test('The baseURL forwards correctly', () => {
    const api = makeApi<API, {}>(
      {
        '/': ['GET'],
        '/foo/:bar': ['GET', 'POST'],
      },
      { baseURL: 'hrrps://api.mysite.com/' }
    );

    api['/'].GET({});

    expect(mocked).toHaveBeenCalledWith({
      baseURL: 'hrrps://api.mysite.com/',
      method: 'GET',
      url: '/',
      withCredentials: true,
      signal: expect.any(AbortSignal),
    });
  });

  test('The api has abort function', () => {
    const api = makeApi<API, {}>(
      {
        '/': ['GET'],
        '/foo/:bar': ['GET', 'POST'],
      },
      { baseURL: 'hrrps://api.mysite.com/' }
    );

    api['/'].GET({});
    api['/'].GET.abort();

    Object.values(api).forEach((endpoint) => {
      Object.values(endpoint).forEach((properties) => {
        console.log(properties);
        expect(properties).toHaveProperty('abort');
        expect(typeof properties.abort).toBe('function');
      });
    });
  });
});
