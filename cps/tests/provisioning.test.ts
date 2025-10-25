import { provisionMySQLUser, revokeMySQLUser, rotateMySQLUserPassword } from '../src/services/provisioning/mysql';
import { provisionMongoUser, revokeMongoUser, rotateMongoUserPassword } from '../src/services/provisioning/mongo';
import { provisionPostgresUser, revokePostgresUser, rotatePostgresUserPassword } from '../src/services/provisioning/postgres';

// These are lightweight tests that mock out real DB calls by providing invalid admin URIs
// and expecting errors, ensuring our function wiring works. Full integration tests require real DBs.
describe('provisioning functions (smoke)', () => {
  test('mysql provision throws without adminUri', async () => {
    await expect(provisionMySQLUser({ id: 'x', name: 'db', type: 'mysql', host: 'h' }, 'pfx')).rejects.toBeTruthy();
  });

  test('mongo provision throws without adminUri', async () => {
    await expect(provisionMongoUser({ id: 'x', name: 'db', type: 'mongodb', host: 'h' }, 'pfx')).rejects.toBeTruthy();
  });

  test('postgres provision throws without adminUri', async () => {
    await expect(provisionPostgresUser({ id: 'x', name: 'db', type: 'postgres', host: 'h' }, 'pfx')).rejects.toBeTruthy();
  });

  test('revoke/rotate throw without adminUri', async () => {
    await expect(revokeMySQLUser({ id: 'x', name: 'db', type: 'mysql', host: 'h' }, 'u')).rejects.toBeTruthy();
    await expect(rotateMySQLUserPassword({ id: 'x', name: 'db', type: 'mysql', host: 'h' }, 'u', 'p')).rejects.toBeTruthy();
    await expect(revokeMongoUser({ id: 'x', name: 'db', type: 'mongodb', host: 'h' }, 'u')).rejects.toBeTruthy();
    await expect(rotateMongoUserPassword({ id: 'x', name: 'db', type: 'mongodb', host: 'h' }, 'u', 'p')).rejects.toBeTruthy();
    await expect(revokePostgresUser({ id: 'x', name: 'db', type: 'postgres', host: 'h' }, 'u')).rejects.toBeTruthy();
    await expect(rotatePostgresUserPassword({ id: 'x', name: 'db', type: 'postgres', host: 'h' }, 'u', 'p')).rejects.toBeTruthy();
  });
});
