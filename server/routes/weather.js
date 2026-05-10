const express = require('express');
const router = express.Router();

// Simple in-memory cache
let cache = null;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

async function fetchWeather() {
  try {
    // Step 1: Get location from IP
    const ipResp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!ipResp.ok) throw new Error('IP lookup failed');
    const ipData = await ipResp.json();
    const city = ipData.city || ipData.region || 'Beijing';

    // Step 2: Get weather from wttr.in
    const wResp = await fetch(`https://api.wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) });
    if (!wResp.ok) throw new Error('Weather fetch failed');
    const wData = await wResp.json();
    const cur = wData.current_condition[0];

    return {
      city: wData.nearest_area?.[0]?.areaName?.[0]?.value || city,
      temp: cur.temp_C,
      feelsLike: cur.FeelsLikeC,
      humidity: cur.humidity,
      desc: cur.weatherDesc?.[0]?.value || '未知',
      code: cur.weatherCode,
      windSpeed: cur.windspeedKmph
    };
  } catch {
    return null;
  }
}

// GET /api/weather
router.get('/', async (req, res) => {
  if (cache && Date.now() - cache.ts < CACHE_DURATION) {
    return res.json({ weather: cache.data });
  }

  const data = await fetchWeather();
  if (data) {
    cache = { data, ts: Date.now() };
    return res.json({ weather: data });
  }

  // Return stale cache if available
  if (cache) return res.json({ weather: cache.data, stale: true });

  res.status(502).json({ error: '天气信息暂不可用' });
});

module.exports = router;
