/**
 * Seed admin user migration (example)
 * Run locally to create an initial admin user (do NOT commit credentials).
 * Usage (local only):
 *   ADMIN_INIT_USERNAME=admin ADMIN_INIT_PASSWORD=changeme node dist/migrations/seed_admin.js
 */
import bcrypt from 'bcryptjs';
import * as storage from '../services/storage';

async function seed() {
  const username = process.env.ADMIN_INIT_USERNAME;
  const password = process.env.ADMIN_INIT_PASSWORD;
  if (!username || !password) {
    console.error('ADMIN_INIT_USERNAME and ADMIN_INIT_PASSWORD must be set for seeding');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const exists = storage.findAdminByUsername(username);
  if (exists) {
    console.log('admin user already exists');
    process.exit(0);
  }
  storage.addAdmin(username, hash, 'admin');
  console.log('admin user seeded');
}

seed().catch((e) => { console.error(e); process.exit(1); });
