#!/bin/sh
set -e

cd /var/www/html

envsubst '${PORT}' < /etc/nginx/templates/app.conf.template > /etc/nginx/conf.d/app.conf

db_connection="${DB_CONNECTION:-sqlite}"

if [ "$db_connection" = "sqlite" ]; then
    sqlite_file="${DB_DATABASE:-database/database.sqlite}"
    mkdir -p "$(dirname "$sqlite_file")"
    touch "$sqlite_file"
fi

php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan migrate --force

if [ "$DEMO_DATA" = "true" ]; then
    php artisan app:reset-demo
else
    php artisan db:seed --force
fi

chown -R www-data:www-data storage bootstrap/cache

if [ "$db_connection" = "sqlite" ]; then
    chown -R www-data:www-data "$(dirname "$sqlite_file")"
fi

exec /usr/bin/supervisord -c /etc/supervisor/app.conf
