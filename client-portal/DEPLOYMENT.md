# CCBBB Client Portal - Deployment Guide

## Complete Setup Instructions for Cosmic Clarity & Breakthrough Business Blueprint Client Portal

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Drive Setup](#google-drive-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [WordPress Integration](#wordpress-integration)
7. [Production Checklist](#production-checklist)

---

## Prerequisites

### Required Software
- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- PM2 (for process management)
- Nginx (for reverse proxy)

### Required Accounts/Access
- Google Cloud Platform account
- Anthropic API key (for Claude AI chatbot)
- Access to your existing `/sweph` astrology API
- WordPress admin access (for SSO integration)

---

## Google Drive Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "CCBBB-Client-Portal"
3. Enable these APIs:
   - Google Drive API
   - Google Docs API
   - Google Sheets API (optional, for spreadsheet templates)

### Step 2: Create Service Account

1. In Google Cloud Console → IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: `ccbbb-portal-service`
4. Description: "Server-side access to course templates"
5. Click "Create and Continue"
6. Skip optional permissions → "Done"
7. Click on the service account you just created
8. Go to "Keys" tab → "Add Key" → "Create new key"
9. Select JSON → Create
10. **SAVE THIS FILE SECURELY** - Never commit to git!

### Step 3: Share Drive Folders

You need to share your course folders with the service account:

1. Go to Google Drive
2. Navigate to folder "claude format ccbbb"
3. Right-click → Share
4. Add the service account email:
   ```
   ccbbb-portal-service@YOUR-PROJECT-ID.iam.gserviceaccount.com
   ```
5. Set permission to "Viewer" (for security)
6. Click "Share"
7. Repeat for "ccbbb 2.0" folder

### Step 4: Get Folder IDs

For each folder:
1. Open the folder in Google Drive
2. Look at the URL:
   ```
   https://drive.google.com/drive/folders/1ABC123def456...
   ```
3. The folder ID is: `1ABC123def456...`
4. Save both folder IDs for configuration

---

## Database Setup

### Install PostgreSQL (if not already installed)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User

```bash
# Connect as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE ccbbb_portal;
CREATE USER ccbbb_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE ccbbb_portal TO ccbbb_user;
\c ccbbb_portal
GRANT ALL ON SCHEMA public TO ccbbb_user;
\q
```

### Run Migrations

The application will automatically run migrations on first start, or you can run:

```bash
cd /path/to/client-portal
node scripts/migrate.js
```

---

## Backend Deployment

### Step 1: Clone/Copy Files

```bash
# On your RackNerd VPS
cd /home/user/sweph
# Files should already be in client-portal/
```

### Step 2: Install Dependencies

```bash
cd client-portal
npm install
```

### Step 3: Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your values
nano .env
```

**Critical environment variables:**

```bash
# Server
NODE_ENV=production
PORTAL_PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ccbbb_portal
DB_USER=ccbbb_user
DB_PASSWORD=your_secure_password_here

# JWT (generate a strong random string)
JWT_SECRET=your-super-long-random-string-at-least-64-chars

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # Entire JSON on one line
# OR
GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/service-account-key.json

GOOGLE_DRIVE_FOLDER_CCBBB_MAIN=your_folder_id_1
GOOGLE_DRIVE_FOLDER_CCBBB_V2=your_folder_id_2

# Claude AI
ANTHROPIC_API_KEY=sk-ant-api...

# Astrology API (your existing sweph API)
ASTROLOGY_API_URL=http://127.0.0.1:3000

# CORS
CORS_ORIGINS=https://yourdomain.com,https://portal.yourdomain.com
```

### Step 4: Build Frontend

```bash
cd client
npm install
npm run build
cd ..
```

### Step 5: Start with PM2

```bash
# Install PM2 if not installed
npm install -g pm2

# Start the portal
pm2 start server.js --name ccbbb-portal

# Save PM2 configuration
pm2 save
pm2 startup
```

### Step 6: Configure Nginx

```nginx
# /etc/nginx/sites-available/ccbbb-portal

server {
    listen 80;
    server_name portal.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/portal.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ccbbb-portal /etc/nginx/sites-enabled/

# Get SSL certificate
sudo certbot --nginx -d portal.yourdomain.com

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## WordPress Integration

### Option 1: JWT Authentication Plugin (Recommended)

Install a JWT plugin on your WordPress site:

1. Install "JWT Authentication for WP REST API" plugin
2. Configure your wp-config.php:
   ```php
   define('JWT_AUTH_SECRET_KEY', 'your-secret-key');
   define('JWT_AUTH_CORS_ENABLE', true);
   ```

3. Add to your `.env`:
   ```bash
   WORDPRESS_SITE_URL=https://your-wordpress-site.com
   WORDPRESS_JWT_SECRET=your-secret-key  # Same as wp-config
   ```

### Option 2: Custom SSO Endpoint

Add this to your WordPress theme's functions.php or a custom plugin:

```php
// Add REST API endpoint for SSO
add_action('rest_api_init', function() {
    register_rest_route('ccbbb/v1', '/validate-session', array(
        'methods' => 'GET',
        'callback' => 'ccbbb_validate_session',
        'permission_callback' => function() {
            return is_user_logged_in();
        }
    ));
});

function ccbbb_validate_session($request) {
    $user = wp_get_current_user();

    return array(
        'success' => true,
        'user' => array(
            'id' => $user->ID,
            'email' => $user->user_email,
            'name' => $user->display_name,
            'roles' => $user->roles
        )
    );
}
```

### Embedding Portal in WordPress

Add an iframe or redirect from AcademyLMS:

```php
// Shortcode for embedding portal
function ccbbb_portal_shortcode($atts) {
    if (!is_user_logged_in()) {
        return '<p>Please log in to access the portal.</p>';
    }

    $token = ccbbb_generate_sso_token(get_current_user_id());
    $portal_url = 'https://portal.yourdomain.com/login?sso=' . $token;

    return '<iframe src="' . $portal_url . '" width="100%" height="800" frameborder="0"></iframe>';
}
add_shortcode('ccbbb_portal', 'ccbbb_portal_shortcode');
```

---

## Production Checklist

### Security

- [ ] Strong JWT_SECRET (64+ random characters)
- [ ] PostgreSQL password is secure
- [ ] Service account key is NOT committed to git
- [ ] CORS_ORIGINS only includes your domains
- [ ] SSL certificate is installed and working
- [ ] Rate limiting is enabled

### Performance

- [ ] PM2 is configured with cluster mode for high traffic
- [ ] Nginx is caching static files
- [ ] Database has proper indexes

### Monitoring

- [ ] PM2 logs are configured: `pm2 logs ccbbb-portal`
- [ ] Error monitoring is set up (optional: Sentry, LogRocket)
- [ ] Uptime monitoring (optional: UptimeRobot)

### Backup

- [ ] Database backup script is scheduled
- [ ] Google Drive service account key is backed up securely

---

## API Endpoints Reference

### Public Endpoints
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/wordpress` - WordPress SSO login

### Protected Endpoints (require Bearer token)
- `GET /api/v1/templates` - List all templates
- `POST /api/v1/templates/:id/generate` - Generate personalized document
- `GET /api/v1/astrology/profile` - Get astrology profile
- `POST /api/v1/chat/message` - Chat with AI coach
- `GET /api/v1/progress` - Get course progress

---

## Troubleshooting

### Google Drive errors

```bash
# Check if service account has access
# In Google Cloud Console → IAM → check service account permissions
# Verify folder is shared with service account email
```

### Database connection issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U ccbbb_user -d ccbbb_portal -h localhost
```

### API not responding

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs ccbbb-portal --lines 100

# Restart if needed
pm2 restart ccbbb-portal
```

### Astrology API not connecting

```bash
# Verify existing astrology API is running
curl http://127.0.0.1:3000/health

# Check ASTROLOGY_API_URL in .env
```

---

## Support

For issues, check:
1. PM2 logs: `pm2 logs ccbbb-portal`
2. Nginx logs: `/var/log/nginx/error.log`
3. PostgreSQL logs: `/var/log/postgresql/`

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Internet                                                       │
│      │                                                           │
│      ▼                                                           │
│   Nginx (SSL termination, reverse proxy)                        │
│      │                                                           │
│      ├─── Static files (React build)                            │
│      │                                                           │
│      └─── API requests ──► Node.js Portal (PM2)                 │
│                                │                                 │
│                                ├──► PostgreSQL (users, progress) │
│                                │                                 │
│                                ├──► Google Drive API (templates) │
│                                │                                 │
│                                ├──► Claude API (chatbot)         │
│                                │                                 │
│                                └──► Astrology API (/sweph)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
