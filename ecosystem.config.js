module.exports = {
  apps: [
    {
      name: 'skillmetric-backend',
      script: './dist/main.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      env_staging: {
        NODE_ENV: 'staging',
      },
      error_file: '/var/log/skillmetric/pm2-error.log',
      out_file: '/var/log/skillmetric/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      instance_var: 'INSTANCE_ID',
    },
    {
      name: 'skillmetric-worker',
      script: './dist/worker.js', // Separate worker process for background jobs
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        WORKER_PROCESS: 'true',
      },
      error_file: '/var/log/skillmetric/worker-error.log',
      out_file: '/var/log/skillmetric/worker-out.log',
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['api.skillmetric.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/skillmetric.git',
      path: '/var/www/skillmetric-backend',
      'post-deploy':
        'npm ci && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'apt-get install git -y',
    },
    staging: {
      user: 'deploy',
      host: ['staging-api.skillmetric.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/skillmetric.git',
      path: '/var/www/skillmetric-backend-staging',
      'post-deploy':
        'npm ci && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
