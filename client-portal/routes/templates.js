/**
 * Template Routes
 * Handles template browsing and personalized document generation
 */

import express from 'express';
import googleDrive from '../services/googleDrive.js';
import { getDb } from '../services/database.js';
import { fetchAstrologyData } from '../services/astrology.js';

const router = express.Router();

/**
 * GET /api/v1/templates
 * Get all templates organized by category
 */
router.get('/', async (req, res) => {
  try {
    const templates = await googleDrive.getTemplatesByCategory();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * GET /api/v1/templates/categories
 * Get template category list
 */
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: googleDrive.TEMPLATE_CATEGORIES
  });
});

/**
 * GET /api/v1/templates/:id
 * Get specific template details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await googleDrive.getFile(id, {
      includeContent: true
    });

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template'
    });
  }
});

/**
 * POST /api/v1/templates/:id/generate
 * Generate a personalized document from template
 */
router.post('/:id/generate', async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { businessName, businessDescription, customData } = req.body;

    const db = getDb();

    // Get user data
    const userResult = await db.query(
      'SELECT id, email, name, birth_data FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get user's astrology data
    let astroData = {};
    if (user.birth_data && user.birth_data.year) {
      try {
        astroData = await fetchAstrologyData(user.birth_data);
      } catch (astroError) {
        console.error('Astrology data fetch failed:', astroError);
        // Continue without astrology data
      }
    }

    // Generate personalized document
    const document = await googleDrive.generatePersonalizedDocument(templateId, {
      userId: req.user.id,
      userInfo: {
        name: user.name,
        email: user.email,
        businessName: businessName || '',
        businessDescription: businessDescription || ''
      },
      astroData,
      customData: customData || {}
    });

    // Save to user's document history
    await db.query(
      `INSERT INTO user_documents (user_id, template_id, document_id, document_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.user.id, templateId, document.id, document.name]
    );

    res.json({
      success: true,
      data: {
        document,
        astroDataUsed: Object.keys(astroData).length > 0
      }
    });
  } catch (error) {
    console.error('Generate document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate document'
    });
  }
});

/**
 * GET /api/v1/templates/:id/preview
 * Get template preview with sample data
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await googleDrive.getFile(id, {
      includeContent: true
    });

    // Return template structure with placeholder info
    const placeholders = [];
    if (template.content) {
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = placeholderRegex.exec(template.content)) !== null) {
        placeholders.push(match[1]);
      }
    }

    res.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        category: template.category,
        placeholders: [...new Set(placeholders)],
        preview: template.content ? template.content.substring(0, 1000) : null
      }
    });
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template'
    });
  }
});

export default router;
