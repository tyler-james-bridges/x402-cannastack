import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '.env.local' });

const METROS = [
  // Original 3
  { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.074, radius_mi: 20 },
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, radius_mi: 20 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903, radius_mi: 15 },
  // Top legal markets
  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194, radius_mi: 15 },
  { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611, radius_mi: 15 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321, radius_mi: 15 },
  { name: 'Portland, OR', lat: 45.5152, lng: -122.6784, radius_mi: 15 },
  { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298, radius_mi: 15 },
  { name: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398, radius_mi: 15 },
  { name: 'Detroit, MI', lat: 42.3314, lng: -83.0458, radius_mi: 15 },
  { name: 'Boston, MA', lat: 42.3601, lng: -71.0589, radius_mi: 15 },
  { name: 'Sacramento, CA', lat: 38.5816, lng: -121.4944, radius_mi: 15 },
  { name: 'Tucson, AZ', lat: 32.2226, lng: -110.9747, radius_mi: 15 },
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

  const count = await sql`SELECT count(*) FROM metros WHERE enabled = true`;
  console.log(`\nSeeding complete. ${count[0].count} metros enabled.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
