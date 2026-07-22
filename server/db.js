const { Pool } = require('pg');
require('dotenv').config();

/* Supabase تعطيك رابط اتصال واحد جاهز (Connection String) من:
   Project Settings → Database → Connection string → Node.js
   شكله: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   حطه كامل في متغير DATABASE_URL بملف .env — أسهل من تعبئة الحقول منفصلة. */
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Supabase يتطلب SSL
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

module.exports = pool;
