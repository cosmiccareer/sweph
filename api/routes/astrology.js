const express = require('express');
const router = express.Router();
const { calculateChart, getCurrentPlanets } = require('../services/calculator');

/**
 * POST /api/v1/chart - Calculate natal chart
 *
 * Required body params:
 * - year, month, day, hour, minute (local time)
 * - latitude, longitude (birth location)
 * - timezone (IANA timezone, e.g., 'America/New_York')
 *
 * Optional:
 * - houseSystem (default 'P' for Placidus)
 */
router.post('/chart', (req, res) => {
  try {
    const {
      year,
      month,
      day,
      hour,
      minute,
      latitude,
      longitude,
      timezone,
      houseSystem = 'P'
    } = req.body;

    // Validate required fields
    const missing = [];
    if (year === undefined) missing.push('year');
    if (month === undefined) missing.push('month');
    if (day === undefined) missing.push('day');
    if (hour === undefined) missing.push('hour');
    if (minute === undefined) missing.push('minute');
    if (latitude === undefined) missing.push('latitude');
    if (longitude === undefined) missing.push('longitude');
    if (!timezone) missing.push('timezone');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        hint: 'timezone should be an IANA timezone like "America/New_York", "Europe/London", "Asia/Tokyo"'
      });
    }

    // Validate ranges
    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'month must be 1-12' });
    }
    if (day < 1 || day > 31) {
      return res.status(400).json({ success: false, error: 'day must be 1-31' });
    }
    if (hour < 0 || hour > 23) {
      return res.status(400).json({ success: false, error: 'hour must be 0-23' });
    }
    if (minute < 0 || minute > 59) {
      return res.status(400).json({ success: false, error: 'minute must be 0-59' });
    }
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ success: false, error: 'latitude must be -90 to 90' });
    }
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, error: 'longitude must be -180 to 180' });
    }

    const chart = calculateChart(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseFloat(latitude),
      parseFloat(longitude),
      timezone,
      houseSystem
    );

    res.json({ success: true, data: chart });
  } catch (error) {
    console.error('Chart calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check that timezone is a valid IANA timezone (e.g., "America/New_York")'
    });
  }
});

/**
 * GET /api/v1/planets - Get current planetary positions
 */
router.get('/planets', (req, res) => {
  try {
    const data = getCurrentPlanets();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Planets calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/timezones - List common timezones
 */
router.get('/timezones', (req, res) => {
  const timezones = {
    'Americas': [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Phoenix',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Sao_Paulo',
      'America/Buenos_Aires'
    ],
    'Europe': [
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Amsterdam',
      'Europe/Moscow',
      'Europe/Athens'
    ],
    'Asia': [
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Seoul',
      'Asia/Bangkok',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Jakarta'
    ],
    'Pacific': [
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Perth',
      'Pacific/Auckland',
      'Pacific/Fiji'
    ],
    'Africa': [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi'
    ]
  };

  res.json({
    success: true,
    data: timezones,
    note: 'Use IANA timezone names. Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones'
  });
});

/**
 * GET /api/v1/house-systems - List supported house systems
 */
router.get('/house-systems', (req, res) => {
  const houseSystems = [
    { code: 'P', name: 'Placidus', description: 'Most common Western system' },
    { code: 'K', name: 'Koch', description: 'Popular in German-speaking countries' },
    { code: 'R', name: 'Regiomontanus', description: 'Historical system, used in horary' },
    { code: 'C', name: 'Campanus', description: 'Space-based division' },
    { code: 'O', name: 'Porphyrius', description: 'Ancient system' },
    { code: 'A', name: 'Equal (Ascendant)', description: '30° houses from Ascendant' },
    { code: 'W', name: 'Whole Sign', description: 'Each sign = one house' },
    { code: 'B', name: 'Alcabitus', description: 'Medieval Arabic system' },
    { code: 'M', name: 'Morinus', description: 'Equator-based' },
    { code: 'T', name: 'Topocentric (Polich/Page)', description: 'Modern scientific approach' }
  ];

  res.json({ success: true, data: houseSystems });
});

module.exports = router;
