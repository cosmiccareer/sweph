/**
 * Ikigai Analysis Service
 *
 * Maps natal chart placements to the Ikigai framework:
 * - What You Love (Passion)
 * - What You're Good At (Vocation)
 * - What The World Needs (Mission)
 * - What You Can Be Paid For (Profession)
 */

const fs = require('fs');
const path = require('path');

// Load data files
const ikigaiMapping = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/ikigai-mapping.json'), 'utf8')
);
const ikigaiInterpretations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/ikigai-interpretations.json'), 'utf8')
);

/**
 * Get planet-in-sign interpretation
 * @param {string} planet - Planet name (lowercase)
 * @param {string} sign - Zodiac sign
 * @returns {object|null}
 */
function getPlanetInSignInterpretation(planet, sign) {
  const planetData = ikigaiInterpretations.planetInSign[planet];
  if (!planetData) return null;
  return planetData[sign] || null;
}

/**
 * Get planet-in-house interpretation
 * @param {string} planet - Planet name (lowercase)
 * @param {number} house - House number (1-12)
 * @returns {object|null}
 */
function getPlanetInHouseInterpretation(planet, house) {
  const planetData = ikigaiInterpretations.planetInHouse[planet];
  if (!planetData) return null;
  return planetData[String(house)] || null;
}

/**
 * Get North Node interpretation
 * @param {string} sign - Zodiac sign
 * @param {number} house - House number
 * @returns {object}
 */
function getNorthNodeInterpretation(sign, house) {
  return {
    signMeaning: ikigaiInterpretations.northNodeInSign[sign] || null,
    houseMeaning: ikigaiInterpretations.northNodeInHouse[String(house)] || null
  };
}

/**
 * Determine which house a planet is in based on house cusps
 * @param {number} planetLongitude - Planet's ecliptic longitude
 * @param {Array} houseCusps - Array of house cusp longitudes
 * @returns {number} - House number (1-12)
 */
function getHouseForPlanet(planetLongitude, houseCusps) {
  // Normalize longitude to 0-360
  const lng = ((planetLongitude % 360) + 360) % 360;

  for (let i = 0; i < 12; i++) {
    const currentCusp = houseCusps[i];
    const nextCusp = houseCusps[(i + 1) % 12];

    // Handle wrap-around at 0 degrees
    if (nextCusp < currentCusp) {
      if (lng >= currentCusp || lng < nextCusp) {
        return i + 1;
      }
    } else {
      if (lng >= currentCusp && lng < nextCusp) {
        return i + 1;
      }
    }
  }

  return 1; // Default to first house
}

/**
 * Analyze a natal chart through the Ikigai framework
 * @param {object} chart - Natal chart data with planets and houses
 * @returns {object} - Ikigai analysis
 */
function analyzeIkigai(chart) {
  const planets = chart.planets || {};
  const houses = chart.houses || {};
  const houseCusps = houses.cusps || [];

  const analysis = {
    whatYouLove: {
      title: 'What You Love',
      description: ikigaiMapping.ikigaiComponents.whatYouLove.description,
      primaryInfluences: [],
      insights: []
    },
    whatYoureGoodAt: {
      title: 'What You\'re Good At',
      description: ikigaiMapping.ikigaiComponents.whatYoureGoodAt.description,
      primaryInfluences: [],
      insights: []
    },
    whatTheWorldNeeds: {
      title: 'What The World Needs',
      description: ikigaiMapping.ikigaiComponents.whatTheWorldNeeds.description,
      primaryInfluences: [],
      insights: []
    },
    whatYouCanBePaidFor: {
      title: 'What You Can Be Paid For',
      description: ikigaiMapping.ikigaiComponents.whatYouCanBePaidFor.description,
      primaryInfluences: [],
      insights: []
    }
  };

  // Process each Ikigai component
  for (const [componentKey, component] of Object.entries(ikigaiMapping.ikigaiComponents)) {
    const analysisSection = analysis[componentKey];
    if (!analysisSection) continue;

    // Analyze primary planets for this component
    for (const planetName of component.primaryPlanets) {
      const planet = planets[planetName];
      if (!planet) continue;

      const sign = planet.sign;
      const house = houseCusps.length > 0
        ? getHouseForPlanet(planet.longitude, houseCusps)
        : planet.house || null;

      const signInterp = getPlanetInSignInterpretation(planetName, sign);
      const houseInterp = house ? getPlanetInHouseInterpretation(planetName, house) : null;

      const influence = {
        planet: planetName,
        sign,
        house,
        role: ikigaiMapping.planetaryRoles[planetName]?.role || planetName,
        question: ikigaiMapping.planetaryRoles[planetName]?.question || '',
        signInterpretation: signInterp,
        houseInterpretation: houseInterp
      };

      analysisSection.primaryInfluences.push(influence);

      // Generate insight
      if (signInterp) {
        analysisSection.insights.push({
          type: 'gift',
          text: `${capitalize(planetName)} in ${sign}: ${signInterp.gift}`
        });
        if (signInterp.shadow) {
          analysisSection.insights.push({
            type: 'shadow',
            text: `Watch for: ${signInterp.shadow}`
          });
        }
      }
    }

    // Analyze relevant houses
    for (const houseNum of component.primaryHouses) {
      const houseTheme = ikigaiMapping.houseSignificance[String(houseNum)];
      if (houseTheme) {
        analysisSection.insights.push({
          type: 'house',
          text: `House ${houseNum} themes: ${houseTheme.theme}`
        });
      }
    }
  }

  // Add North Node analysis (soul purpose)
  const northNode = planets.north_node || planets.northNode;
  if (northNode) {
    const nnSign = northNode.sign;
    const nnHouse = houseCusps.length > 0
      ? getHouseForPlanet(northNode.longitude, houseCusps)
      : northNode.house || null;

    analysis.soulPurpose = {
      title: 'Soul Purpose (North Node)',
      sign: nnSign,
      house: nnHouse,
      interpretation: getNorthNodeInterpretation(nnSign, nnHouse)
    };
  }

  // Calculate Ikigai intersections
  analysis.intersections = {
    passion: {
      name: 'Passion',
      description: 'Where What You Love meets What You\'re Good At',
      planets: findCommonPlanets(
        ikigaiMapping.ikigaiComponents.whatYouLove.primaryPlanets,
        ikigaiMapping.ikigaiComponents.whatYoureGoodAt.primaryPlanets,
        planets
      )
    },
    mission: {
      name: 'Mission',
      description: 'Where What You Love meets What The World Needs',
      planets: findCommonPlanets(
        ikigaiMapping.ikigaiComponents.whatYouLove.primaryPlanets,
        ikigaiMapping.ikigaiComponents.whatTheWorldNeeds.primaryPlanets,
        planets
      )
    },
    profession: {
      name: 'Profession',
      description: 'Where What You\'re Good At meets What You Can Be Paid For',
      planets: findCommonPlanets(
        ikigaiMapping.ikigaiComponents.whatYoureGoodAt.primaryPlanets,
        ikigaiMapping.ikigaiComponents.whatYouCanBePaidFor.primaryPlanets,
        planets
      )
    },
    vocation: {
      name: 'Vocation',
      description: 'Where What The World Needs meets What You Can Be Paid For',
      planets: findCommonPlanets(
        ikigaiMapping.ikigaiComponents.whatTheWorldNeeds.primaryPlanets,
        ikigaiMapping.ikigaiComponents.whatYouCanBePaidFor.primaryPlanets,
        planets
      )
    }
  };

  return analysis;
}

/**
 * Find planets that appear in both lists
 * @param {Array} list1 - First planet list
 * @param {Array} list2 - Second planet list
 * @param {object} planets - Actual planet positions
 * @returns {Array}
 */
function findCommonPlanets(list1, list2, planets) {
  const common = list1.filter(p => list2.includes(p));
  return common.map(p => ({
    planet: p,
    sign: planets[p]?.sign || 'Unknown',
    role: ikigaiMapping.planetaryRoles[p]?.role || p
  }));
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a summary narrative for the Ikigai analysis
 * @param {object} analysis - Ikigai analysis result
 * @returns {string}
 */
function generateIkigaiSummary(analysis) {
  const parts = [];

  // Soul purpose
  if (analysis.soulPurpose) {
    const sp = analysis.soulPurpose;
    parts.push(`Your soul's direction points toward ${sp.sign} themes${sp.house ? ` expressed through the ${sp.house}th house` : ''}.`);
  }

  // What you love
  const love = analysis.whatYouLove;
  if (love.primaryInfluences.length > 0) {
    const primary = love.primaryInfluences[0];
    parts.push(`What you love is shaped by ${primary.planet} in ${primary.sign}, giving you ${primary.signInterpretation?.gift || 'unique gifts'}.`);
  }

  // What you're good at
  const goodAt = analysis.whatYoureGoodAt;
  if (goodAt.primaryInfluences.length > 0) {
    const primary = goodAt.primaryInfluences[0];
    parts.push(`Your natural talents flow through ${primary.planet} in ${primary.sign}.`);
  }

  // Mission
  if (analysis.intersections?.mission?.planets?.length > 0) {
    const planet = analysis.intersections.mission.planets[0];
    parts.push(`Your mission bridges love and purpose through ${planet.planet}'s ${planet.role} energy.`);
  }

  return parts.join(' ');
}

/**
 * Get business idea suggestions based on Ikigai analysis
 * @param {object} analysis - Ikigai analysis
 * @returns {Array} - Business idea suggestions
 */
function suggestBusinessIdeas(analysis) {
  const suggestions = [];

  // Based on What You Love planets
  for (const influence of analysis.whatYouLove.primaryInfluences.slice(0, 2)) {
    const sign = influence.sign;
    const signTraits = getSignBusinessTraits(sign);
    if (signTraits) {
      suggestions.push({
        category: 'Passion-Based',
        idea: signTraits.businessIdea,
        basedOn: `${influence.planet} in ${sign}`
      });
    }
  }

  // Based on 10th house (career)
  for (const influence of analysis.whatYouCanBePaidFor.primaryInfluences) {
    if (influence.house === 10) {
      suggestions.push({
        category: 'Career-Aligned',
        idea: `Leadership role leveraging ${influence.sign} qualities`,
        basedOn: `${influence.planet} in 10th house`
      });
    }
  }

  return suggestions;
}

/**
 * Get business traits for a zodiac sign
 * @param {string} sign
 * @returns {object|null}
 */
function getSignBusinessTraits(sign) {
  const traits = {
    Aries: { businessIdea: 'Startup founder, fitness coaching, competitive sports business' },
    Taurus: { businessIdea: 'Luxury goods, financial planning, sustainable agriculture' },
    Gemini: { businessIdea: 'Content creation, education, communications consulting' },
    Cancer: { businessIdea: 'Home-based business, caregiving services, hospitality' },
    Leo: { businessIdea: 'Entertainment, personal branding, creative agency' },
    Virgo: { businessIdea: 'Health & wellness, organizational consulting, editing services' },
    Libra: { businessIdea: 'Design services, mediation, beauty industry' },
    Scorpio: { businessIdea: 'Research services, psychology practice, investment management' },
    Sagittarius: { businessIdea: 'Travel business, publishing, higher education' },
    Capricorn: { businessIdea: 'Management consulting, real estate, traditional business' },
    Aquarius: { businessIdea: 'Tech startup, social enterprise, innovation consulting' },
    Pisces: { businessIdea: 'Healing arts, creative arts, spiritual services' }
  };

  return traits[sign] || null;
}

module.exports = {
  analyzeIkigai,
  getPlanetInSignInterpretation,
  getPlanetInHouseInterpretation,
  getNorthNodeInterpretation,
  generateIkigaiSummary,
  suggestBusinessIdeas,
  getHouseForPlanet
};
