import { fetcher, makeApi } from '../src';
import axios from 'axios';

jest.mock('axios');
const mocked = jest.mocked(axios, { shallow: true });
mocked.mockReturnValue({ data: { foo: 'bar' } } as never);

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
    fetcher('', '/x', 'GET')({});

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x',
      withCredentials: true,
    });
  });

  test('Compiling a url with a format expression will return the compiled url', () => {
    fetcher('', '/x/:y', 'GET')({ Params: { y: 'z' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/x/z',
      withCredentials: true,
    });
  });

  test('The Body forwards correctly', () => {
    fetcher('', '/', 'POST')({ Body: { a: 'b' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'POST',
      url: '/',
      withCredentials: true,
      data: { a: 'b' },
    });
  });

  test('The Querystring forwards correctly', () => {
    fetcher('', '/', 'GET')({ Querystring: { a: 'b' } });

    expect(mocked).toHaveBeenCalledWith({
      baseURL: '',
      method: 'GET',
      url: '/',
      withCredentials: true,
      params: { a: 'b' },
    });
  });

  test('Response returned correctly', async () => {
    const response = await fetcher('', '/', 'GET')({});

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
    });
  });
});
