/**
 * Mars Phase Calculation Service
 *
 * Calculates the prenatal Mars Phase based on the Mars cycle dates.
 * The Mars Phase represents where in the ~2 year Mars cycle a person was born.
 */

const fs = require('fs');
const path = require('path');

// Load Mars Phase dates data
const marsDataPath = path.join(__dirname, '../data/mars-phase-dates.json');
let marsData = { data: [], phases: [] };

try {
  marsData = JSON.parse(fs.readFileSync(marsDataPath, 'utf8'));
} catch (err) {
  console.warn('Mars Phase dates file not found:', err.message);
}

// Load Mars Phase interpretations if available
const marsInterpPath = path.join(__dirname, '../data/mars-phase-interpretations.json');
let marsInterpretations = {};

try {
  marsInterpretations = JSON.parse(fs.readFileSync(marsInterpPath, 'utf8'));
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
 * Find the index of the closest Mars Phase date before or on the given date
 * @param {Date} targetDate - The date to search from
 * @param {boolean} beforeOnly - If true, only return dates strictly before target
 * @returns {number} - Index in marsData.data array, or -1 if not found
 */
function findPrenatalMarsPhaseIndex(targetDate, beforeOnly = true) {
  const targetTime = targetDate.getTime();

  for (let i = marsData.data.length - 1; i >= 0; i--) {
    const marsDate = parseDate(marsData.data[i].date);
    const marsTime = marsDate.getTime();

    if (beforeOnly) {
      if (marsTime < targetTime) {
        return i;
      }
    } else {
      if (marsTime <= targetTime) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Get interpretation for a Mars Phase
 * @param {string} phase - Phase name (e.g., "Inception", "Maturity")
 * @param {string} cycle - Zodiac sign of the cycle (e.g., "Aries", "Taurus")
 * @returns {object|null}
 */
function getMarsPhaseInterpretation(phase, cycle) {
  if (!marsInterpretations.phases) return null;

  const phaseInterp = marsInterpretations.phases[phase];
  if (!phaseInterp) return null;

  return {
    phaseDescription: phaseInterp.description || null,
    cycleInfluence: phaseInterp.cycles?.[cycle] || null,
    keywords: phaseInterp.keywords || null
  };
}

/**
 * Calculate the prenatal Mars Phase
 * @param {number} year - Birth year
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @param {number} hour - Birth hour (optional)
 * @param {number} minute - Birth minute (optional)
 * @returns {object} - Mars Phase data
 */
function calculatePrenatalMarsPhase(year, month, day, hour = 12, minute = 0) {
  const birthDate = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const prenatalIndex = findPrenatalMarsPhaseIndex(birthDate, true);

  if (prenatalIndex < 0) {
    return {
      error: 'Birth date is before available Mars Phase data (starts 1902)',
      available: false
    };
  }

  const mars = marsData.data[prenatalIndex];
  const interpretation = getMarsPhaseInterpretation(mars.phase, mars.cycle);

  return {
    date: mars.date,
    cycle: mars.cycle,
    phase: mars.phase,
    interpretation: interpretation,
    daysBeforeBirth: Math.floor((birthDate.getTime() - parseDate(mars.date).getTime()) / (1000 * 60 * 60 * 24))
  };
}

/**
 * Get the full Mars cycle context for a birth date
 * This returns the current phase plus surrounding phases for context
 * @param {number} year - Birth year
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @returns {object} - Full Mars cycle context
 */
function getMarsCycleContext(year, month, day) {
  const birthDate = new Date(Date.UTC(year, month - 1, day, 12, 0));
  const prenatalIndex = findPrenatalMarsPhaseIndex(birthDate, true);

  if (prenatalIndex < 0) {
    return {
      error: 'Birth date is before available Mars Phase data',
      available: false
    };
  }

  const prenatalPhase = marsData.data[prenatalIndex];
  const currentCycle = prenatalPhase.cycle;

  // Find all phases in the same cycle
  const cyclePhases = [];
  let startIndex = prenatalIndex;

  // Go back to find the start of this cycle
  while (startIndex > 0 && marsData.data[startIndex - 1].cycle === currentCycle) {
    startIndex--;
  }

  // Collect all phases in this cycle
  let i = startIndex;
  while (i < marsData.data.length && marsData.data[i].cycle === currentCycle) {
    const phase = marsData.data[i];
    const phaseDate = parseDate(phase.date);
    cyclePhases.push({
      ...phase,
      isPrenatal: phaseDate.getTime() < birthDate.getTime(),
      isCurrentPhase: i === prenatalIndex,
      interpretation: getMarsPhaseInterpretation(phase.phase, phase.cycle)
    });
    i++;
  }

  // Calculate phase progression (where in the cycle the birth occurred)
  const cycleStart = parseDate(cyclePhases[0].date);
  const cycleEnd = cyclePhases.length > 0 ? parseDate(cyclePhases[cyclePhases.length - 1].date) : birthDate;
  const totalCycleDays = (cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
  const daysIntoCycle = (birthDate.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
  const cycleProgress = totalCycleDays > 0 ? Math.min(100, (daysIntoCycle / totalCycleDays) * 100) : 0;

  return {
    birthDate: formatDate(birthDate),
    available: true,
    currentCycle: currentCycle,
    prenatalPhase: {
      date: prenatalPhase.date,
      phase: prenatalPhase.phase,
      cycle: prenatalPhase.cycle,
      daysBeforeBirth: Math.floor((birthDate.getTime() - parseDate(prenatalPhase.date).getTime()) / (1000 * 60 * 60 * 24)),
      interpretation: getMarsPhaseInterpretation(prenatalPhase.phase, prenatalPhase.cycle)
    },
    cycleProgress: {
      percentage: cycleProgress.toFixed(1),
      daysIntoCycle: Math.floor(daysIntoCycle),
      totalCycleDays: Math.floor(totalCycleDays)
    },
    allPhasesInCycle: cyclePhases
  };
}

/**
 * Get all available Mars Phase names
 * @returns {Array}
 */
function getPhaseNames() {
  return marsData.phases || [
    "Inception",
    "Preparation",
    "Emergence",
    "Exploration",
    "Identity Challenge",
    "Maturity",
    "Transcendence",
    "Re-Orientation",
    "Resurgence",
    "Destiny Challenge",
    "Service",
    "Elder",
    "Transition"
  ];
}

/**
 * Get the next Mars Phase date from today
 * @returns {object}
 */
function getNextMarsPhase() {
  const today = new Date();
  const todayTime = today.getTime();

  for (let i = 0; i < marsData.data.length; i++) {
    const phaseDate = parseDate(marsData.data[i].date);
    if (phaseDate.getTime() > todayTime) {
      const daysUntil = Math.ceil((phaseDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));
      return {
        ...marsData.data[i],
        daysUntil,
        interpretation: getMarsPhaseInterpretation(marsData.data[i].phase, marsData.data[i].cycle)
      };
    }
  }

  return null;
}

module.exports = {
  calculatePrenatalMarsPhase,
  getMarsCycleContext,
  getMarsPhaseInterpretation,
  getPhaseNames,
  getNextMarsPhase,
  findPrenatalMarsPhaseIndex
};
