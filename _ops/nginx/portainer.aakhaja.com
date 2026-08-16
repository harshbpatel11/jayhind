# Portainer — Docker management UI (see docker-compose.server.yml).
#
# Not live yet. To activate:
#   1. Add a DNS A record: portainer.aakhaja.com -> 80.225.223.213
#   2. sudo cp _ops/nginx/portainer.aakhaja.com /etc/nginx/sites-available/
#   3. sudo ln -s /etc/nginx/sites-available/portainer.aakhaja.com /etc/nginx/sites-enabled/
#   4. sudo nginx -t && sudo systemctl reload nginx
#   5. sudo certbot --nginx -d portainer.aakhaja.com
#      (certbot rewrites this file in place to add the listen 443/ssl block
#      and the http->https redirect, same as it did for the other domains —
#      see the "# managed by Certbot" comments in the other sites-enabled
#      files for what that'll look like afterwards)
server {
    server_name portainer.aakhaja.com;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 80;
}
