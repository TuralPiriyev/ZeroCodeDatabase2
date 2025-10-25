import * as authController from '../src/controllers/authController';
import * as storage from '../src/services/storage';
import bcrypt from 'bcryptjs';

describe('auth controller', () => {
  beforeAll(async () => {
    // seed a test admin
    const hash = await bcrypt.hash('testpass', 10);
    try { storage.addAdmin('testadmin', hash, 'admin'); } catch (e) {}
  });

  test('login rejects missing fields', async () => {
    const req: any = { body: {} };
    const res: any = { status: jest.fn(() => res), json: jest.fn() };
    await authController.login(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
