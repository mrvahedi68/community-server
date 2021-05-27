import type { Server } from 'http';
import request from 'supertest';
import type { BaseHttpServerOptions } from '../../../src/server/BaseHttpServerFactory';
import { BaseHttpServerFactory } from '../../../src/server/BaseHttpServerFactory';
import type { HttpHandler } from '../../../src/server/HttpHandler';
import type { HttpResponse } from '../../../src/server/HttpResponse';
import { joinFilePath } from '../../../src/util/PathUtil';
import { getPort } from '../../util/Util';

const port = getPort('BaseHttpServerFactory');

const handler: jest.Mocked<HttpHandler> = {
  handleSafe: jest.fn(async(input: { response: HttpResponse }): Promise<void> => {
    input.response.writeHead(200);
    input.response.end();
  }),
} as any;

describe('A BaseHttpServerFactory', (): void => {
  let server: Server;

  const options: [string, BaseHttpServerOptions | undefined][] = [
    [ 'http', undefined ],
    [ 'https', {
      https: true,
      key: joinFilePath(__dirname, '../../assets/https/server.key'),
      cert: joinFilePath(__dirname, '../../assets/https/server.cert'),
    }],
  ];

  describe.each(options)('with %s', (protocol, httpOptions): void => {
    let rejectTls: string | undefined;
    beforeAll(async(): Promise<void> => {
      // Allow self-signed certificate
      rejectTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      const factory = new BaseHttpServerFactory(handler, httpOptions);
      server = factory.startServer(port);
    });

    beforeEach(async(): Promise<void> => {
      jest.clearAllMocks();
    });

    afterAll(async(): Promise<void> => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = rejectTls;
      server.close();
    });

    it('sends incoming requests to the handler.', async(): Promise<void> => {
      await request(server).get('/').set('Host', 'test.com').expect(200);

      expect(handler.handleSafe).toHaveBeenCalledTimes(1);
      expect(handler.handleSafe).toHaveBeenLastCalledWith({
        request: expect.objectContaining({
          headers: expect.objectContaining({ host: 'test.com' }),
        }),
        response: expect.objectContaining({}),
      });
    });

    it('returns a 404 when the handler does not do anything.', async(): Promise<void> => {
      handler.handleSafe.mockResolvedValueOnce(undefined);

      await expect(request(server).get('/').expect(404)).resolves.toBeDefined();
    });

    it('writes an error to the HTTP response.', async(): Promise<void> => {
      handler.handleSafe.mockRejectedValueOnce(new Error('dummyError'));

      const res = await request(server).get('/').expect(500);
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(res.text).toContain('dummyError');
    });

    it('does not write an error if the response had been started.', async(): Promise<void> => {
      handler.handleSafe.mockImplementationOnce(async(input: { response: HttpResponse }): Promise<void> => {
        input.response.write('content');
        throw new Error('dummyError');
      });

      const res = await request(server).get('/');
      expect(res.text).not.toContain('dummyError');
    });

    it('throws unknown errors if its handler throw non-Error objects.', async(): Promise<void> => {
      handler.handleSafe.mockRejectedValueOnce('apple');

      const res = await request(server).get('/').expect(500);
      expect(res.text).toContain('Unknown error.');
    });
  });
});
