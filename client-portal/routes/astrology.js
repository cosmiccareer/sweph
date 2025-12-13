/**
 * Astrology Routes
 * Bridge to existing /sweph astrology API with user data management
 */

import express from 'express';
import { getDb } from '../services/database.js';
import { fetchAstrologyData, fetchIkigaiAnalysis } from '../services/astrology.js';

const router = express.Router();

/**
 * GET /api/v1/astrology/profile
 * Get user's complete astrology profile
 */
router.get('/profile', async (req, res) => {
  try {
    const db = getDb();

    // Get user's birth data
    const userResult = await db.query(
      'SELECT birth_data, astrology_cache, cache_updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Check if we have birth data
    if (!user.birth_data || !user.birth_data.year) {
      return res.json({
        success: true,
        data: {
          hasBirthData: false,
          message: 'Please enter your birth data to see your astrology profile'
        }
      });
    }

    // Check if cache is fresh (within 24 hours)
    const cacheAge = user.cache_updated_at
      ? Date.now() - new Date(user.cache_updated_at).getTime()
      : Infinity;
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    let astroData;

    if (user.astrology_cache && cacheAge < CACHE_TTL) {
      astroData = user.astrology_cache;
    } else {
      // Fetch fresh data
      astroData = await fetchAstrologyData(user.birth_data);

      // Update cache
      await db.query(
        `UPDATE users SET astrology_cache = $1, cache_updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(astroData), req.user.id]
      );
    }

    res.json({
      success: true,
      data: {
        hasBirthData: true,
        birthData: user.birth_data,
        ...astroData
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get astrology profile'
    });
  }
});

/**
 * POST /api/v1/astrology/calculate
 * Calculate natal chart (and optionally save)
 */
router.post('/calculate', async (req, res) => {
  try {
    const { birthData, save } = req.body;

    // Validate birth data
    const required = ['year', 'month', 'day', 'hour', 'minute', 'latitude', 'longitude', 'timezone'];
    for (const field of required) {
      if (birthData[field] === undefined || birthData[field] === null) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }

    // Calculate chart
    const astroData = await fetchAstrologyData(birthData);

    // Save if requested
    if (save) {
      const db = getDb();
      await db.query(
        `UPDATE users SET
           birth_data = $1,
           astrology_cache = $2,
           cache_updated_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(birthData), JSON.stringify(astroData), req.user.id]
      );
    }

    res.json({
      success: true,
      data: {
        saved: !!save,
        ...astroData
      }
    });
  } catch (error) {
    console.error('Calculate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate chart'
    });
  }
});

/**
 * GET /api/v1/astrology/ikigai
 * Get Ikigai analysis for user
 */
router.get('/ikigai', async (req, res) => {
  try {
    const db = getDb();

    const userResult = await db.query(
      'SELECT birth_data FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const birthData = userResult.rows[0].birth_data;

    if (!birthData || !birthData.year) {
      return res.json({
        success: true,
        data: {
          hasBirthData: false,
          message: 'Please enter your birth data for Ikigai analysis'
        }
      });
    }

    const ikigai = await fetchIkigaiAnalysis(birthData);

    res.json({
      success: true,
      data: {
        hasBirthData: true,
        ...ikigai
      }
    });
  } catch (error) {
    console.error('Ikigai error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ikigai analysis'
    });
  }
});

/**
 * GET /api/v1/astrology/business-insights
 * Get business-oriented astrological insights
 */
router.get('/business-insights', async (req, res) => {
  try {
    const db = getDb();

    const userResult = await db.query(
      'SELECT birth_data, astrology_cache FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].birth_data) {
      return res.json({
        success: true,
        data: {
          hasBirthData: false,
          message: 'Please enter your birth data for business insights'
        }
      });
    }

    const birthData = userResult.rows[0].birth_data;

    // Get full astrology data
    let astroData = userResult.rows[0].astrology_cache;
    if (!astroData) {
      astroData = await fetchAstrologyData(birthData);
    }

    // Extract business-relevant insights
    const insights = generateBusinessInsights(astroData);

    res.json({
      success: true,
      data: {
        hasBirthData: true,
        insights
      }
    });
  } catch (error) {
    console.error('Business insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get business insights'
    });
  }
});

/**
 * PUT /api/v1/astrology/birth-data
 * Update user's birth data
 */
router.put('/birth-data', async (req, res) => {
  try {
    const { birthData } = req.body;

    // Validate
    const required = ['year', 'month', 'day', 'hour', 'minute', 'latitude', 'longitude', 'timezone'];
    for (const field of required) {
      if (birthData[field] === undefined) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }

    const db = getDb();

    // Update birth data and clear cache
    await db.query(
      `UPDATE users SET
         birth_data = $1,
         astrology_cache = NULL,
         cache_updated_at = NULL
       WHERE id = $2`,
      [JSON.stringify(birthData), req.user.id]
    );

    res.json({
      success: true,
      message: 'Birth data updated'
    });
  } catch (error) {
    console.error('Update birth data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update birth data'
    });
  }
});

/**
 * Generate business-oriented insights from astrology data
 */
function generateBusinessInsights(astroData) {
  const insights = {
    strengths: [],
    challenges: [],
    recommendations: [],
    idealClients: [],
    pricingStyle: '',
    marketingApproach: ''
  };

  if (!astroData) return insights;

  // Venus Star Point insights
  if (astroData.vsp) {
    insights.strengths.push({
      source: 'Venus Star Point',
      sign: astroData.vsp.sign,
      insight: `Your natural gift for ${astroData.vsp.gift || 'connection'} is a core business asset`
    });
  }

  // Mars Phase insights
  if (astroData.marsPhase) {
    insights.recommendations.push({
      source: 'Mars Phase',
      phase: astroData.marsPhase.phase,
      insight: `Your ${astroData.marsPhase.phase} Mars phase suggests ${astroData.marsPhase.meaning || 'a strategic approach to action'}`
    });
  }

  // Ikigai insights
  if (astroData.ikigai) {
    if (astroData.ikigai.businessIdeas) {
      insights.recommendations.push({
        source: 'Ikigai Analysis',
        insight: 'Business ideas aligned with your cosmic blueprint',
        ideas: astroData.ikigai.businessIdeas
      });
    }
  }

  // House-based insights
  if (astroData.houses) {
    // 2nd house for income
    if (astroData.houses[2]) {
      insights.pricingStyle = `With ${astroData.houses[2].sign} on your 2nd house, consider ${getHouseInsight(2, astroData.houses[2].sign)}`;
    }

    // 10th house for career/reputation
    if (astroData.houses[10]) {
      insights.marketingApproach = `With ${astroData.houses[10].sign} on your 10th house, your public image benefits from ${getHouseInsight(10, astroData.houses[10].sign)}`;
    }
  }

  return insights;
}

/**
 * Get house-specific insight based on sign
 */
function getHouseInsight(house, sign) {
  const insights = {
    2: {
      'Aries': 'bold, premium pricing that reflects your pioneering value',
      'Taurus': 'steady, value-based pricing with quality justification',
      'Gemini': 'flexible pricing tiers and communication-based services',
      'Cancer': 'nurturing packages that feel safe and supportive',
      'Leo': 'luxury positioning with generous high-touch offerings',
      'Virgo': 'detailed, results-oriented pricing with clear deliverables',
      'Libra': 'balanced pricing with partnership and retainer options',
      'Scorpio': 'transformational pricing for deep, intensive work',
      'Sagittarius': 'expansive offerings with educational components',
      'Capricorn': 'professional, structured pricing with clear ROI',
      'Aquarius': 'innovative pricing models and community offerings',
      'Pisces': 'intuitive, sliding scale or spiritually-aligned pricing'
    },
    10: {
      'Aries': 'bold leadership and being first in your field',
      'Taurus': 'consistent quality and reliable reputation',
      'Gemini': 'versatile communication and thought leadership',
      'Cancer': 'nurturing brand presence and emotional connection',
      'Leo': 'visible leadership and creative self-expression',
      'Virgo': 'expertise, precision, and helpful service',
      'Libra': 'aesthetic beauty and collaborative partnerships',
      'Scorpio': 'depth, transformation, and powerful presence',
      'Sagittarius': 'inspiration, education, and big-picture vision',
      'Capricorn': 'authority, professionalism, and proven results',
      'Aquarius': 'innovation, uniqueness, and community impact',
      'Pisces': 'creativity, intuition, and spiritual connection'
    }
  };

  return insights[house]?.[sign] || 'an authentic approach';
}

export default router;
