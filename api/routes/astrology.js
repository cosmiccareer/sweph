const express = require('express');
const router = express.Router();
const { calculateChart, getCurrentPlanets } = require('../services/calculator');
const { calculatePrenatalVSP, calculateVenusStar, getNextVSP } = require('../services/venus-star-point');
const { calculatePrenatalMarsPhase, getMarsCycleContext, getNextMarsPhase, getPhaseNames } = require('../services/mars-phase');
const {
  calculateLunarPhase,
  calculateProgressedChart,
  findPrenatalSolarEclipse,
  findPrenatalLunarEclipse,
  calculatePlanetaryPhases,
  calculateTransits,
  dateToJulianDay
} = require('../services/advanced-calculations');

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
 * POST /api/v1/vsp - Get Venus Star Point for a birth date
 *
 * Required: year, month, day
 * Optional: hour, minute (for edge cases on VSP dates)
 */
router.post('/vsp', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    const vsp = calculatePrenatalVSP(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    if (!vsp.available && vsp.available !== undefined) {
      return res.status(400).json({ success: false, error: vsp.error });
    }

    res.json({ success: true, data: vsp });
  } catch (error) {
    console.error('VSP calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/venus-star - Get full 5-point Venus Star for a birth date
 *
 * The Venus Star includes:
 * - Venus Star Point (top): Immediate prenatal VSP
 * - Left Arm: Second VSP before birth
 * - Right Arm: Third VSP before birth
 * - Left Leg: First VSP after birth
 * - Right Leg: Second VSP after birth
 *
 * Required: year, month, day
 */
router.post('/venus-star', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    const venusStar = calculateVenusStar(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    if (!venusStar.available) {
      return res.status(400).json({ success: false, error: venusStar.error });
    }

    res.json({ success: true, data: venusStar });
  } catch (error) {
    console.error('Venus Star calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/vsp/next - Get the next upcoming Venus Star Point
 */
router.get('/vsp/next', (req, res) => {
  try {
    const nextVSP = getNextVSP();
    if (!nextVSP) {
      return res.status(404).json({ success: false, error: 'No upcoming VSP found in data' });
    }
    res.json({ success: true, data: nextVSP });
  } catch (error) {
    console.error('Next VSP error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/mars-phase - Get Mars Phase for a birth date
 *
 * Required: year, month, day
 */
router.post('/mars-phase', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    const marsPhase = calculatePrenatalMarsPhase(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    if (!marsPhase.available && marsPhase.available !== undefined) {
      return res.status(400).json({ success: false, error: marsPhase.error });
    }

    res.json({ success: true, data: marsPhase });
  } catch (error) {
    console.error('Mars Phase calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/mars-cycle - Get full Mars cycle context for a birth date
 *
 * Returns the current phase plus all phases in the same cycle
 */
router.post('/mars-cycle', (req, res) => {
  try {
    const { year, month, day } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    const cycleContext = getMarsCycleContext(
      parseInt(year),
      parseInt(month),
      parseInt(day)
    );

    if (!cycleContext.available) {
      return res.status(400).json({ success: false, error: cycleContext.error });
    }

    res.json({ success: true, data: cycleContext });
  } catch (error) {
    console.error('Mars Cycle calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/mars-phase/next - Get the next upcoming Mars Phase
 */
router.get('/mars-phase/next', (req, res) => {
  try {
    const nextPhase = getNextMarsPhase();
    if (!nextPhase) {
      return res.status(404).json({ success: false, error: 'No upcoming Mars Phase found in data' });
    }
    res.json({ success: true, data: nextPhase });
  } catch (error) {
    console.error('Next Mars Phase error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/mars-phase/phases - List all Mars Phase names
 */
router.get('/mars-phase/phases', (req, res) => {
  res.json({
    success: true,
    data: getPhaseNames(),
    description: 'The 13 phases of the Mars cycle'
  });
});

/**
 * POST /api/v1/chart/full - Get complete chart with VSP, Mars Phase, and all data
 *
 * Required: year, month, day, hour, minute, latitude, longitude, timezone
 */
router.post('/chart/full', (req, res) => {
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
        hint: 'timezone should be an IANA timezone like "America/New_York"'
      });
    }

    // Calculate natal chart
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

    // Calculate Venus Star Point
    const vsp = calculatePrenatalVSP(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    // Calculate full Venus Star
    const venusStar = calculateVenusStar(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    // Calculate Mars Phase
    const marsPhase = calculatePrenatalMarsPhase(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    // Calculate Mars Cycle context
    const marsCycle = getMarsCycleContext(
      parseInt(year),
      parseInt(month),
      parseInt(day)
    );

    res.json({
      success: true,
      data: {
        chart,
        venusStarPoint: vsp,
        venusStar,
        marsPhase,
        marsCycle: {
          cycle: marsCycle.currentCycle,
          progress: marsCycle.cycleProgress
        }
      }
    });
  } catch (error) {
    console.error('Full chart calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check that timezone is a valid IANA timezone'
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

/**
 * POST /api/v1/lunar-phase - Calculate lunar phase for a date
 *
 * Required: year, month, day
 * Optional: hour, minute
 */
router.post('/lunar-phase', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    // Get Sun and Moon positions for the date
    const jd = dateToJulianDay(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    const sweph = require('sweph');
    const sunResult = sweph.swe_calc_ut(jd, sweph.SE_SUN, sweph.SEFLG_SWIEPH);
    const moonResult = sweph.swe_calc_ut(jd, sweph.SE_MOON, sweph.SEFLG_SWIEPH);

    const lunarPhase = calculateLunarPhase(sunResult.longitude, moonResult.longitude);

    res.json({
      success: true,
      data: {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        sunLongitude: sunResult.longitude,
        moonLongitude: moonResult.longitude,
        ...lunarPhase
      }
    });
  } catch (error) {
    console.error('Lunar phase calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/progressions - Calculate secondary progressions
 *
 * Required: birthYear, birthMonth, birthDay, targetYear, targetMonth, targetDay
 * Optional: birthHour, birthMinute, latitude, longitude
 */
router.post('/progressions', (req, res) => {
  try {
    const {
      birthYear, birthMonth, birthDay, birthHour = 12, birthMinute = 0,
      targetYear, targetMonth, targetDay,
      latitude = 0, longitude = 0
    } = req.body;

    if (!birthYear || !birthMonth || !birthDay || !targetYear || !targetMonth || !targetDay) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: birthYear, birthMonth, birthDay, targetYear, targetMonth, targetDay'
      });
    }

    const birthJd = dateToJulianDay(
      parseInt(birthYear),
      parseInt(birthMonth),
      parseInt(birthDay),
      parseInt(birthHour),
      parseInt(birthMinute)
    );

    const targetDate = new Date(parseInt(targetYear), parseInt(targetMonth) - 1, parseInt(targetDay));

    const progressions = calculateProgressedChart(
      birthJd,
      targetDate,
      parseFloat(latitude),
      parseFloat(longitude)
    );

    res.json({ success: true, data: progressions });
  } catch (error) {
    console.error('Progressions calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/prenatal-eclipses - Find prenatal solar and lunar eclipses
 *
 * Required: year, month, day
 * Optional: latitude, longitude
 */
router.post('/prenatal-eclipses', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0, latitude = 0, longitude = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    const birthJd = dateToJulianDay(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    const solarEclipse = findPrenatalSolarEclipse(birthJd, parseFloat(latitude), parseFloat(longitude));
    const lunarEclipse = findPrenatalLunarEclipse(birthJd);

    res.json({
      success: true,
      data: {
        birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        prenatalSolarEclipse: solarEclipse,
        prenatalLunarEclipse: lunarEclipse
      }
    });
  } catch (error) {
    console.error('Prenatal eclipses calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/planetary-phases - Calculate planetary phase relationships
 *
 * Required: year, month, day
 * Optional: hour, minute
 */
router.post('/planetary-phases', (req, res) => {
  try {
    const { year, month, day, hour = 12, minute = 0 } = req.body;

    if (!year || !month || !day) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: year, month, day'
      });
    }

    // Get all planetary positions for the date
    const jd = dateToJulianDay(
      parseInt(year),
      parseInt(month),
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );

    const sweph = require('sweph');
    const planets = {};
    const planetIds = {
      sun: sweph.SE_SUN,
      moon: sweph.SE_MOON,
      mercury: sweph.SE_MERCURY,
      venus: sweph.SE_VENUS,
      mars: sweph.SE_MARS,
      jupiter: sweph.SE_JUPITER,
      saturn: sweph.SE_SATURN
    };

    for (const [name, id] of Object.entries(planetIds)) {
      const result = sweph.swe_calc_ut(jd, id, sweph.SEFLG_SWIEPH);
      planets[name] = { longitude: result.longitude };
    }

    const phases = calculatePlanetaryPhases(planets);

    res.json({
      success: true,
      data: {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        phases
      }
    });
  } catch (error) {
    console.error('Planetary phases calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/transits - Calculate current transits to natal chart
 *
 * Required: natalPlanets object with planet longitudes
 * Optional: transitDate (defaults to now)
 */
router.post('/transits', (req, res) => {
  try {
    const { natalPlanets, transitYear, transitMonth, transitDay } = req.body;

    if (!natalPlanets) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: natalPlanets (object with planet positions)'
      });
    }

    let transitDate = new Date();
    if (transitYear && transitMonth && transitDay) {
      transitDate = new Date(parseInt(transitYear), parseInt(transitMonth) - 1, parseInt(transitDay));
    }

    const transits = calculateTransits(natalPlanets, transitDate);

    res.json({ success: true, data: transits });
  } catch (error) {
    console.error('Transits calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/chart/comprehensive - Get all calculations in one call
 *
 * Required: year, month, day, hour, minute, latitude, longitude, timezone
 * Returns: chart, VSP, venusStar, marsPhase, lunarPhase, prenatalEclipses, planetaryPhases
 */
router.post('/chart/comprehensive', (req, res) => {
  try {
    const {
      year, month, day, hour, minute,
      latitude, longitude, timezone,
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
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Calculate natal chart
    const chart = calculateChart(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute),
      parseFloat(latitude), parseFloat(longitude),
      timezone, houseSystem
    );

    // Calculate Venus Star Point
    const vsp = calculatePrenatalVSP(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute)
    );

    // Calculate full Venus Star
    const venusStar = calculateVenusStar(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute)
    );

    // Calculate Mars Phase
    const marsPhase = calculatePrenatalMarsPhase(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute)
    );

    // Get Julian Day for advanced calculations
    const birthJd = dateToJulianDay(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute)
    );

    // Calculate lunar phase from chart data
    const lunarPhase = calculateLunarPhase(
      chart.planets?.sun?.longitude || 0,
      chart.planets?.moon?.longitude || 0
    );

    // Calculate prenatal eclipses
    const solarEclipse = findPrenatalSolarEclipse(birthJd, parseFloat(latitude), parseFloat(longitude));
    const lunarEclipse = findPrenatalLunarEclipse(birthJd);

    // Calculate planetary phases
    const planetaryPhases = calculatePlanetaryPhases(chart.planets || {});

    // Calculate progressions to current date
    const progressions = calculateProgressedChart(
      birthJd,
      new Date(),
      parseFloat(latitude),
      parseFloat(longitude)
    );

    // Calculate current transits
    const transits = calculateTransits(chart.planets || {}, new Date());

    res.json({
      success: true,
      data: {
        chart,
        venusStarPoint: vsp,
        venusStar,
        marsPhase,
        lunarPhase,
        prenatalEclipses: {
          solar: solarEclipse,
          lunar: lunarEclipse
        },
        planetaryPhases,
        progressions,
        currentTransits: transits
      }
    });
  } catch (error) {
    console.error('Comprehensive chart calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check that timezone is a valid IANA timezone'
    });
  }
});

module.exports = router;
