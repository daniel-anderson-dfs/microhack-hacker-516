#!/bin/sh
set -eu

export API_HOST="${APPSETTING_API_HOST:-${API_HOST:-api}}"
export API_PORT="${APPSETTING_API_PORT:-${API_PORT:-3000}}"
export API_PROTOCOL="${APPSETTING_API_PROTOCOL:-${API_PROTOCOL:-http}}"

case "$API_HOST" in ''|*[!a-zA-Z0-9.-]*) echo "Invalid API_HOST" >&2; exit 1 ;; esac
case "$API_PORT" in ''|*[!0-9]*) echo "Invalid API_PORT" >&2; exit 1 ;; esac
case "$API_PROTOCOL" in http|https) ;; *) echo "Invalid API_PROTOCOL" >&2; exit 1 ;; esac

# Browsers use the public frontend origin; only nginx resolves the private API.
printf '%s\n' 'window.RUNTIME_CONFIG = { API_URL: window.location.origin };' \
  > /usr/share/nginx/html/runtime-config.js
envsubst '${API_HOST} ${API_PORT} ${API_PROTOCOL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
