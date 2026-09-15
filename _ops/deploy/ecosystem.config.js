// pm2 process list for the production host — installed as
// /srv/jayhind/ecosystem.config.js by server-bootstrap.sh.
//
// `cwd` is the `current` symlink, so a restart after jayhind-deploy swaps it
// starts the new release. Each app reads its .env from cwd (ConfigModule), and
// that .env is a symlink into shared/.
//
// The host has ~1 GB RAM plus 2 GB swap: the heap caps keep one runaway process
// from pushing the other into swap, and max_memory_restart is the backstop.
module.exports = {
  apps: [
    {
      name: 'client-back',
      cwd: '/srv/jayhind/client-back/current',
      script: 'dist/src/main.js',
      node_args: '--max-old-space-size=512',
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
      kill_timeout: 10000,
      time: true,
    },
    {
      name: 'admin-back',
      cwd: '/srv/jayhind/admin-back/current',
      script: 'dist/src/main.js',
      node_args: '--max-old-space-size=384',
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      kill_timeout: 10000,
      time: true,
    },
  ],
};
