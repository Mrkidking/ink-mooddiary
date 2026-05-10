const express = require('express');
const router = express.Router();

let cache = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// Get city from multiple IP geolocation sources
async function getCity() {
  const sources = [
    async () => {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      return d.city || d.region || null;
    },
    async () => {
      const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      return d.city || d.region || null;
    },
    async () => {
      // wttr.in can auto-detect if no city specified
      return null; // fallback to default
    }
  ];

  for (const src of sources) {
    try {
      const city = await src();
      if (city) return city;
    } catch {}
  }
  return 'Beijing'; // default fallback
}

async function fetchWeather(city) {
  const r = await fetch(`https://api.wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('Weather fetch failed');
  const d = await r.json();
  const cur = d.current_condition[0];
  return {
    city: d.nearest_area?.[0]?.areaName?.[0]?.value || city,
    temp: cur.temp_C,
    feelsLike: cur.FeelsLikeC,
    humidity: cur.humidity,
    desc: cur.weatherDesc?.[0]?.value || '未知',
    code: cur.weatherCode
  };
}

// GET /api/weather
router.get('/', async (req, res) => {
  // Return fresh cache
  if (cache && Date.now() - cache.ts < CACHE_DURATION) {
    return res.json({ weather: cache.data });
  }

  try {
    const city = await getCity();
    const data = await fetchWeather(city);
    cache = { data, ts: Date.now() };
    return res.json({ weather: data });
  } catch {
    // Return stale cache if available
    if (cache) return res.json({ weather: cache.data, stale: true });
    // Hardcoded fallback for Beijing
    try {
      const data = await fetchWeather('Beijing');
      cache = { data, ts: Date.now() };
      return res.json({ weather: data });
    } catch {
      res.status(502).json({ error: '天气信息暂不可用' });
    }
  }
});

module.exports = router;
