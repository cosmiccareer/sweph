/**
 * Venus Star Point Calculation Service
 *
 * Calculates the prenatal Venus Star Point (Venus-Sun conjunction before birth)
 * and the full Venus Star (5-point star pattern).
 */

const fs = require('fs');
const path = require('path');

// Load VSP dates data
const vspDataPath = path.join(__dirname, '../data/vsp-dates.json');
let vspData = { data: [] };

try {
  vspData = JSON.parse(fs.readFileSync(vspDataPath, 'utf8'));
} catch (err) {
  console.warn('VSP dates file not found:', err.message);
}

// Load VSP interpretations if available
const vspInterpPath = path.join(__dirname, '../data/vsp-interpretations.json');
let vspInterpretations = {};

try {
  vspInterpretations = JSON.parse(fs.readFileSync(vspInterpPath, 'utf8'));
} catch (err) {
  // Interpretations are optional
}

/**
 * Parse a date string to Date object
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Date}
 */
function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z');
}

/**
 * Format a Date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Find the index of the closest VSP date before or on the given date
 * @param {Date} targetDate - The date to search from
 * @param {boolean} beforeOnly - If true, only return dates strictly before target
 * @returns {number} - Index in vspData.data array, or -1 if not found
 */
function findPrenatalVSPIndex(targetDate, beforeOnly = true) {
  const targetTime = targetDate.getTime();

  for (let i = vspData.data.length - 1; i >= 0; i--) {
    const vspDate = parseDate(vspData.data[i].date);
    const vspTime = vspDate.getTime();

    if (beforeOnly) {
      if (vspTime < targetTime) {
        return i;
      }
    } else {
      if (vspTime <= targetTime) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Find the index of the first VSP date after the given date
 * @param {Date} targetDate - The date to search from
 * @returns {number} - Index in vspData.data array, or -1 if not found
 */
function findPostnatalVSPIndex(targetDate) {
  const targetTime = targetDate.getTime();

  for (let i = 0; i < vspData.data.length; i++) {
    const vspDate = parseDate(vspData.data[i].date);
    if (vspDate.getTime() > targetTime) {
      return i;
    }
  }

  return -1;
}

/**
 * Get interpretation for a Venus Star Point sign
 * @param {string} sign - Zodiac sign
 * @param {string} type - Morning Star or Evening Star
 * @returns {object|null}
 */
function getVSPInterpretation(sign, type) {
  if (!vspInterpretations.signs) return null;

  const signInterp = vspInterpretations.signs[sign];
  if (!signInterp) return null;

  return {
    greatestAssets: signInterp.greatestAssets || null,
    greatestLiabilities: signInterp.greatestLiabilities || null,
    venusGift: signInterp.venusGift || null,
    starType: type // Morning Star or Evening Star
  };
}

/**
 * Calculate the prenatal Venus Star Point
 * @param {number} year - Birth year
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @param {number} hour - Birth hour (optional, for edge cases)
 * @param {number} minute - Birth minute (optional)
 * @returns {object} - VSP data
 */
function calculatePrenatalVSP(year, month, day, hour = 12, minute = 0) {
  const birthDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // For dates on the same day as a VSP, check time if provided
  // Otherwise, use the VSP before the birth date
  const prenatalIndex = findPrenatalVSPIndex(birthDate, true);

  if (prenatalIndex < 0) {
    return {
      error: 'Birth date is before available VSP data (starts 1901)',
      available: false
    };
  }

  const vsp = vspData.data[prenatalIndex];
  const interpretation = getVSPInterpretation(vsp.sign, vsp.type);

  return {
    date: vsp.date,
    position: vsp.position,
    type: vsp.type,
    sign: vsp.sign,
    interpretation: interpretation,
    daysBeforeBirth: Math.floor((birthDate.getTime() - parseDate(vsp.date).getTime()) / (1000 * 60 * 60 * 24))
  };
}

/**
 * Calculate the full Venus Star (5-point star pattern)
 *
 * The Venus Star consists of:
 * - Venus Star Point: The immediate prenatal VSP
 * - Left Arm: Second VSP before birth
 * - Right Arm: Third VSP before birth
 * - Left Leg: First VSP after birth
 * - Right Leg: Second VSP after birth
 *
 * @param {number} year - Birth year
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @param {number} hour - Birth hour (optional)
 * @param {number} minute - Birth minute (optional)
 * @returns {object} - Full Venus Star data
 */
function calculateVenusStar(year, month, day, hour = 12, minute = 0) {
  const birthDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Find the prenatal VSP index
  const prenatalIndex = findPrenatalVSPIndex(birthDate, true);

  if (prenatalIndex < 0) {
    return {
      error: 'Birth date is before available VSP data',
      available: false
    };
  }

  // Find the first postnatal VSP index
  const postnatalIndex = findPostnatalVSPIndex(birthDate);

  // Build the Venus Star
  const venusStar = {
    birthDate: formatDate(birthDate),
    available: true,
    points: {}
  };

  // Venus Star Point (immediate prenatal - the "top" of the star)
  if (prenatalIndex >= 0) {
    const vsp = vspData.data[prenatalIndex];
    venusStar.points.venusStarPoint = {
      position: 'top',
      description: 'Your core Venus Star Point - the primary Venus-Sun conjunction before birth',
      date: vsp.date,
      positionDegree: vsp.position,
      type: vsp.type,
      sign: vsp.sign,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  // Left Arm (second VSP before birth)
  if (prenatalIndex >= 1) {
    const vsp = vspData.data[prenatalIndex - 1];
    venusStar.points.leftArm = {
      position: 'left-arm',
      description: 'Left arm of your Venus Star - secondary prenatal influence',
      date: vsp.date,
      positionDegree: vsp.position,
      type: vsp.type,
      sign: vsp.sign,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  // Right Arm (third VSP before birth)
  if (prenatalIndex >= 2) {
    const vsp = vspData.data[prenatalIndex - 2];
    venusStar.points.rightArm = {
      position: 'right-arm',
      description: 'Right arm of your Venus Star - tertiary prenatal influence',
      date: vsp.date,
      positionDegree: vsp.position,
      type: vsp.type,
      sign: vsp.sign,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  // Left Leg (first VSP after birth)
  if (postnatalIndex >= 0 && postnatalIndex < vspData.data.length) {
    const vsp = vspData.data[postnatalIndex];
    venusStar.points.leftLeg = {
      position: 'left-leg',
      description: 'Left leg of your Venus Star - first postnatal activation',
      date: vsp.date,
      positionDegree: vsp.position,
      type: vsp.type,
      sign: vsp.sign,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  // Right Leg (second VSP after birth)
  if (postnatalIndex >= 0 && postnatalIndex + 1 < vspData.data.length) {
    const vsp = vspData.data[postnatalIndex + 1];
    venusStar.points.rightLeg = {
      position: 'right-leg',
      description: 'Right leg of your Venus Star - second postnatal activation',
      date: vsp.date,
      positionDegree: vsp.position,
      type: vsp.type,
      sign: vsp.sign,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  // Calculate the signs pattern
  const signs = [];
  if (venusStar.points.rightArm) signs.push(venusStar.points.rightArm.sign);
  if (venusStar.points.leftArm) signs.push(venusStar.points.leftArm.sign);
  if (venusStar.points.venusStarPoint) signs.push(venusStar.points.venusStarPoint.sign);
  if (venusStar.points.leftLeg) signs.push(venusStar.points.leftLeg.sign);
  if (venusStar.points.rightLeg) signs.push(venusStar.points.rightLeg.sign);

  venusStar.signPattern = signs;

  // Determine the dominant element in the Venus Star
  const elementCount = { fire: 0, earth: 0, air: 0, water: 0 };
  const signElements = {
    'Aries': 'fire', 'Leo': 'fire', 'Sagittarius': 'fire',
    'Taurus': 'earth', 'Virgo': 'earth', 'Capricorn': 'earth',
    'Gemini': 'air', 'Libra': 'air', 'Aquarius': 'air',
    'Cancer': 'water', 'Scorpio': 'water', 'Pisces': 'water'
  };

  signs.forEach(sign => {
    const element = signElements[sign];
    if (element) elementCount[element]++;
  });

  const dominantElement = Object.entries(elementCount)
    .sort((a, b) => b[1] - a[1])[0];

  venusStar.dominantElement = {
    element: dominantElement[0],
    count: dominantElement[1],
    total: signs.length
  };

  return venusStar;
}

/**
 * Get all VSP dates within a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array}
 */
function getVSPsInRange(startDate, endDate) {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return vspData.data.filter(vsp => {
    const vspTime = parseDate(vsp.date).getTime();
    return vspTime >= startTime && vspTime <= endTime;
  });
}

/**
 * Get the next upcoming VSP from today
 * @returns {object}
 */
function getNextVSP() {
  const today = new Date();
  const index = findPostnatalVSPIndex(today);

  if (index >= 0 && index < vspData.data.length) {
    const vsp = vspData.data[index];
    const vspDate = parseDate(vsp.date);
    const daysUntil = Math.ceil((vspDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...vsp,
      daysUntil,
      interpretation: getVSPInterpretation(vsp.sign, vsp.type)
    };
  }

  return null;
}

module.exports = {
  calculatePrenatalVSP,
  calculateVenusStar,
  getVSPsInRange,
  getNextVSP,
  findPrenatalVSPIndex,
  findPostnatalVSPIndex
};
