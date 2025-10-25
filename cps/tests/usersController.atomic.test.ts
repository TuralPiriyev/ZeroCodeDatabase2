import * as storage from '../src/services/storage';
import * as usersController from '../src/controllers/usersController';
import { encrypt } from '../src/utils/crypto';

jest.mock('../src/services/provisioning/mysql', () => ({
  provisionMySQLUser: jest.fn(async () => ({ username: 'u1', password: 'p1', connectionString: 'c1', expiresAt: null })),
  revokeMySQLUser: jest.fn(async () => true),
  rotateMySQLUserPassword: jest.fn(async () => true),
}));

jest.mock('../src/services/provisioning/mongo', () => ({
  provisionMongoUser: jest.fn(async () => ({ username: 'u1', password: 'p1', connectionString: 'c1', expiresAt: null })),
  revokeMongoUser: jest.fn(async () => true),
  rotateMongoUserPassword: jest.fn(async () => true),
}));

jest.mock('../src/services/provisioning/postgres', () => ({
  provisionPostgresUser: jest.fn(async () => ({ username: 'u1', password: 'p1', connectionString: 'c1', expiresAt: null })),
  revokePostgresUser: jest.fn(async () => true),
  rotatePostgresUserPassword: jest.fn(async () => true),
}));

describe('usersController atomic flows (unit)', () => {
  beforeAll(() => {
    process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
  });

  test('provision -> revoke sequence updates metadata and audit', async () => {
  // create a database entry in storage with an encrypted admin URI
  const adminEncrypted = await encrypt('mysql://root:pass@127.0.0.1:3306');
  const db = storage.addDatabase({ name: 'testdb', type: 'mysql', host: '127.0.0.1', port: 3306, admin_uri_encrypted: adminEncrypted as any });
    const dbList = storage.listDatabases();
    const dbId = dbList[0].id;

    // call provisionUser (simulate req/res)
    const req: any = { params: { dbId }, body: { usernamePrefix: 'app' }, ip: '127.0.0.1' };
    const res: any = { json: jest.fn(), status: jest.fn(() => res) };
    await usersController.provisionUser(req, res);
    expect(res.json).toHaveBeenCalled();

    // Retrieve provisioned user
    const provs = storage.listProvisionedUsersForDb(dbId);
    expect(provs.length).toBeGreaterThan(0);

    const username = provs[0].username;

    // Revoke
    const req2: any = { params: { dbId }, body: { username }, ip: '127.0.0.1' };
    const res2: any = { json: jest.fn(), status: jest.fn(() => res2) };
    await usersController.revokeUser(req2, res2);
    expect(res2.json).toHaveBeenCalledWith({ success: true });

    // ensure metadata removed
    const after = storage.listProvisionedUsersForDb(dbId);
    expect(after.find((p: any) => p.username === username)).toBeUndefined();

    // audit entries exist
    const audits = storage.listAudit(dbId, 10);
    expect(audits.length).toBeGreaterThan(0);
  });
});
