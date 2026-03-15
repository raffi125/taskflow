require('dotenv').config();
const { sql } = require('./connection');

async function migrate() {
  console.log('🚀 Menjalankan migrasi database Neon...\n');

  try {
    // Tabel users
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        username    VARCHAR(50)  UNIQUE NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      )
    `;
    console.log('✅ Tabel users dibuat');

    // Tabel tasks
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(200) NOT NULL,
        subject     VARCHAR(100) NOT NULL,
        priority    VARCHAR(10)  NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        deadline    DATE         NOT NULL,
        is_done     BOOLEAN      DEFAULT FALSE,
        notes       TEXT,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      )
    `;
    console.log('✅ Tabel tasks dibuat');

    // Index untuk performa query
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)
    `;
    console.log('✅ Index dibuat');

    // Trigger auto-update updated_at
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      DROP TRIGGER IF EXISTS trigger_users_updated_at ON users
    `;
    await sql`
      CREATE TRIGGER trigger_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `;

    await sql`
      DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON tasks
    `;
    await sql`
      CREATE TRIGGER trigger_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `;
    console.log('✅ Trigger updated_at dibuat');

    console.log('\n🎉 Migrasi selesai! Database siap digunakan.');
  } catch (err) {
    console.error('\n❌ Migrasi gagal:', err.message);
    process.exit(1);
  }
}

migrate();
