/**
 * Google Drive Routes
 * Handles template access and file operations
 */

import express from 'express';
import googleDrive from '../services/googleDrive.js';

const router = express.Router();

/**
 * GET /api/v1/drive/folders
 * List available template folders
 */
router.get('/folders', async (req, res) => {
  try {
    const folders = await googleDrive.listTemplateFolders();

    res.json({
      success: true,
      data: {
        folders,
        count: folders.length
      }
    });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list folders'
    });
  }
});

/**
 * GET /api/v1/drive/files/:folderId
 * List files in a specific folder
 */
router.get('/files/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { category, pageToken, pageSize } = req.query;

    const result = await googleDrive.listFilesInFolder(folderId, {
      category,
      pageToken,
      pageSize: parseInt(pageSize) || 100
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list files'
    });
  }
});

/**
 * GET /api/v1/drive/file/:fileId
 * Get file metadata and optionally content
 */
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { includeContent, exportFormat } = req.query;

    const file = await googleDrive.getFile(fileId, {
      includeContent: includeContent === 'true',
      exportFormat
    });

    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file'
    });
  }
});

/**
 * POST /api/v1/drive/copy/:fileId
 * Copy a template to user's workspace
 */
router.post('/copy/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { customName } = req.body;

    const copy = await googleDrive.copyTemplate(
      fileId,
      req.user.id,
      customName
    );

    res.json({
      success: true,
      data: copy
    });
  } catch (error) {
    console.error('Copy file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to copy file'
    });
  }
});

/**
 * GET /api/v1/drive/search
 * Search files across all template folders
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, limit } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }

    const result = await googleDrive.searchFiles(q, {
      category,
      pageSize: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

/**
 * GET /api/v1/drive/categories
 * Get template categories
 */
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: googleDrive.TEMPLATE_CATEGORIES
    }
  });
});

export default router;
