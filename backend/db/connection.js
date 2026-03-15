const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL tidak ditemukan di .env');
}

const sql = neon(process.env.DATABASE_URL);

/**
 * Helper query dengan error handling
 * @param {string} query - SQL query template literal
 * @param {any[]} params - Parameter untuk prepared statement
 */
async function query(strings, ...values) {
  try {
    return await sql(strings, ...values);
  } catch (err) {
    console.error('[DB Error]', err.message);
    throw err;
  }
}

// Tagged template wrapper supaya bisa dipanggil sebagai sql`...`
const db = new Proxy(sql, {
  apply(target, thisArg, args) {
    return target.apply(thisArg, args);
  }
});

module.exports = { sql, db };
