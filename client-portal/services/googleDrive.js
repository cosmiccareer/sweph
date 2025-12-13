/**
 * Google Drive Service
 * Handles all interactions with Google Drive API
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Google Cloud Project at https://console.cloud.google.com/
 * 2. Enable Google Drive API and Google Docs API
 * 3. Create a Service Account and download JSON key
 * 4. Share your Drive folders with the service account email
 * 5. Set environment variables (see .env.example)
 */

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

// Folder IDs for course content (set these in .env)
const FOLDER_IDS = {
  // Main course templates folder
  CCBBB_MAIN: process.env.GOOGLE_DRIVE_FOLDER_CCBBB_MAIN || '',
  // Secondary folder (ccbbb 2.0)
  CCBBB_V2: process.env.GOOGLE_DRIVE_FOLDER_CCBBB_V2 || '',
  // User workspace folder (where copies go)
  USER_WORKSPACE: process.env.GOOGLE_DRIVE_FOLDER_WORKSPACE || ''
};

// Template categories mapping
const TEMPLATE_CATEGORIES = {
  'business-plan': {
    name: 'Business Plan',
    description: 'Templates for creating your astrologically-aligned business plan',
    icon: 'briefcase'
  },
  'branding': {
    name: 'Branding Board',
    description: 'Visual branding templates and guides',
    icon: 'palette'
  },
  'marketing': {
    name: 'Marketing Materials',
    description: 'Marketing strategy and content templates',
    icon: 'megaphone'
  },
  'finance': {
    name: 'Financial Planning',
    description: 'Budget, pricing, and financial projection templates',
    icon: 'calculator'
  },
  'astro-guides': {
    name: 'Astrology Guides',
    description: 'Guides for interpreting your chart for business',
    icon: 'stars'
  },
  'worksheets': {
    name: 'Worksheets',
    description: 'Interactive worksheets and exercises',
    icon: 'clipboard'
  }
};

// =============================================================================
// GOOGLE DRIVE CLIENT INITIALIZATION
// =============================================================================

let driveClient = null;
let docsClient = null;

/**
 * Initialize Google API clients
 * Supports both Service Account (server-side) and OAuth (user-specific)
 */
async function initializeClients() {
  if (driveClient && docsClient) {
    return { drive: driveClient, docs: docsClient };
  }

  try {
    let auth;

    // Option 1: Service Account (recommended for server-side)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/documents.readonly'
        ]
      });
    }
    // Option 2: Service Account from file
    else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/documents.readonly'
        ]
      });
    }
    // Option 3: API Key (limited functionality)
    else if (process.env.GOOGLE_API_KEY) {
      auth = process.env.GOOGLE_API_KEY;
    }
    else {
      throw new Error('No Google authentication configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_FILE');
    }

    driveClient = google.drive({ version: 'v3', auth });
    docsClient = google.docs({ version: 'v1', auth });

    console.log('Google API clients initialized successfully');
    return { drive: driveClient, docs: docsClient };
  } catch (error) {
    console.error('Failed to initialize Google API clients:', error.message);
    throw error;
  }
}

// =============================================================================
// FOLDER OPERATIONS
// =============================================================================

/**
 * List all available template folders
 */
export async function listTemplateFolders() {
  const { drive } = await initializeClients();

  const folders = [];

  for (const [key, folderId] of Object.entries(FOLDER_IDS)) {
    if (!folderId || key === 'USER_WORKSPACE') continue;

    try {
      const response = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, description, createdTime, modifiedTime'
      });

      folders.push({
        id: response.data.id,
        name: response.data.name,
        key: key,
        description: response.data.description || '',
        modifiedTime: response.data.modifiedTime
      });
    } catch (error) {
      console.error(`Failed to get folder ${key}:`, error.message);
    }
  }

  return folders;
}

/**
 * List files in a folder with optional filtering
 */
export async function listFilesInFolder(folderId, options = {}) {
  const { drive } = await initializeClients();

  const {
    mimeType = null,      // Filter by MIME type
    category = null,      // Filter by category (from name/description)
    pageSize = 100,
    pageToken = null,
    includeSubfolders = true
  } = options;

  let query = `'${folderId}' in parents and trashed = false`;

  if (mimeType) {
    query += ` and mimeType = '${mimeType}'`;
  }

  try {
    const response = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, description, size, createdTime, modifiedTime, thumbnailLink, webViewLink, iconLink)',
      pageSize,
      pageToken,
      orderBy: 'name'
    });

    let files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      description: file.description || '',
      size: file.size,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      thumbnailLink: file.thumbnailLink,
      webViewLink: file.webViewLink,
      iconLink: file.iconLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      category: detectCategory(file.name, file.description)
    }));

    // Filter by category if specified
    if (category) {
      files = files.filter(f => f.category === category);
    }

    // Recursively get subfolders if requested
    if (includeSubfolders) {
      const subfolders = files.filter(f => f.isFolder);
      for (const subfolder of subfolders) {
        const subfiles = await listFilesInFolder(subfolder.id, {
          ...options,
          includeSubfolders: false
        });
        files = files.concat(subfiles.files.map(f => ({
          ...f,
          parentFolder: subfolder.name
        })));
      }
    }

    return {
      files,
      nextPageToken: response.data.nextPageToken
    };
  } catch (error) {
    console.error('Failed to list files:', error.message);
    throw error;
  }
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get file metadata and content
 */
export async function getFile(fileId, options = {}) {
  const { drive, docs } = await initializeClients();

  const { includeContent = false, exportFormat = null } = options;

  try {
    // Get metadata
    const metadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, description, size, createdTime, modifiedTime, webViewLink, thumbnailLink, parents'
    });

    const file = {
      id: metadata.data.id,
      name: metadata.data.name,
      mimeType: metadata.data.mimeType,
      description: metadata.data.description,
      size: metadata.data.size,
      createdTime: metadata.data.createdTime,
      modifiedTime: metadata.data.modifiedTime,
      webViewLink: metadata.data.webViewLink,
      thumbnailLink: metadata.data.thumbnailLink,
      category: detectCategory(metadata.data.name, metadata.data.description)
    };

    // Get content if requested
    if (includeContent) {
      if (metadata.data.mimeType === 'application/vnd.google-apps.document') {
        // Google Docs - get structured content
        const docContent = await docs.documents.get({ documentId: fileId });
        file.content = extractTextFromDoc(docContent.data);
        file.structuredContent = docContent.data.body;
      } else if (exportFormat) {
        // Export to requested format
        const exported = await drive.files.export({
          fileId,
          mimeType: exportFormat
        });
        file.content = exported.data;
      }
    }

    return file;
  } catch (error) {
    console.error('Failed to get file:', error.message);
    throw error;
  }
}

/**
 * Copy a template file for a user
 */
export async function copyTemplate(fileId, userId, customName = null) {
  const { drive } = await initializeClients();

  try {
    // Get original file info
    const original = await drive.files.get({
      fileId,
      fields: 'name, mimeType'
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const newName = customName || `${original.data.name} - ${userId} - ${timestamp}`;

    // Copy the file
    const copied = await drive.files.copy({
      fileId,
      requestBody: {
        name: newName,
        parents: FOLDER_IDS.USER_WORKSPACE ? [FOLDER_IDS.USER_WORKSPACE] : undefined
      }
    });

    return {
      id: copied.data.id,
      name: copied.data.name,
      originalId: fileId,
      originalName: original.data.name,
      mimeType: original.data.mimeType,
      webViewLink: `https://docs.google.com/document/d/${copied.data.id}/edit`
    };
  } catch (error) {
    console.error('Failed to copy template:', error.message);
    throw error;
  }
}

/**
 * Search files across all template folders
 */
export async function searchFiles(query, options = {}) {
  const { drive } = await initializeClients();

  const { category = null, pageSize = 50 } = options;

  // Build search query for all template folders
  const folderQueries = Object.entries(FOLDER_IDS)
    .filter(([key, id]) => id && key !== 'USER_WORKSPACE')
    .map(([_, id]) => `'${id}' in parents`);

  if (folderQueries.length === 0) {
    return { files: [] };
  }

  let searchQuery = `(${folderQueries.join(' or ')}) and trashed = false`;
  searchQuery += ` and (name contains '${query}' or fullText contains '${query}')`;

  try {
    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, mimeType, description, modifiedTime, webViewLink, thumbnailLink)',
      pageSize,
      orderBy: 'modifiedTime desc'
    });

    let files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      description: file.description || '',
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      thumbnailLink: file.thumbnailLink,
      category: detectCategory(file.name, file.description)
    }));

    if (category) {
      files = files.filter(f => f.category === category);
    }

    return { files };
  } catch (error) {
    console.error('Failed to search files:', error.message);
    throw error;
  }
}

// =============================================================================
// TEMPLATE-SPECIFIC OPERATIONS
// =============================================================================

/**
 * Get all templates organized by category
 */
export async function getTemplatesByCategory() {
  const templates = {};

  // Initialize categories
  for (const [key, info] of Object.entries(TEMPLATE_CATEGORIES)) {
    templates[key] = {
      ...info,
      templates: []
    };
  }

  // Get files from all folders
  for (const [folderKey, folderId] of Object.entries(FOLDER_IDS)) {
    if (!folderId || folderKey === 'USER_WORKSPACE') continue;

    try {
      const { files } = await listFilesInFolder(folderId);

      for (const file of files) {
        if (!file.isFolder) {
          const category = file.category || 'worksheets';
          if (templates[category]) {
            templates[category].templates.push({
              id: file.id,
              name: file.name,
              description: file.description,
              mimeType: file.mimeType,
              source: folderKey
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to get templates from ${folderKey}:`, error.message);
    }
  }

  return templates;
}

/**
 * Generate a personalized document from template
 */
export async function generatePersonalizedDocument(templateId, userData) {
  const { drive, docs } = await initializeClients();

  try {
    // Copy the template
    const copy = await copyTemplate(templateId, userData.userId,
      `${userData.businessName || 'My'} Business Plan - ${userData.name}`
    );

    // Get the copied document
    const doc = await docs.documents.get({ documentId: copy.id });

    // Prepare replacement data
    const replacements = buildReplacementMap(userData);

    // Create batch update requests
    const requests = [];
    for (const [placeholder, value] of Object.entries(replacements)) {
      requests.push({
        replaceAllText: {
          containsText: {
            text: `{{${placeholder}}}`,
            matchCase: false
          },
          replaceText: value || ''
        }
      });
    }

    // Execute replacements
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: copy.id,
        requestBody: { requests }
      });
    }

    return {
      ...copy,
      personalized: true,
      replacementCount: requests.length
    };
  } catch (error) {
    console.error('Failed to generate personalized document:', error.message);
    throw error;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect template category from name/description
 */
function detectCategory(name, description = '') {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes('business plan') || text.includes('business-plan')) {
    return 'business-plan';
  }
  if (text.includes('brand') || text.includes('logo') || text.includes('color')) {
    return 'branding';
  }
  if (text.includes('market') || text.includes('social') || text.includes('content')) {
    return 'marketing';
  }
  if (text.includes('financ') || text.includes('budget') || text.includes('pricing')) {
    return 'finance';
  }
  if (text.includes('astro') || text.includes('chart') || text.includes('zodiac') || text.includes('natal')) {
    return 'astro-guides';
  }

  return 'worksheets';
}

/**
 * Extract plain text from Google Doc structure
 */
function extractTextFromDoc(docData) {
  let text = '';

  if (docData.body && docData.body.content) {
    for (const element of docData.body.content) {
      if (element.paragraph) {
        for (const textElement of element.paragraph.elements || []) {
          if (textElement.textRun) {
            text += textElement.textRun.content;
          }
        }
      }
    }
  }

  return text;
}

/**
 * Build replacement map for template personalization
 */
function buildReplacementMap(userData) {
  const { astroData = {}, userInfo = {} } = userData;

  return {
    // User info
    'USER_NAME': userInfo.name || '',
    'USER_EMAIL': userInfo.email || '',
    'BUSINESS_NAME': userInfo.businessName || '',
    'BUSINESS_DESCRIPTION': userInfo.businessDescription || '',

    // Astrology data
    'SUN_SIGN': astroData.sunSign || '',
    'MOON_SIGN': astroData.moonSign || '',
    'RISING_SIGN': astroData.risingSign || '',
    'VENUS_SIGN': astroData.venusSign || '',
    'MARS_SIGN': astroData.marsSign || '',
    'MC_SIGN': astroData.mcSign || '',

    // Venus Star Point
    'VSP_SIGN': astroData.vspSign || '',
    'VSP_GIFT': astroData.vspGift || '',

    // Mars Phase
    'MARS_PHASE': astroData.marsPhase || '',
    'MARS_PHASE_MEANING': astroData.marsPhaseMeaning || '',

    // Ikigai insights
    'IKIGAI_PASSION': astroData.ikigaiPassion || '',
    'IKIGAI_VOCATION': astroData.ikigaiVocation || '',
    'IKIGAI_MISSION': astroData.ikigaiMission || '',
    'IKIGAI_PROFESSION': astroData.ikigaiProfession || '',
    'BUSINESS_IDEAS': (astroData.businessIdeas || []).join(', '),

    // House placements
    'SECOND_HOUSE': astroData.secondHouse || '',
    'SIXTH_HOUSE': astroData.sixthHouse || '',
    'TENTH_HOUSE': astroData.tenthHouse || '',

    // Timestamps
    'DATE': new Date().toLocaleDateString(),
    'YEAR': new Date().getFullYear().toString()
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  initializeClients,
  listTemplateFolders,
  listFilesInFolder,
  getFile,
  copyTemplate,
  searchFiles,
  getTemplatesByCategory,
  generatePersonalizedDocument,
  FOLDER_IDS,
  TEMPLATE_CATEGORIES
};
