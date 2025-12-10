const sweph = require('sweph');
const path = require('path');
const { DateTime } = require('luxon');

// Initialize ephemeris path
const ephePath = process.env.EPHE_PATH || path.join(__dirname, '../ephemeris');
sweph.set_ephe_path(ephePath);

const PLANETS = {
  sun: sweph.constants.SE_SUN,
  moon: sweph.constants.SE_MOON,
  mercury: sweph.constants.SE_MERCURY,
  venus: sweph.constants.SE_VENUS,
  mars: sweph.constants.SE_MARS,
  jupiter: sweph.constants.SE_JUPITER,
  saturn: sweph.constants.SE_SATURN,
  uranus: sweph.constants.SE_URANUS,
  neptune: sweph.constants.SE_NEPTUNE,
  pluto: sweph.constants.SE_PLUTO,
  northNode: sweph.constants.SE_TRUE_NODE,
  southNode: sweph.constants.SE_TRUE_NODE, // We'll calculate this as opposite
  chiron: sweph.constants.SE_CHIRON
};

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/**
 * Get zodiac sign and position from longitude
 */
function getZodiacSign(longitude) {
  // Normalize longitude to 0-360
  const normalizedLng = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLng / 30);
  const degreesInSign = normalizedLng % 30;

  return {
    sign: ZODIAC_SIGNS[signIndex],
    degrees: Math.floor(degreesInSign),
    minutes: Math.floor((degreesInSign % 1) * 60),
    longitude: normalizedLng
  };
}

/**
 * Convert local time to UTC using timezone
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
 * @returns {Object} UTC date components
 */
function localToUTC(year, month, day, hour, minute, timezone) {
  // Create DateTime in the local timezone
  const localDt = DateTime.fromObject(
    { year, month, day, hour, minute, second: 0 },
    { zone: timezone }
  );

  if (!localDt.isValid) {
    throw new Error(`Invalid date/time or timezone: ${localDt.invalidReason}`);
  }

  // Convert to UTC
  const utcDt = localDt.toUTC();

  return {
    year: utcDt.year,
    month: utcDt.month,
    day: utcDt.day,
    hour: utcDt.hour,
    minute: utcDt.minute,
    second: utcDt.second,
    utcOffset: localDt.offset / 60, // offset in hours
    localTime: localDt.toISO(),
    utcTime: utcDt.toISO()
  };
}

/**
 * Calculate a complete astrological chart
 * @param {number} year - Local year
 * @param {number} month - Local month (1-12)
 * @param {number} day - Local day
 * @param {number} hour - Local hour (0-23)
 * @param {number} minute - Local minute (0-59)
 * @param {number} latitude - Birth latitude
 * @param {number} longitude - Birth longitude
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
 * @param {string} houseSystem - House system code (default 'P' for Placidus)
 * @returns {Object} Complete chart data
 */
function calculateChart(year, month, day, hour, minute, latitude, longitude, timezone = 'UTC', houseSystem = 'P') {
  // Convert local time to UTC
  const utc = localToUTC(year, month, day, hour, minute, timezone);

  // Convert UTC to Julian Day
  const jdResult = sweph.utc_to_jd(
    utc.year, utc.month, utc.day,
    utc.hour, utc.minute, utc.second,
    sweph.constants.SE_GREG_CAL
  );

  if (jdResult.flag !== sweph.constants.OK) {
    throw new Error(jdResult.error || 'Failed to calculate Julian Day');
  }

  const [jd_et, jd_ut] = jdResult.data;
  const flags = sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED;

  // Calculate all planets
  const planets = {};
  for (const [name, id] of Object.entries(PLANETS)) {
    // Skip southNode - we calculate it from northNode
    if (name === 'southNode') continue;

    const result = sweph.calc(jd_et, id, flags);
    if (result.flag < 0) {
      console.warn(`Warning: Could not calculate ${name}: ${result.error}`);
      continue;
    }

    const [lng, lat, dist, lngSpeed, latSpeed, distSpeed] = result.data;

    planets[name] = {
      longitude: lng,
      latitude: lat,
      distance: dist,
      speed: lngSpeed,
      retrograde: lngSpeed < 0,
      ...getZodiacSign(lng)
    };
  }

  // Calculate South Node as opposite of North Node
  if (planets.northNode) {
    const southNodeLng = (planets.northNode.longitude + 180) % 360;
    planets.southNode = {
      longitude: southNodeLng,
      latitude: -planets.northNode.latitude,
      distance: planets.northNode.distance,
      speed: planets.northNode.speed,
      retrograde: planets.northNode.retrograde,
      ...getZodiacSign(southNodeLng)
    };
  }

  // Calculate houses
  const housesResult = sweph.houses_ex2(
    jd_ut,
    sweph.constants.SEFLG_SWIEPH,
    latitude,
    longitude,
    houseSystem
  );

  if (housesResult.flag < 0) {
    throw new Error(housesResult.error || 'Failed to calculate houses');
  }

  const houses = housesResult.data.houses.slice(0, 12).map((cusp, i) => ({
    house: i + 1,
    cusp: cusp,
    ...getZodiacSign(cusp)
  }));

  // Get angles from points array
  // points[0] = Ascendant, points[1] = MC, points[2] = ARMC, points[3] = Vertex
  const points = housesResult.data.points;
  const ascendant = points[0];
  const mc = points[1];
  const descendant = (ascendant + 180) % 360;
  const ic = (mc + 180) % 360;

  const angles = {
    ascendant: { longitude: ascendant, ...getZodiacSign(ascendant) },
    midheaven: { longitude: mc, ...getZodiacSign(mc) },
    descendant: { longitude: descendant, ...getZodiacSign(descendant) },
    ic: { longitude: ic, ...getZodiacSign(ic) },
    vertex: points[3] ? { longitude: points[3], ...getZodiacSign(points[3]) } : null
  };

  // Calculate aspects
  const aspects = calculateAspects(planets);

  return {
    input: {
      localTime: {
        year, month, day, hour, minute,
        timezone,
        iso: utc.localTime
      },
      utcTime: {
        year: utc.year,
        month: utc.month,
        day: utc.day,
        hour: utc.hour,
        minute: utc.minute,
        iso: utc.utcTime
      },
      location: { latitude, longitude },
      houseSystem: getHouseSystemName(houseSystem),
      julianDay: { et: jd_et, ut: jd_ut }
    },
    planets,
    houses,
    angles,
    aspects
  };
}

/**
 * Calculate aspects between planets
 */
function calculateAspects(planets) {
  const ASPECTS = [
    { name: 'conjunction', angle: 0, orb: 8, symbol: '☌' },
    { name: 'sextile', angle: 60, orb: 6, symbol: '⚹' },
    { name: 'square', angle: 90, orb: 8, symbol: '□' },
    { name: 'trine', angle: 120, orb: 8, symbol: '△' },
    { name: 'opposition', angle: 180, orb: 8, symbol: '☍' },
    { name: 'quincunx', angle: 150, orb: 3, symbol: '⚻' },
    { name: 'semisextile', angle: 30, orb: 2, symbol: '⚺' },
    { name: 'semisquare', angle: 45, orb: 2, symbol: '∠' },
    { name: 'sesquiquadrate', angle: 135, orb: 2, symbol: '⚼' }
  ];

  const aspects = [];
  const planetNames = Object.keys(planets);

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1Name = planetNames[i];
      const p2Name = planetNames[j];
      const p1 = planets[p1Name];
      const p2 = planets[p2Name];

      if (!p1 || !p2) continue;

      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;

      for (const aspect of ASPECTS) {
        const orbUsed = Math.abs(diff - aspect.angle);
        if (orbUsed <= aspect.orb) {
          aspects.push({
            planet1: p1Name,
            planet2: p2Name,
            aspect: aspect.name,
            symbol: aspect.symbol,
            exactAngle: aspect.angle,
            actualAngle: diff.toFixed(2),
            orb: orbUsed.toFixed(2),
            applying: Math.abs(p1.speed) > Math.abs(p2.speed) ? p1.speed > p2.speed : p2.speed > p1.speed
          });
          break;
        }
      }
    }
  }

  return aspects;
}

/**
 * Get house system name from code
 */
function getHouseSystemName(code) {
  const systems = {
    'P': 'Placidus',
    'K': 'Koch',
    'O': 'Porphyrius',
    'R': 'Regiomontanus',
    'C': 'Campanus',
    'A': 'Equal (Ascendant)',
    'E': 'Equal',
    'V': 'Vehlow Equal',
    'W': 'Whole Sign',
    'X': 'Axial Rotation',
    'H': 'Azimuthal/Horizontal',
    'T': 'Polich/Page (Topocentric)',
    'B': 'Alcabitus',
    'M': 'Morinus',
    'G': 'Gauquelin Sectors'
  };
  return systems[code] || code;
}

/**
 * Get current planetary positions (geocentric, no houses)
 */
function getCurrentPlanets() {
  const now = DateTime.utc();

  const jdResult = sweph.utc_to_jd(
    now.year, now.month, now.day,
    now.hour, now.minute, now.second,
    sweph.constants.SE_GREG_CAL
  );

  if (jdResult.flag !== sweph.constants.OK) {
    throw new Error(jdResult.error || 'Failed to calculate Julian Day');
  }

  const [jd_et] = jdResult.data;
  const flags = sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED;

  const planets = {};
  for (const [name, id] of Object.entries(PLANETS)) {
    if (name === 'southNode') continue;

    const result = sweph.calc(jd_et, id, flags);
    if (result.flag < 0) continue;

    const [lng, lat, dist, lngSpeed] = result.data;
    planets[name] = {
      longitude: lng,
      speed: lngSpeed,
      retrograde: lngSpeed < 0,
      ...getZodiacSign(lng)
    };
  }

  // Add South Node
  if (planets.northNode) {
    const southNodeLng = (planets.northNode.longitude + 180) % 360;
    planets.southNode = {
      longitude: southNodeLng,
      speed: planets.northNode.speed,
      retrograde: planets.northNode.retrograde,
      ...getZodiacSign(southNodeLng)
    };
  }

  return {
    timestamp: now.toISO(),
    julianDay: jd_et,
    planets
  };
}

module.exports = {
  calculateChart,
  getCurrentPlanets,
  getZodiacSign,
  localToUTC,
  ZODIAC_SIGNS
};
