#!/usr/bin/env bash
# Diagnóstico de solo lectura: no inicia backend, Metro ni emuladores.
set -u

task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
printf 'Proyecto: %s\n' "$task_root"
printf 'Node requerido: '
if command -v fnm >/dev/null 2>&1; then fnm exec --using=22.14.0 node --version 2>&1; else printf 'fnm no disponible\n'; fi
printf 'Node actual: '; node --version 2>&1 || true
printf 'npm: '; npm --version 2>&1 || true

for task_port in 3000 3207; do
  if lsof -nP -iTCP:"$task_port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'Puerto %s: ocupado\n' "$task_port"
  else
    printf 'Puerto %s: libre\n' "$task_port"
  fi
done
if curl -fsS --max-time 2 http://127.0.0.1:3207/health 2>/dev/null | grep -q '"status":"ok"'; then
  printf 'Backend /health en 3207: OK\n'
else
  printf 'Backend /health en 3207: no responde (normal antes de levantarlo)\n'
fi

if [ -n "${QOS_BACKEND_URL:-}" ]; then
  printf 'QOS_BACKEND_URL para el próximo Metro: %s\n' "$QOS_BACKEND_URL"
else
  printf 'QOS_BACKEND_URL: no definida; la app usa los defaults en 3000\n'
fi
printf 'Mapa: Leaflet + OpenStreetMap; requiere Internet para tiles y scripts CDN, sin API key\n'
if git -C "$task_root" check-ignore -q mobile/android/app/debug.keystore &&
   git -C "$task_root" check-ignore -q backend/.env; then
  printf 'Gitignore de keystore y .env: OK\n'
else
  printf 'Gitignore de secretos: revisar\n'
fi
if command -v rg >/dev/null 2>&1; then
  if rg -q 'AIza[0-9A-Za-z_-]{30,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[0-9A-Za-z]{20,}' \
    "$task_root/mobile/src" "$task_root/backend/src" "$task_root/mobile/android/app/build.gradle"; then
    printf 'Secretos evidentes en código fuente: revisar (valores ocultos)\n'
  else
    printf 'Secretos evidentes en código fuente: no detectados por patrón básico\n'
  fi
fi

task_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
printf 'IP LAN en0: %s\n' "${task_ip:-no detectada; revisar interfaces}"
if command -v adb >/dev/null 2>&1; then
  printf 'Android SDK/adb: disponible\n'
  if lsof -nP -iTCP:5037 -sTCP:LISTEN >/dev/null 2>&1; then
    adb devices -l 2>&1 | sed -n '1,8p'
  else
    printf 'ADB daemon detenido; este script no lo inicia\n'
  fi
else
  printf 'Android SDK/adb: no detectado\n'
fi
if [ -d "$HOME/.android/avd" ]; then
  printf 'AVD configurados: '
  find "$HOME/.android/avd" -maxdepth 1 -name '*.ini' -exec basename {} .ini \; | tr '\n' ' '
  printf '\n'
fi
if command -v xcodebuild >/dev/null 2>&1; then
  xcodebuild -version 2>&1 | sed -n '1,2p'
  printf 'Simuladores iOS encendidos:\n'
  xcrun simctl list devices booted 2>&1 | sed -n '1,12p'
else
  printf 'Xcode: no detectado\n'
fi
