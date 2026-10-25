#!/bin/sh
set -e

cd /var/www/html

envsubst '${PORT}' < /etc/nginx/templates/app.conf.template > /etc/nginx/conf.d/app.conf

php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan migrate --force
php artisan db:seed --force

chown -R www-data:www-data storage bootstrap/cache

exec /usr/bin/supervisord -c /etc/supervisor/app.conf
