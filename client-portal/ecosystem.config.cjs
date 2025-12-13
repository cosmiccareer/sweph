module.exports = {
  apps: [
    {
      name: 'ccbbb-portal',
      script: 'server.js',
      cwd: '/home/user/sweph/client-portal',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORTAL_PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORTAL_PORT: 3001
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
