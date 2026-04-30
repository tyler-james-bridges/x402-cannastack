const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  display_name: string;
}

export async function geocode(location: string): Promise<GeoLocation | null> {
  const latLng = location.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (latLng) {
    return {
      lat: parseFloat(latLng[1]),
      lng: parseFloat(latLng[2]),
      display_name: location,
    };
  }
  try {
    const params = new URLSearchParams({
      q: location,
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    });
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { 'User-Agent': 'x402-cannastack/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoResult[];
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name,
    };
  } catch {
    return null;
  }
}
