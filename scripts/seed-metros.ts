import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const METROS = [
  { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.074, radius_mi: 20 },
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, radius_mi: 20 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903, radius_mi: 15 },
];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Seeding metro areas...');

  for (const metro of METROS) {
    await sql`
      INSERT INTO metros (name, lat, lng, radius_mi, enabled)
      VALUES (${metro.name}, ${metro.lat}, ${metro.lng}, ${metro.radius_mi}, true)
      ON CONFLICT DO NOTHING
    `;
    console.log(`  + ${metro.name}`);
  }

  console.log('Seeding complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
