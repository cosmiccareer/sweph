/**
 * AI Chat Agent Service
 * Provides personalized guidance through the CCBBB course
 * Uses Claude API for intelligent, context-aware assistance
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { getDb } from './database.js';
import { fetchAstrologyData } from './astrology.js';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.CHAT_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

const SYSTEM_PROMPTS = {
  general: `You are the Cosmic Clarity Business Coach, an expert guide for the "Cosmic Clarity & Breakthrough Business Blueprint" course.

Your role is to help course participants:
1. Understand their astrological birth chart and how it relates to their business potential
2. Work through course modules step-by-step
3. Complete templates and worksheets with personalized guidance
4. Develop their business plan, branding, and marketing aligned with their cosmic blueprint

Key concepts you teach:
- Venus Star Point: Reveals natural gifts, talents, and what you're here to offer the world
- Mars Phase: Shows how to take action and build momentum in business
- Ikigai Framework: Combines passion, vocation, mission, and profession
- House placements: 2nd house (income), 6th house (service), 10th house (career/reputation)

Communication style:
- Warm, encouraging, and supportive
- Use astrology terminology but always explain it accessibly
- Give practical, actionable advice
- Reference specific course modules and templates when relevant
- Ask clarifying questions to provide personalized guidance

Remember: You're helping entrepreneurs build authentic businesses aligned with their cosmic blueprint.`,

  moduleGuide: `You are guiding a student through a specific module of the CCBBB course.

For each module interaction:
1. Explain the module's purpose and what they'll learn
2. Break down the exercises into manageable steps
3. Offer personalized insights based on their astrology
4. Help them complete any worksheets or templates
5. Celebrate their progress and connect learnings to their overall business vision

Be specific about next steps and encourage completion before moving on.`,

  templateHelper: `You are helping a student complete a specific template or worksheet.

Your approach:
1. Explain what the template is for and why it matters
2. Go through each section, explaining what information is needed
3. Use their astrological data to provide personalized suggestions
4. Offer examples relevant to their business type
5. Review their input and suggest improvements

Focus on practical completion while connecting to their cosmic blueprint.`,

  ikigaiCoach: `You are an Ikigai coach helping someone discover their purpose-driven business.

Guide them through the four elements:
1. What You Love (Passion) - Connect to their Moon, Venus, and 5th house
2. What You're Good At (Vocation) - Connect to their Mercury, Saturn, and 6th house
3. What The World Needs (Mission) - Connect to their Sun, North Node, and 10th house
4. What You Can Be Paid For (Profession) - Connect to their 2nd house and career indicators

Help them find the intersection that becomes their business sweet spot.`
};

// =============================================================================
// CHAT MANAGEMENT
// =============================================================================

/**
 * Process a chat message and return AI response
 */
export async function processMessage(userId, message, context = {}) {
  try {
    // Get user data and conversation history
    const db = getDb();
    const [userData, historyResult] = await Promise.all([
      getUserContext(userId),
      db.query(
        `SELECT role, content FROM chat_messages
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [userId]
      )
    ]);

    // Build conversation history (reverse to chronological order)
    const history = historyResult.rows.reverse().map(row => ({
      role: row.role,
      content: row.content
    }));

    // Determine which system prompt to use
    const systemPrompt = buildSystemPrompt(context, userData);

    // Build user context to include with message
    const contextualMessage = buildContextualMessage(message, userData, context);

    // Create messages array
    const messages = [
      ...history,
      { role: 'user', content: contextualMessage }
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages
    });

    const assistantMessage = response.content[0].text;

    // Save messages to database
    await Promise.all([
      db.query(
        `INSERT INTO chat_messages (user_id, role, content, context, created_at)
         VALUES ($1, 'user', $2, $3, NOW())`,
        [userId, message, JSON.stringify(context)]
      ),
      db.query(
        `INSERT INTO chat_messages (user_id, role, content, context, created_at)
         VALUES ($1, 'assistant', $2, $3, NOW())`,
        [userId, assistantMessage, JSON.stringify(context)]
      )
    ]);

    return {
      message: assistantMessage,
      context: context,
      tokensUsed: response.usage
    };
  } catch (error) {
    console.error('Chat processing error:', error);
    throw error;
  }
}

/**
 * Get user context for personalization
 */
async function getUserContext(userId) {
  const db = getDb();

  try {
    const result = await db.query(
      `SELECT u.*,
              json_agg(DISTINCT jsonb_build_object(
                'module_id', p.module_id,
                'status', p.status,
                'completed_at', p.completed_at
              )) FILTER (WHERE p.module_id IS NOT NULL) as progress
       FROM users u
       LEFT JOIN user_progress p ON u.id = p.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { birthData: null, progress: [], astroData: null };
    }

    const user = result.rows[0];
    let astroData = null;

    // Fetch fresh astrology data if birth data exists
    if (user.birth_data && user.birth_data.year) {
      try {
        astroData = await fetchAstrologyData(user.birth_data);
      } catch (error) {
        console.error('Failed to fetch astro data for context:', error);
      }
    }

    return {
      name: user.name,
      birthData: user.birth_data,
      astroData,
      progress: user.progress || [],
      businessName: user.settings?.businessName,
      businessType: user.settings?.businessType
    };
  } catch (error) {
    console.error('Get user context error:', error);
    return { birthData: null, progress: [], astroData: null };
  }
}

/**
 * Build system prompt based on context
 */
function buildSystemPrompt(context, userData) {
  let basePrompt = SYSTEM_PROMPTS.general;

  // Add context-specific prompts
  if (context.mode === 'module') {
    basePrompt += '\n\n' + SYSTEM_PROMPTS.moduleGuide;
  } else if (context.mode === 'template') {
    basePrompt += '\n\n' + SYSTEM_PROMPTS.templateHelper;
  } else if (context.mode === 'ikigai') {
    basePrompt += '\n\n' + SYSTEM_PROMPTS.ikigaiCoach;
  }

  // Add user's astrology summary if available
  if (userData.astroData) {
    basePrompt += `\n\n## This Student's Cosmic Blueprint:
${formatAstroSummary(userData.astroData)}`;
  }

  // Add progress context
  if (userData.progress && userData.progress.length > 0) {
    basePrompt += `\n\n## Course Progress:
${formatProgressSummary(userData.progress)}`;
  }

  return basePrompt;
}

/**
 * Build contextual message with relevant data
 */
function buildContextualMessage(message, userData, context) {
  let contextualMessage = message;

  // Add current module/template context
  if (context.moduleId) {
    contextualMessage += `\n\n[Context: Currently working on Module ${context.moduleId}: ${context.moduleName || ''}]`;
  }

  if (context.templateId) {
    contextualMessage += `\n\n[Context: Working with template: ${context.templateName || context.templateId}]`;
  }

  return contextualMessage;
}

/**
 * Format astrology data for prompt
 */
function formatAstroSummary(astroData) {
  if (!astroData) return 'Birth data not provided.';

  const parts = [];

  if (astroData.planets) {
    parts.push(`Sun: ${astroData.planets.sun?.sign || 'Unknown'}`);
    parts.push(`Moon: ${astroData.planets.moon?.sign || 'Unknown'}`);
    parts.push(`Rising: ${astroData.ascendant?.sign || 'Unknown'}`);
    parts.push(`Venus: ${astroData.planets.venus?.sign || 'Unknown'}`);
    parts.push(`Mars: ${astroData.planets.mars?.sign || 'Unknown'}`);
  }

  if (astroData.vsp) {
    parts.push(`Venus Star Point: ${astroData.vsp.sign || 'Unknown'}`);
  }

  if (astroData.marsPhase) {
    parts.push(`Mars Phase: ${astroData.marsPhase.phase || 'Unknown'}`);
  }

  if (astroData.ikigai) {
    parts.push(`\nIkigai Focus Areas:`);
    if (astroData.ikigai.passion) parts.push(`- Passion: ${astroData.ikigai.passion.primaryInsight || ''}`);
    if (astroData.ikigai.vocation) parts.push(`- Vocation: ${astroData.ikigai.vocation.primaryInsight || ''}`);
    if (astroData.ikigai.mission) parts.push(`- Mission: ${astroData.ikigai.mission.primaryInsight || ''}`);
    if (astroData.ikigai.profession) parts.push(`- Profession: ${astroData.ikigai.profession.primaryInsight || ''}`);
  }

  return parts.join('\n');
}

/**
 * Format progress summary for prompt
 */
function formatProgressSummary(progress) {
  if (!progress || progress.length === 0) {
    return 'Just getting started with the course.';
  }

  const completed = progress.filter(p => p.status === 'completed').length;
  const inProgress = progress.filter(p => p.status === 'in_progress').length;

  return `Completed ${completed} modules, ${inProgress} in progress.`;
}

// =============================================================================
// SPECIALIZED INTERACTIONS
// =============================================================================

/**
 * Get module guidance
 */
export async function getModuleGuidance(userId, moduleId) {
  const message = `I'm ready to work on this module. Can you guide me through what I'll be learning and doing?`;

  return processMessage(userId, message, {
    mode: 'module',
    moduleId
  });
}

/**
 * Get template help
 */
export async function getTemplateHelp(userId, templateId, templateName, section = null) {
  let message = `I need help completing this template.`;
  if (section) {
    message += ` Specifically, I'm working on the "${section}" section.`;
  }

  return processMessage(userId, message, {
    mode: 'template',
    templateId,
    templateName
  });
}

/**
 * Get Ikigai analysis discussion
 */
export async function discussIkigai(userId, focus = null) {
  let message = `Let's discuss my Ikigai analysis and what it means for my business.`;
  if (focus) {
    message += ` I want to focus on the "${focus}" aspect.`;
  }

  return processMessage(userId, message, {
    mode: 'ikigai'
  });
}

/**
 * Clear chat history for user
 */
export async function clearChatHistory(userId) {
  const db = getDb();
  await db.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
  return { cleared: true };
}

/**
 * Get chat history
 */
export async function getChatHistory(userId, limit = 50) {
  const db = getDb();
  const result = await db.query(
    `SELECT id, role, content, context, created_at
     FROM chat_messages
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.reverse();
}

export default {
  processMessage,
  getModuleGuidance,
  getTemplateHelp,
  discussIkigai,
  clearChatHistory,
  getChatHistory
};
