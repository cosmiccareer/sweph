/**
 * Astrology Service
 * Bridge to existing /sweph astrology API
 */

import dotenv from 'dotenv';

dotenv.config();

const ASTROLOGY_API_URL = process.env.ASTROLOGY_API_URL || 'http://127.0.0.1:3000';

/**
 * Fetch complete astrology data for birth data
 */
export async function fetchAstrologyData(birthData) {
  try {
    // Fetch comprehensive chart data
    const chartResponse = await fetch(`${ASTROLOGY_API_URL}/api/v1/chart/comprehensive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(birthData)
    });

    if (!chartResponse.ok) {
      throw new Error(`Chart API error: ${chartResponse.status}`);
    }

    const chartData = await chartResponse.json();

    // Extract and format the data
    const result = {
      chart: chartData.data.chart,
      planets: formatPlanets(chartData.data.chart?.planets),
      houses: formatHouses(chartData.data.chart?.houses),
      aspects: chartData.data.chart?.aspects,
      ascendant: chartData.data.chart?.angles?.ascendant,
      mc: chartData.data.chart?.angles?.mc,
      vsp: chartData.data.venusStar?.prenatalVSP,
      marsPhase: chartData.data.marsCycle?.prenatalPhase,
      ikigai: chartData.data.ikigai
    };

    // Add Venus Star Point interpretation
    if (result.vsp) {
      result.vsp.gift = getVspGift(result.vsp.sign);
    }

    // Add Mars Phase interpretation
    if (result.marsPhase) {
      result.marsPhase.meaning = getMarsPhaseeMeaning(result.marsPhase.phase);
    }

    return result;
  } catch (error) {
    console.error('Astrology API error:', error);
    throw error;
  }
}

/**
 * Fetch Ikigai analysis specifically
 */
export async function fetchIkigaiAnalysis(birthData) {
  try {
    const response = await fetch(`${ASTROLOGY_API_URL}/api/v1/ikigai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(birthData)
    });

    if (!response.ok) {
      throw new Error(`Ikigai API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Ikigai API error:', error);
    throw error;
  }
}

/**
 * Format planets data for easier use
 */
function formatPlanets(planets) {
  if (!planets) return null;

  const formatted = {};
  for (const planet of planets) {
    formatted[planet.name.toLowerCase()] = {
      sign: planet.sign,
      degree: planet.longitude,
      retrograde: planet.retrograde,
      house: planet.house
    };
  }
  return formatted;
}

/**
 * Format houses data for easier access
 */
function formatHouses(houses) {
  if (!houses) return null;

  const formatted = {};
  for (const house of houses) {
    formatted[house.number] = {
      sign: house.sign,
      degree: house.longitude
    };
  }
  return formatted;
}

/**
 * Get Venus Star Point gift by sign
 */
function getVspGift(sign) {
  const gifts = {
    'Aries': 'pioneering leadership and initiating new ventures',
    'Taurus': 'creating lasting value and sensory experiences',
    'Gemini': 'communication, teaching, and connecting ideas',
    'Cancer': 'nurturing, emotional intelligence, and creating safety',
    'Leo': 'creative self-expression and inspiring others',
    'Virgo': 'service, healing, and attention to detail',
    'Libra': 'creating harmony, beauty, and balanced relationships',
    'Scorpio': 'deep transformation and psychological insight',
    'Sagittarius': 'inspiring vision, teaching, and expansion',
    'Capricorn': 'building lasting structures and authority',
    'Aquarius': 'innovation, community, and progressive ideas',
    'Pisces': 'spiritual connection, creativity, and compassion'
  };
  return gifts[sign] || 'unique gifts aligned with your cosmic blueprint';
}

/**
 * Get Mars Phase meaning
 */
function getMarsPhaseeMeaning(phase) {
  const meanings = {
    'Inception': 'You are a natural initiator - your power comes from starting new things with bold vision.',
    'Development': 'You excel at building and developing ideas - steady progress is your strength.',
    'Manifestation': 'You are meant to bring things into physical form - results and tangible outcomes.',
    'Evaluation': 'Your wisdom lies in assessment and refinement - perfecting what exists.',
    'Revolution': 'You are here to transform and revolutionize - challenging the status quo.',
    'Transition': 'You bridge old and new - helping others through change is your gift.'
  };
  return meanings[phase] || 'Your Mars phase provides unique entrepreneurial guidance.';
}

/**
 * Get business-oriented chart summary
 */
export async function getBusinessSummary(birthData) {
  const data = await fetchAstrologyData(birthData);

  return {
    coreIdentity: {
      sun: data.planets?.sun,
      rising: data.ascendant,
      mc: data.mc
    },
    businessPotential: {
      venusStarPoint: data.vsp,
      marsPhase: data.marsPhase
    },
    ikigai: data.ikigai,
    keyHouses: {
      income: data.houses?.[2],
      service: data.houses?.[6],
      career: data.houses?.[10]
    }
  };
}

export default {
  fetchAstrologyData,
  fetchIkigaiAnalysis,
  getBusinessSummary
};
