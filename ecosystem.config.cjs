module.exports = {
  apps: [{
    name: 'picture-sorter',
    script: 'server/index.js',
    cwd: '/var/www/picture-sorter/app',
    autorestart: true,
    env: {
      NODE_ENV: 'production',
    },
    out_file: '/var/www/picture-sorter/logs/out.log',
    error_file: '/var/www/picture-sorter/logs/error.log',
  }],
};
