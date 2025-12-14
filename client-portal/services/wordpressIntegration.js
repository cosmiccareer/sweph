/**
 * WordPress Integration Service
 * Connects to WooCommerce and AcademyLMS for purchase verification and progress sync
 */

import dotenv from 'dotenv';

dotenv.config();

const WP_URL = process.env.WORDPRESS_URL || 'https://yourdomain.com';
const WP_API_KEY = process.env.WORDPRESS_API_KEY || '';
const WP_API_SECRET = process.env.WORDPRESS_API_SECRET || '';

// WooCommerce REST API credentials
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY || '';
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || '';

// AcademyLMS Course ID for CCBBB
const CCBBB_COURSE_ID = process.env.ACADEMYLMS_COURSE_ID || '';

/**
 * Module mapping: AcademyLMS lesson IDs to our module IDs
 * Update these IDs to match your actual AcademyLMS lesson/topic IDs
 */
const MODULE_MAPPING = {
  // Format: 'academylms_lesson_id': 'our_module_id'
  // These should be updated to match your actual course structure

  // Module 1: Foundation
  'lesson_1_1': 'module-1-intro',
  'lesson_1_2': 'module-1-mindset',
  'lesson_1_3': 'module-1-vision',

  // Module 2: Brand Identity
  'lesson_2_1': 'module-2-brand-essence',
  'lesson_2_2': 'module-2-visual-identity',
  'lesson_2_3': 'module-2-brand-voice',

  // Module 3: Astrology & Business
  'lesson_3_1': 'module-3-natal-chart',
  'lesson_3_2': 'module-3-venus-star',
  'lesson_3_3': 'module-3-mars-phase',

  // Module 4: Business Strategy
  'lesson_4_1': 'module-4-offerings',
  'lesson_4_2': 'module-4-pricing',
  'lesson_4_3': 'module-4-marketing',

  // Module 5: Launch
  'lesson_5_1': 'module-5-launch-plan',
  'lesson_5_2': 'module-5-visibility',
  'lesson_5_3': 'module-5-systems',
};

// Reverse mapping for lookup
const REVERSE_MODULE_MAPPING = Object.fromEntries(
  Object.entries(MODULE_MAPPING).map(([k, v]) => [v, k])
);

/**
 * Make authenticated request to WordPress REST API
 */
async function wpRequest(endpoint, options = {}) {
  const url = `${WP_URL}/wp-json${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  // Add Basic Auth if API key/secret provided
  if (WP_API_KEY && WP_API_SECRET) {
    const auth = Buffer.from(`${WP_API_KEY}:${WP_API_SECRET}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('WordPress API request failed:', error);
    throw error;
  }
}

/**
 * Make authenticated request to WooCommerce REST API
 */
async function wcRequest(endpoint, options = {}) {
  const url = new URL(`${WP_URL}/wp-json/wc/v3${endpoint}`);

  // Add WooCommerce authentication
  url.searchParams.set('consumer_key', WC_CONSUMER_KEY);
  url.searchParams.set('consumer_secret', WC_CONSUMER_SECRET);

  try {
    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('WooCommerce API request failed:', error);
    throw error;
  }
}

/**
 * Check if user has purchased the CCBBB course
 */
export async function verifyPurchase(email) {
  if (!WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
    console.warn('WooCommerce credentials not configured');
    return { verified: false, error: 'WooCommerce not configured' };
  }

  try {
    // Get customer by email
    const customers = await wcRequest(`/customers?email=${encodeURIComponent(email)}`);

    if (!customers || customers.length === 0) {
      return { verified: false, error: 'Customer not found' };
    }

    const customerId = customers[0].id;

    // Get customer's orders
    const orders = await wcRequest(`/orders?customer=${customerId}&status=completed`);

    // Check if any order contains the CCBBB course product
    const ccbbbProductIds = (process.env.CCBBB_PRODUCT_IDS || '').split(',').map(id => parseInt(id.trim()));

    const hasPurchased = orders.some(order =>
      order.line_items.some(item =>
        ccbbbProductIds.includes(item.product_id)
      )
    );

    if (hasPurchased) {
      return {
        verified: true,
        customerId,
        purchaseDate: orders.find(order =>
          order.line_items.some(item => ccbbbProductIds.includes(item.product_id))
        )?.date_created
      };
    }

    return { verified: false, error: 'Course not purchased' };
  } catch (error) {
    console.error('Purchase verification failed:', error);
    return { verified: false, error: error.message };
  }
}

/**
 * Get user's course progress from AcademyLMS
 */
export async function getAcademyProgress(wordpressUserId) {
  if (!CCBBB_COURSE_ID) {
    console.warn('AcademyLMS course ID not configured');
    return { success: false, error: 'AcademyLMS not configured' };
  }

  try {
    // AcademyLMS REST API endpoint for course progress
    // Note: Endpoint may vary based on AcademyLMS version
    const progress = await wpRequest(
      `/developer/v1/users/${wordpressUserId}/courses/${CCBBB_COURSE_ID}/progress`
    );

    return {
      success: true,
      data: progress
    };
  } catch (error) {
    // Try alternative endpoint structure
    try {
      const progress = await wpRequest(
        `/developer/v1/course-progress?user_id=${wordpressUserId}&course_id=${CCBBB_COURSE_ID}`
      );
      return {
        success: true,
        data: progress
      };
    } catch (altError) {
      console.error('Failed to get AcademyLMS progress:', altError);
      return { success: false, error: altError.message };
    }
  }
}

/**
 * Get completed lessons for a user from AcademyLMS
 */
export async function getCompletedLessons(wordpressUserId) {
  if (!CCBBB_COURSE_ID) {
    return { success: false, error: 'AcademyLMS not configured', lessons: [] };
  }

  try {
    // Get course curriculum/lessons
    const curriculum = await wpRequest(
      `/developer/v1/courses/${CCBBB_COURSE_ID}/curriculum`
    );

    // Get completion status for each lesson
    const completedLessons = [];

    if (curriculum && curriculum.topics) {
      for (const topic of curriculum.topics) {
        if (topic.lessons) {
          for (const lesson of topic.lessons) {
            try {
              const status = await wpRequest(
                `/developer/v1/lessons/${lesson.id}/completion?user_id=${wordpressUserId}`
              );

              if (status && status.completed) {
                completedLessons.push({
                  lessonId: lesson.id.toString(),
                  lessonTitle: lesson.title,
                  completedAt: status.completed_at,
                  topicId: topic.id,
                  topicTitle: topic.title
                });
              }
            } catch (e) {
              // Lesson completion check failed, skip
            }
          }
        }
      }
    }

    return {
      success: true,
      lessons: completedLessons
    };
  } catch (error) {
    console.error('Failed to get completed lessons:', error);
    return { success: false, error: error.message, lessons: [] };
  }
}

/**
 * Map AcademyLMS lesson completions to our module progress
 */
export function mapLessonsToModules(completedLessons) {
  const moduleProgress = [];

  for (const lesson of completedLessons) {
    const moduleId = MODULE_MAPPING[`lesson_${lesson.lessonId}`] ||
                     MODULE_MAPPING[lesson.lessonId];

    if (moduleId) {
      moduleProgress.push({
        moduleId,
        status: 'completed',
        completedAt: lesson.completedAt,
        source: 'academylms',
        lessonId: lesson.lessonId,
        lessonTitle: lesson.lessonTitle
      });
    }
  }

  return moduleProgress;
}

/**
 * Sync progress from AcademyLMS to our database
 */
export async function syncProgressFromLMS(userId, wordpressUserId, db) {
  try {
    // Get completed lessons from AcademyLMS
    const { success, lessons, error } = await getCompletedLessons(wordpressUserId);

    if (!success) {
      return { success: false, error, synced: 0 };
    }

    // Map to our modules
    const moduleProgress = mapLessonsToModules(lessons);

    let syncedCount = 0;

    // Update our database
    for (const progress of moduleProgress) {
      try {
        await db.query(
          `INSERT INTO user_progress (user_id, module_id, status, completed_at, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id, module_id) DO UPDATE SET
             status = CASE
               WHEN user_progress.status = 'completed' THEN 'completed'
               ELSE $3
             END,
             completed_at = COALESCE(user_progress.completed_at, $4),
             notes = COALESCE(user_progress.notes, $5),
             updated_at = NOW()`,
          [
            userId,
            progress.moduleId,
            progress.status,
            progress.completedAt,
            `Synced from AcademyLMS: ${progress.lessonTitle}`
          ]
        );
        syncedCount++;
      } catch (e) {
        console.error(`Failed to sync module ${progress.moduleId}:`, e);
      }
    }

    return {
      success: true,
      synced: syncedCount,
      totalLessons: lessons.length,
      mappedModules: moduleProgress.length
    };
  } catch (error) {
    console.error('Progress sync failed:', error);
    return { success: false, error: error.message, synced: 0 };
  }
}

/**
 * Get WordPress user by email
 */
export async function getWordPressUser(email) {
  try {
    const users = await wpRequest(`/wp/v2/users?search=${encodeURIComponent(email)}`);

    if (users && users.length > 0) {
      return {
        success: true,
        user: users[0]
      };
    }

    return { success: false, error: 'User not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if WordPress/WooCommerce integration is configured
 */
export function isIntegrationConfigured() {
  return {
    wordpress: !!(WP_URL && WP_URL !== 'https://yourdomain.com'),
    woocommerce: !!(WC_CONSUMER_KEY && WC_CONSUMER_SECRET),
    academylms: !!CCBBB_COURSE_ID
  };
}

/**
 * Get module mapping info
 */
export function getModuleMapping() {
  return {
    mapping: MODULE_MAPPING,
    reverseMapping: REVERSE_MODULE_MAPPING,
    totalMappedModules: Object.keys(MODULE_MAPPING).length
  };
}

export default {
  verifyPurchase,
  getAcademyProgress,
  getCompletedLessons,
  mapLessonsToModules,
  syncProgressFromLMS,
  getWordPressUser,
  isIntegrationConfigured,
  getModuleMapping
};
