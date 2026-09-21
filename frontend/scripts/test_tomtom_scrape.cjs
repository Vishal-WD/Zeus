const key = 'KaK6bJ7gLxgEZPvWSMvmlAAp8tI6rwgG';
const lat = 9.9252;
const lon = 78.1198;

async function testQuery(name, url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`\n=== [${name}] Total Results: ${data.results ? data.results.length : 0} ===`);
    if (data.results && data.results.length > 0) {
      data.results.forEach((r, idx) => {
        console.log(`  [${idx+1}] ${r.poi?.name || r.address?.freeformAddress} | ${r.address?.freeformAddress} | [${r.position?.lon}, ${r.position?.lat}] | Phone: ${r.poi?.phone || 'N/A'}`);
      });
    }
  } catch (err) {
    console.error(`Error in ${name}:`, err.message);
  }
}

async function run() {
  await testQuery('nearbySearch categorySet 7309', `https://api.tomtom.com/search/2/nearbySearch/.json?key=${key}&lat=${lat}&lon=${lon}&radius=50000&categorySet=7309&limit=50`);
  await testQuery('poiSearch EV', `https://api.tomtom.com/search/2/poiSearch/EV.json?key=${key}&lat=${lat}&lon=${lon}&radius=50000&limit=50`);
  await testQuery('search Charging Station', `https://api.tomtom.com/search/2/search/charging%20station.json?key=${key}&lat=${lat}&lon=${lon}&radius=50000&limit=50`);
  await testQuery('categorySearch 7309', `https://api.tomtom.com/search/2/categorySearch/7309.json?key=${key}&lat=${lat}&lon=${lon}&radius=50000&limit=50`);
  await testQuery('search electric vehicle', `https://api.tomtom.com/search/2/search/electric%20vehicle.json?key=${key}&lat=${lat}&lon=${lon}&radius=50000&limit=50`);
}

run().catch(console.error);

