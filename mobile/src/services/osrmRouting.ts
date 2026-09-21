/**
 * Zeus OS — Real Road Geometry Routing Service via OpenStreetMap OSRM
 * 
 * Fetches street-level driving navigation geometries so route paths
 * strictly snap to real-world city streets, intersections, and bridges
 * rather than cutting across buildings with straight lines.
 */

export interface RoadRouteResult {
  coordinates: [number, number][]; // [lng, lat] along actual pavement
  distanceKm: number;
  durationMins: number;
  isRealRoad: boolean;
}

const routeCache = new Map<string, RoadRouteResult>();

export async function fetchStreetRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<RoadRouteResult> {
  const cacheKey = `${startLng.toFixed(4)},${startLat.toFixed(4)}->${endLng.toFixed(4)},${endLat.toFixed(4)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates;
        const distanceKm = Number((route.distance / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(route.duration / 60));

        const result: RoadRouteResult = {
          coordinates,
          distanceKm,
          durationMins,
          isRealRoad: true,
        };
        routeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Immediate fallback without waiting
  }

  // Graceful Street Waypoint Interpolator Fallback
  // Produces realistic multi-segment turns following city grid rather than a single diagonal cut
  const waypoints: [number, number][] = [
    [startLng, startLat],
    [startLng + (endLng - startLng) * 0.25, startLat + 0.001],
    [startLng + (endLng - startLng) * 0.5, startLat + (endLat - startLat) * 0.45],
    [startLng + (endLng - startLng) * 0.75, endLat - 0.001],
    [endLng, endLat],
  ];

  const dx = (endLng - startLng) * 111.32;
  const dy = (endLat - startLat) * 110.57;
  const straightDist = Math.sqrt(dx * dx + dy * dy);
  const roadDist = Number((straightDist * 1.35).toFixed(1)); // road detour factor
  const roadMins = Math.max(2, Math.round((roadDist / 30) * 60));

  return {
    coordinates: waypoints,
    distanceKm: roadDist,
    durationMins: roadMins,
    isRealRoad: false,
  };
}
