/**
 * Advanced Astrological Calculations Service
 *
 * Provides additional calculations beyond basic natal charts:
 * - Lunar Phase (natal and progressed)
 * - Secondary Progressions
 * - Prenatal Eclipses (solar and lunar)
 * - Planetary Phases (Mars-Sun, Saturn-Jupiter)
 * - Current Transits to natal positions
 */

const sweph = require('sweph');
const path = require('path');

// Set ephemeris path
const ephePath = path.join(__dirname, '../../ephe');
sweph.set_ephe_path(ephePath);

// Planet constants - use sweph.constants like calculator.js does
const PLANETS = {
  SUN: sweph.constants.SE_SUN,
  MOON: sweph.constants.SE_MOON,
  MERCURY: sweph.constants.SE_MERCURY,
  VENUS: sweph.constants.SE_VENUS,
  MARS: sweph.constants.SE_MARS,
  JUPITER: sweph.constants.SE_JUPITER,
  SATURN: sweph.constants.SE_SATURN,
  URANUS: sweph.constants.SE_URANUS,
  NEPTUNE: sweph.constants.SE_NEPTUNE,
  PLUTO: sweph.constants.SE_PLUTO,
  NORTH_NODE: sweph.constants.SE_TRUE_NODE
};

// Flags for calculations
const SEFLG_SWIEPH = sweph.constants.SEFLG_SWIEPH;
const SEFLG_SPEED = sweph.constants.SEFLG_SPEED;
const SE_GREG_CAL = sweph.constants.SE_GREG_CAL;

const LUNAR_PHASES = [
  { name: 'New Moon', start: 0, end: 45 },
  { name: 'Crescent', start: 45, end: 90 },
  { name: 'First Quarter', start: 90, end: 135 },
  { name: 'Gibbous', start: 135, end: 180 },
  { name: 'Full Moon', start: 180, end: 225 },
  { name: 'Disseminating', start: 225, end: 270 },
  { name: 'Last Quarter', start: 270, end: 315 },
  { name: 'Balsamic', start: 315, end: 360 }
];

/**
 * Normalize angle to 0-360 range
 * @param {number} angle
 * @returns {number}
 */
function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Convert date to Julian Day
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @returns {number}
 */
function dateToJulianDay(year, month, day, hour = 12, minute = 0) {
  // Use sweph.utc_to_jd like calculator.js does
  const result = sweph.utc_to_jd(year, month, day, hour, minute, 0, SE_GREG_CAL);
  if (result.flag !== sweph.constants.OK) {
    // Fallback to simple calculation
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045 + (hour + minute / 60 - 12) / 24;
  }
  return result.data[1]; // jd_ut
}

/**
 * Calculate Lunar Phase from Sun and Moon longitudes
 * @param {number} sunLng - Sun longitude in degrees
 * @param {number} moonLng - Moon longitude in degrees
 * @returns {object} - Lunar phase information
 */
function calculateLunarPhase(sunLng, moonLng) {
  // Calculate the angle from Sun to Moon (Moon - Sun)
  let phase = normalizeAngle(moonLng - sunLng);

  // Find which phase this falls into
  let phaseName = 'Unknown';
  for (const p of LUNAR_PHASES) {
    if (phase >= p.start && phase < p.end) {
      phaseName = p.name;
      break;
    }
  }

  // Handle the New Moon wrap-around (0-45 and also includes 360)
  if (phaseName === 'Unknown' && phase >= 315) {
    phaseName = 'Balsamic';
  }

  // Calculate percentage of cycle (0% = New, 50% = Full)
  const cyclePercentage = (phase / 360) * 100;

  // Determine if waxing or waning
  const isWaxing = phase < 180;

  // Calculate illumination percentage (approximation)
  const illumination = Math.abs(Math.cos((phase * Math.PI) / 180 - Math.PI)) * 100;

  return {
    phaseName,
    phaseAngle: phase.toFixed(2),
    cyclePercentage: cyclePercentage.toFixed(1),
    isWaxing,
    illumination: illumination.toFixed(1),
    description: getPhaseDescription(phaseName)
  };
}

/**
 * Get description for a lunar phase
 * @param {string} phaseName
 * @returns {string}
 */
function getPhaseDescription(phaseName) {
  const descriptions = {
    'New Moon': 'New beginnings, setting intentions, planting seeds. Introspective energy.',
    'Crescent': 'Pushing forward despite obstacles, building momentum, taking action on intentions.',
    'First Quarter': 'Crisis in action, decision-making, overcoming challenges, commitment.',
    'Gibbous': 'Refinement, analysis, perfecting, adjusting approach before completion.',
    'Full Moon': 'Culmination, illumination, harvest, relationships, emotional peak.',
    'Disseminating': 'Sharing wisdom, teaching, spreading what was learned, giving back.',
    'Last Quarter': 'Crisis in consciousness, re-evaluation, letting go, clearing.',
    'Balsamic': 'Surrender, release, rest, preparation for new cycle, prophecy.'
  };
  return descriptions[phaseName] || '';
}

/**
 * Calculate Secondary Progressions
 * Based on "a day for a year" - each day after birth = one year of life
 *
 * @param {number} birthJd - Birth Julian Day
 * @param {Date} targetDate - Date to calculate progressions for
 * @param {number} latitude - Birth latitude (for houses)
 * @param {number} longitude - Birth longitude (for houses)
 * @returns {object} - Progressed chart data
 */
function calculateProgressedChart(birthJd, targetDate, latitude = 0, longitude = 0) {
  // Calculate years elapsed since birth
  const targetJd = dateToJulianDay(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    targetDate.getDate(),
    12, 0
  );

  const yearsElapsed = (targetJd - birthJd) / 365.25;

  // Progressed JD = birth JD + (years elapsed as days)
  const progressedJd = birthJd + yearsElapsed;

  // Calculate planetary positions for progressed date
  const progressedPlanets = {};
  const flag = SEFLG_SWIEPH | SEFLG_SPEED;

  for (const [name, id] of Object.entries(PLANETS)) {
    const result = sweph.calc(progressedJd, id, flag);
    if (result.flag >= 0 && result.data) {
      const [lng, lat, dist, lngSpeed] = result.data;
      progressedPlanets[name.toLowerCase()] = {
        longitude: lng,
        longitudeDMS: degreesToDMS(lng),
        sign: getZodiacSign(lng),
        signDegree: lng % 30,
        speed: lngSpeed,
        isRetrograde: lngSpeed < 0
      };
    }
  }

  // Calculate progressed lunar phase
  const progressedLunarPhase = calculateLunarPhase(
    progressedPlanets.sun?.longitude || 0,
    progressedPlanets.moon?.longitude || 0
  );

  // Calculate houses if coordinates provided
  let progressedHouses = null;
  if (latitude !== 0 || longitude !== 0) {
    const houseResult = sweph.houses(progressedJd, latitude, longitude, 'P');
    if (houseResult) {
      progressedHouses = {
        ascendant: houseResult.ascendant,
        mc: houseResult.mc,
        cusps: houseResult.cusps
      };
    }
  }

  return {
    birthJd,
    progressedJd,
    yearsProgressed: yearsElapsed.toFixed(2),
    targetDate: targetDate.toISOString().split('T')[0],
    planets: progressedPlanets,
    lunarPhase: progressedLunarPhase,
    houses: progressedHouses
  };
}

/**
 * Find the prenatal Solar Eclipse before a birth date
 * @param {number} birthJd - Birth Julian Day
 * @param {number} latitude - Birth latitude
 * @param {number} longitude - Birth longitude
 * @returns {object} - Prenatal solar eclipse data
 */
function findPrenatalSolarEclipse(birthJd, latitude = 0, longitude = 0) {
  // Search backwards for solar eclipse
  // sweph.sol_eclipse_when_glob finds eclipses
  // We need to search before birthJd

  let searchJd = birthJd;
  let eclipse = null;

  // Search up to 2 years back (solar eclipses happen ~2-5 times per year)
  const maxSearchDays = 730;
  let searchAttempts = 0;
  const maxAttempts = 10;

  while (!eclipse && searchAttempts < maxAttempts) {
    try {
      // Search for previous solar eclipse
      const result = sweph.sol_eclipse_when_glob(
        searchJd,
        SEFLG_SWIEPH,
        SE_ECL_ALLTYPES_SOLAR,
        true // backward search
      );

      if (result && result.tret && result.tret[0] < birthJd) {
        const eclipseJd = result.tret[0];
        const eclipseDate = sweph.revjul(eclipseJd, SE_GREG_CAL);

        // Get Sun position at eclipse time
        const sunPos = sweph.calc(eclipseJd, PLANETS.SUN, SEFLG_SWIEPH);
        const sunLng = sunPos.data ? sunPos.data[0] : 0;

        // Determine eclipse type
        let eclipseType = 'Solar Eclipse';
        if (result.attr) {
          if (result.attr[0] > 0.99) eclipseType = 'Total Solar Eclipse';
          else if (result.attr[0] > 0.9) eclipseType = 'Annular Solar Eclipse';
          else eclipseType = 'Partial Solar Eclipse';
        }

        eclipse = {
          type: eclipseType,
          date: `${eclipseDate.year}-${String(eclipseDate.month).padStart(2, '0')}-${String(Math.floor(eclipseDate.day)).padStart(2, '0')}`,
          julianDay: eclipseJd,
          daysBeforeBirth: Math.floor(birthJd - eclipseJd),
          position: {
            longitude: sunLng,
            sign: getZodiacSign(sunLng),
            degree: (sunLng % 30).toFixed(2)
          },
          significance: 'Prenatal solar eclipses indicate karmic life themes and soul purpose'
        };
        break;
      }

      searchJd -= 180; // Go back 6 months
      searchAttempts++;
    } catch (err) {
      // If eclipse calculation fails, try manual search
      searchJd -= 180;
      searchAttempts++;
    }
  }

  if (!eclipse) {
    // Fallback: calculate approximate eclipse using New Moon search
    eclipse = findApproximatePrenatalEclipse(birthJd, 'solar');
  }

  return eclipse || { error: 'Could not find prenatal solar eclipse', available: false };
}

/**
 * Find the prenatal Lunar Eclipse before a birth date
 * @param {number} birthJd - Birth Julian Day
 * @returns {object} - Prenatal lunar eclipse data
 */
function findPrenatalLunarEclipse(birthJd) {
  let searchJd = birthJd;
  let eclipse = null;
  let searchAttempts = 0;
  const maxAttempts = 10;

  while (!eclipse && searchAttempts < maxAttempts) {
    try {
      // Search for previous lunar eclipse
      const result = sweph.lun_eclipse_when(
        searchJd,
        SEFLG_SWIEPH,
        SE_ECL_ALLTYPES_LUNAR,
        true // backward search
      );

      if (result && result.tret && result.tret[0] < birthJd) {
        const eclipseJd = result.tret[0];
        const eclipseDate = sweph.revjul(eclipseJd, SE_GREG_CAL);

        // Get Moon position at eclipse time
        const moonPos = sweph.calc(eclipseJd, PLANETS.MOON, SEFLG_SWIEPH);
        const moonLng = moonPos.data ? moonPos.data[0] : 0;

        // Determine eclipse type
        let eclipseType = 'Lunar Eclipse';
        if (result.attr) {
          if (result.attr[0] > 1.0) eclipseType = 'Total Lunar Eclipse';
          else if (result.attr[0] > 0) eclipseType = 'Partial Lunar Eclipse';
          else eclipseType = 'Penumbral Lunar Eclipse';
        }

        eclipse = {
          type: eclipseType,
          date: `${eclipseDate.year}-${String(eclipseDate.month).padStart(2, '0')}-${String(Math.floor(eclipseDate.day)).padStart(2, '0')}`,
          julianDay: eclipseJd,
          daysBeforeBirth: Math.floor(birthJd - eclipseJd),
          position: {
            longitude: moonLng,
            sign: getZodiacSign(moonLng),
            degree: (moonLng % 30).toFixed(2)
          },
          significance: 'Prenatal lunar eclipses indicate emotional patterns and subconscious themes'
        };
        break;
      }

      searchJd -= 180;
      searchAttempts++;
    } catch (err) {
      searchJd -= 180;
      searchAttempts++;
    }
  }

  if (!eclipse) {
    eclipse = findApproximatePrenatalEclipse(birthJd, 'lunar');
  }

  return eclipse || { error: 'Could not find prenatal lunar eclipse', available: false };
}

/**
 * Fallback: Find approximate prenatal eclipse by searching for Sun-Moon alignments
 * @param {number} birthJd
 * @param {string} type - 'solar' or 'lunar'
 * @returns {object|null}
 */
function findApproximatePrenatalEclipse(birthJd, type) {
  // Search backwards in ~14 day increments (half lunar cycle)
  let searchJd = birthJd - 1;
  const maxDays = 400;

  while (birthJd - searchJd < maxDays) {
    const sunPos = sweph.calc(searchJd, PLANETS.SUN, SEFLG_SWIEPH);
    const moonPos = sweph.calc(searchJd, PLANETS.MOON, SEFLG_SWIEPH);
    const nodePos = sweph.calc(searchJd, PLANETS.NORTH_NODE, SEFLG_SWIEPH);

    const sunLng = sunPos.data ? sunPos.data[0] : 0;
    const moonLng = moonPos.data ? moonPos.data[0] : 0;
    const nodeLng = nodePos.data ? nodePos.data[0] : 0;

    // Check proximity to nodes (eclipses happen near nodes)
    const sunNodeDist = Math.min(
      Math.abs(normalizeAngle(sunLng - nodeLng)),
      Math.abs(normalizeAngle(sunLng - (nodeLng + 180)))
    );

    if (type === 'solar') {
      // Solar eclipse = New Moon near node
      const sunMoonDist = Math.abs(normalizeAngle(sunLng - moonLng));
      if (sunMoonDist < 5 && sunNodeDist < 18) {
        const date = sweph.revjul(searchJd, SE_GREG_CAL);
        return {
          type: 'Solar Eclipse (approximate)',
          date: `${date.year}-${String(date.month).padStart(2, '0')}-${String(Math.floor(date.day)).padStart(2, '0')}`,
          julianDay: searchJd,
          daysBeforeBirth: Math.floor(birthJd - searchJd),
          position: {
            longitude: sunLng,
            sign: getZodiacSign(sunLng),
            degree: (sunLng % 30).toFixed(2)
          },
          significance: 'Prenatal solar eclipses indicate karmic life themes'
        };
      }
    } else {
      // Lunar eclipse = Full Moon near node
      const sunMoonDist = Math.abs(normalizeAngle(sunLng - moonLng));
      if (Math.abs(sunMoonDist - 180) < 5 && sunNodeDist < 18) {
        const date = sweph.revjul(searchJd, SE_GREG_CAL);
        return {
          type: 'Lunar Eclipse (approximate)',
          date: `${date.year}-${String(date.month).padStart(2, '0')}-${String(Math.floor(date.day)).padStart(2, '0')}`,
          julianDay: searchJd,
          daysBeforeBirth: Math.floor(birthJd - searchJd),
          position: {
            longitude: moonLng,
            sign: getZodiacSign(moonLng),
            degree: (moonLng % 30).toFixed(2)
          },
          significance: 'Prenatal lunar eclipses indicate emotional patterns'
        };
      }
    }

    searchJd -= 1; // Search day by day
  }

  return null;
}

/**
 * Calculate planetary phases (synodic cycles)
 * Useful for Mars-Sun phase, Saturn-Jupiter phase, etc.
 *
 * @param {object} planets - Object with planet longitudes
 * @returns {object} - Planetary phase data
 */
function calculatePlanetaryPhases(planets) {
  const phases = {};

  // Mars-Sun Phase (important for action/drive)
  if (planets.mars && planets.sun) {
    const marsSunAngle = normalizeAngle(planets.mars.longitude - planets.sun.longitude);
    phases.marsSun = {
      angle: marsSunAngle.toFixed(2),
      phase: getPlanetaryPhaseName(marsSunAngle),
      description: getMarsSunDescription(marsSunAngle)
    };
  }

  // Saturn-Jupiter Phase (20-year social cycle)
  if (planets.saturn && planets.jupiter) {
    const satJupAngle = normalizeAngle(planets.saturn.longitude - planets.jupiter.longitude);
    phases.saturnJupiter = {
      angle: satJupAngle.toFixed(2),
      phase: getPlanetaryPhaseName(satJupAngle),
      description: getSaturnJupiterDescription(satJupAngle)
    };
  }

  // Venus-Mars Phase (relationship dynamics)
  if (planets.venus && planets.mars) {
    const venMarAngle = normalizeAngle(planets.venus.longitude - planets.mars.longitude);
    phases.venusMars = {
      angle: venMarAngle.toFixed(2),
      phase: getPlanetaryPhaseName(venMarAngle),
      description: getVenusMarsDescription(venMarAngle)
    };
  }

  // Mercury-Sun Phase (mind-identity relationship)
  if (planets.mercury && planets.sun) {
    const mercSunAngle = normalizeAngle(planets.mercury.longitude - planets.sun.longitude);
    // Mercury is always within ~28° of Sun
    phases.mercurySun = {
      angle: mercSunAngle.toFixed(2),
      isMorningStar: mercSunAngle > 180 || mercSunAngle < 28,
      isEveningStar: mercSunAngle >= 28 && mercSunAngle <= 180,
      description: mercSunAngle > 180 || mercSunAngle < 28
        ? 'Mercury as Morning Star - spontaneous, intuitive thinking'
        : 'Mercury as Evening Star - deliberate, reflective thinking'
    };
  }

  return phases;
}

/**
 * Get phase name based on angle
 * @param {number} angle
 * @returns {string}
 */
function getPlanetaryPhaseName(angle) {
  if (angle < 45) return 'New Phase';
  if (angle < 90) return 'Crescent Phase';
  if (angle < 135) return 'First Quarter';
  if (angle < 180) return 'Gibbous Phase';
  if (angle < 225) return 'Full Phase';
  if (angle < 270) return 'Disseminating Phase';
  if (angle < 315) return 'Last Quarter';
  return 'Balsamic Phase';
}

/**
 * Get Mars-Sun phase description
 * @param {number} angle
 * @returns {string}
 */
function getMarsSunDescription(angle) {
  if (angle < 45) return 'Initiating new actions, instinctive drive, pioneering energy';
  if (angle < 90) return 'Building momentum, testing limits, growing confidence in action';
  if (angle < 135) return 'Action meets resistance, decision point, proving oneself';
  if (angle < 180) return 'Refining approach, preparing for culmination, strategic action';
  if (angle < 225) return 'Maximum visibility of efforts, actions have impact, recognition';
  if (angle < 270) return 'Sharing results, teaching through action, demonstrating mastery';
  if (angle < 315) return 'Reassessing direction, letting go of ineffective actions';
  return 'Completing cycle, resting before new action, integrating lessons';
}

/**
 * Get Saturn-Jupiter phase description
 * @param {number} angle
 * @returns {string}
 */
function getSaturnJupiterDescription(angle) {
  if (angle < 45) return 'New social/economic cycle beginning, seeding new structures';
  if (angle < 90) return 'Growth meets resistance, testing new social forms';
  if (angle < 135) return 'Crisis of action in social sphere, commitment required';
  if (angle < 180) return 'Refining social structures, preparing for manifestation';
  if (angle < 225) return 'Full expression of social cycle, maximum structure/growth balance';
  if (angle < 270) return 'Distributing social gains, sharing wisdom gained';
  if (angle < 315) return 'Crisis of consciousness, questioning social structures';
  return 'Releasing old social forms, preparing for new cycle';
}

/**
 * Get Venus-Mars phase description
 * @param {number} angle
 * @returns {string}
 */
function getVenusMarsDescription(angle) {
  if (angle < 45) return 'New relationship dynamics emerging, fresh attraction';
  if (angle < 90) return 'Building connection, testing compatibility';
  if (angle < 135) return 'Relationship challenges, defining boundaries';
  if (angle < 180) return 'Refining partnership dynamics, deepening connection';
  if (angle < 225) return 'Full expression of relationship, balance of give/take';
  if (angle < 270) return 'Sharing relationship wisdom, nurturing others';
  if (angle < 315) return 'Reassessing relationship patterns, releasing what doesn\'t work';
  return 'Completing relationship cycle, preparing for new connections';
}

/**
 * Calculate current transits to natal positions
 * @param {object} natalChart - Natal chart with planet positions
 * @param {Date} transitDate - Date to calculate transits for (default: now)
 * @returns {object} - Transit data
 */
function calculateTransits(natalChart, transitDate = new Date()) {
  const transitJd = dateToJulianDay(
    transitDate.getFullYear(),
    transitDate.getMonth() + 1,
    transitDate.getDate(),
    transitDate.getHours(),
    transitDate.getMinutes()
  );

  // Get current planetary positions
  const transitPlanets = {};
  const flag = SEFLG_SWIEPH | SEFLG_SPEED;

  for (const [name, id] of Object.entries(PLANETS)) {
    const result = sweph.calc(transitJd, id, flag);
    if (result.flag >= 0 && result.data) {
      const [lng, lat, dist, lngSpeed] = result.data;
      transitPlanets[name.toLowerCase()] = {
        longitude: lng,
        sign: getZodiacSign(lng),
        isRetrograde: lngSpeed < 0
      };
    }
  }

  // Find aspects between transit and natal planets
  const aspects = [];
  const aspectTypes = [
    { name: 'Conjunction', angle: 0, orb: 8 },
    { name: 'Opposition', angle: 180, orb: 8 },
    { name: 'Trine', angle: 120, orb: 6 },
    { name: 'Square', angle: 90, orb: 6 },
    { name: 'Sextile', angle: 60, orb: 4 }
  ];

  const natalPlanets = natalChart.planets || natalChart;

  for (const [transitName, transitPos] of Object.entries(transitPlanets)) {
    for (const [natalName, natalPos] of Object.entries(natalPlanets)) {
      if (!natalPos || !natalPos.longitude) continue;

      const diff = Math.abs(normalizeAngle(transitPos.longitude - natalPos.longitude));

      for (const aspect of aspectTypes) {
        const orbDiff = Math.abs(diff - aspect.angle);
        const orbDiff2 = Math.abs((360 - diff) - aspect.angle);
        const actualOrb = Math.min(orbDiff, orbDiff2);

        if (actualOrb <= aspect.orb) {
          aspects.push({
            transit: transitName,
            natal: natalName,
            aspect: aspect.name,
            orb: actualOrb.toFixed(2),
            exact: actualOrb < 1,
            applying: isApplying(transitPos, natalPos, aspect.angle),
            transitRetrograde: transitPos.isRetrograde,
            significance: getTransitSignificance(transitName, natalName, aspect.name)
          });
        }
      }
    }
  }

  // Sort by orb (tightest aspects first)
  aspects.sort((a, b) => parseFloat(a.orb) - parseFloat(b.orb));

  return {
    date: transitDate.toISOString().split('T')[0],
    transitPlanets,
    aspectsToNatal: aspects.slice(0, 20), // Top 20 closest aspects
    summary: generateTransitSummary(aspects)
  };
}

/**
 * Determine if aspect is applying or separating
 * @param {object} transitPos
 * @param {object} natalPos
 * @param {number} aspectAngle
 * @returns {boolean}
 */
function isApplying(transitPos, natalPos, aspectAngle) {
  // Simplified: if transit is moving toward exact aspect, it's applying
  const currentDiff = normalizeAngle(transitPos.longitude - natalPos.longitude);
  const isRetro = transitPos.isRetrograde;

  // This is a simplification - proper applying/separating needs speed comparison
  if (aspectAngle === 0) {
    return isRetro ? currentDiff > 0 && currentDiff < 180 : currentDiff < 180;
  }
  return true; // Default to applying for simplicity
}

/**
 * Get transit significance description
 * @param {string} transit
 * @param {string} natal
 * @param {string} aspect
 * @returns {string}
 */
function getTransitSignificance(transit, natal, aspect) {
  const transitMeanings = {
    saturn: 'structure, responsibility, lessons',
    jupiter: 'expansion, opportunity, growth',
    mars: 'energy, action, conflict',
    venus: 'relationships, values, pleasure',
    mercury: 'communication, thinking, travel',
    sun: 'vitality, purpose, recognition',
    moon: 'emotions, needs, daily life',
    uranus: 'sudden change, awakening, freedom',
    neptune: 'spirituality, dissolution, dreams',
    pluto: 'transformation, power, rebirth'
  };

  const natalMeanings = {
    sun: 'core identity',
    moon: 'emotional nature',
    mercury: 'mind and communication',
    venus: 'love and values',
    mars: 'drive and action',
    jupiter: 'growth and beliefs',
    saturn: 'structure and limits',
    uranus: 'individuality',
    neptune: 'spirituality',
    pluto: 'transformation'
  };

  const transitKey = transit.toLowerCase();
  const natalKey = natal.toLowerCase();

  return `${transitMeanings[transitKey] || transit} affecting ${natalMeanings[natalKey] || natal} (${aspect})`;
}

/**
 * Generate summary of current transits
 * @param {Array} aspects
 * @returns {string}
 */
function generateTransitSummary(aspects) {
  if (aspects.length === 0) return 'No major transits currently active.';

  const exact = aspects.filter(a => a.exact);
  const tight = aspects.filter(a => parseFloat(a.orb) < 2);

  let summary = '';
  if (exact.length > 0) {
    summary += `Exact transits: ${exact.map(a => `${a.transit} ${a.aspect} natal ${a.natal}`).join(', ')}. `;
  }
  if (tight.length > 0 && tight.length !== exact.length) {
    summary += `Close transits: ${tight.slice(0, 5).map(a => `${a.transit} ${a.aspect} natal ${a.natal}`).join(', ')}.`;
  }

  return summary || 'Several transits active with moderate orbs.';
}

/**
 * Get zodiac sign from longitude
 * @param {number} longitude
 * @returns {string}
 */
function getZodiacSign(longitude) {
  const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Scorpio',
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  const signIndex = Math.floor(longitude / 30) % 12;
  return signs[signIndex];
}

/**
 * Convert decimal degrees to DMS format
 * @param {number} decimal
 * @returns {string}
 */
function degreesToDMS(decimal) {
  const sign = getZodiacSign(decimal);
  const inSign = decimal % 30;
  const degrees = Math.floor(inSign);
  const minutesDecimal = (inSign - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.floor((minutesDecimal - minutes) * 60);

  return `${degrees}°${sign} ${minutes}'${seconds}"`;
}

module.exports = {
  calculateLunarPhase,
  calculateProgressedChart,
  findPrenatalSolarEclipse,
  findPrenatalLunarEclipse,
  calculatePlanetaryPhases,
  calculateTransits,
  dateToJulianDay,
  normalizeAngle,
  getZodiacSign,
  LUNAR_PHASES,
  PLANETS
};
