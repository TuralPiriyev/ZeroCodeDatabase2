import { requireAdmin } from '../src/middleware/auth';

describe('auth middleware', () => {
  test('rejects when no token or api key provided', () => {
    const req: any = { headers: {}, query: {}, cookies: {} };
    const res: any = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();
    requireAdmin(req, res, next as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
