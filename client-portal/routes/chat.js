/**
 * Chat Routes
 * AI-powered course guidance and assistance
 */

import express from 'express';
import chatAgent from '../services/chatAgent.js';

const router = express.Router();

/**
 * POST /api/v1/chat/message
 * Send a message to the AI assistant
 */
router.post('/message', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const response = await chatAgent.processMessage(
      req.user.id,
      message,
      context || {}
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * GET /api/v1/chat/history
 * Get chat history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit } = req.query;
    const history = await chatAgent.getChatHistory(
      req.user.id,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: {
        messages: history,
        count: history.length
      }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history'
    });
  }
});

/**
 * POST /api/v1/chat/module-guide
 * Get AI guidance for a specific module
 */
router.post('/module-guide', async (req, res) => {
  try {
    const { moduleId, moduleName } = req.body;

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Module ID is required'
      });
    }

    const response = await chatAgent.getModuleGuidance(
      req.user.id,
      moduleId
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Module guide error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get module guidance'
    });
  }
});

/**
 * POST /api/v1/chat/template-help
 * Get AI help for completing a template
 */
router.post('/template-help', async (req, res) => {
  try {
    const { templateId, templateName, section } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const response = await chatAgent.getTemplateHelp(
      req.user.id,
      templateId,
      templateName,
      section
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Template help error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template help'
    });
  }
});

/**
 * POST /api/v1/chat/ikigai
 * Discuss Ikigai analysis
 */
router.post('/ikigai', async (req, res) => {
  try {
    const { focus } = req.body;

    const response = await chatAgent.discussIkigai(
      req.user.id,
      focus
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Ikigai chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discuss Ikigai'
    });
  }
});

/**
 * DELETE /api/v1/chat/history
 * Clear chat history
 */
router.delete('/history', async (req, res) => {
  try {
    await chatAgent.clearChatHistory(req.user.id);

    res.json({
      success: true,
      message: 'Chat history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear history'
    });
  }
});

export default router;
