/**
 * Progress Routes
 * Track user course progress and completed documents
 */

import express from 'express';
import { getDb } from '../services/database.js';

const router = express.Router();

/**
 * GET /api/v1/progress
 * Get user's course progress
 */
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT module_id, status, started_at, completed_at, notes
       FROM user_progress
       WHERE user_id = $1
       ORDER BY module_id`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        modules: result.rows,
        summary: {
          completed: result.rows.filter(r => r.status === 'completed').length,
          inProgress: result.rows.filter(r => r.status === 'in_progress').length,
          notStarted: result.rows.filter(r => r.status === 'not_started').length
        }
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get progress'
    });
  }
});

/**
 * POST /api/v1/progress/:moduleId
 * Update module progress
 */
router.post('/:moduleId', async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['not_started', 'in_progress', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const db = getDb();

    // Upsert progress
    const result = await db.query(
      `INSERT INTO user_progress (user_id, module_id, status, started_at, completed_at, notes, updated_at)
       VALUES ($1, $2, $3,
               CASE WHEN $3 = 'in_progress' OR $3 = 'completed' THEN NOW() ELSE NULL END,
               CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END,
               $4, NOW())
       ON CONFLICT (user_id, module_id) DO UPDATE SET
         status = $3,
         started_at = COALESCE(user_progress.started_at, EXCLUDED.started_at),
         completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE user_progress.completed_at END,
         notes = COALESCE($4, user_progress.notes),
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, moduleId, status || 'in_progress', notes]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update progress'
    });
  }
});

/**
 * GET /api/v1/progress/documents
 * Get user's generated documents
 */
router.get('/documents', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT id, template_id, document_id, document_name, created_at
       FROM user_documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        documents: result.rows,
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get documents'
    });
  }
});

/**
 * GET /api/v1/progress/summary
 * Get progress summary with stats
 */
router.get('/summary', async (req, res) => {
  try {
    const db = getDb();

    const [progress, documents] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) as count
         FROM user_progress
         WHERE user_id = $1
         GROUP BY status`,
        [req.user.id]
      ),
      db.query(
        `SELECT COUNT(*) as count
         FROM user_documents
         WHERE user_id = $1`,
        [req.user.id]
      )
    ]);

    const statusCounts = {};
    for (const row of progress.rows) {
      statusCounts[row.status] = parseInt(row.count);
    }

    res.json({
      success: true,
      data: {
        modules: {
          completed: statusCounts.completed || 0,
          inProgress: statusCounts.in_progress || 0,
          notStarted: statusCounts.not_started || 0,
          total: Object.values(statusCounts).reduce((a, b) => a + b, 0)
        },
        documents: {
          generated: parseInt(documents.rows[0]?.count) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary'
    });
  }
});

export default router;
