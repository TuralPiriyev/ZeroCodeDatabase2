import { encrypt, decrypt } from '../src/utils/crypto';

describe('crypto encrypt/decrypt', () => {
  const origKey = process.env.MASTER_ENCRYPTION_KEY;
  beforeAll(() => {
    // set a 32-byte base64 key for tests
    process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
  });
  afterAll(() => { process.env.MASTER_ENCRYPTION_KEY = origKey; });

  test('encrypt/decrypt roundtrip', async () => {
    const s = 'super-secret-password-123!';
    const enc = await encrypt(s);
    expect(enc).not.toBe(s);
    const dec = await decrypt(enc);
    expect(dec).toBe(s);
  });
});
