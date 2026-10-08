# Network QoS Monitor

TP5 de Desarrollo de Aplicaciones Móviles. Aplicación Android/iOS para observar estado de red, medir QoS real, guardar sesiones con GPS y explorarlas en historial, mapa, tendencias y archivos exportados. No usa Expo Go como runtime principal ni inventa métricas ausentes.

## Objetivo

Relacionar conectividad, latencia, pérdida, jitter y throughput con un momento y una ubicación. Las mediciones manuales completas quedan en SQLite local; los chequeos background son livianos y separados. El proyecto es académico: no certifica un operador ni reemplaza instrumental de red.

## Funcionalidades

- Estado WiFi/cellular/Ethernet/otro y alcance estimado de Internet con NetInfo.
- Puente celular nativo Kotlin/Swift para operador, tecnología, generación, señal y roaming cuando las APIs lo permiten.
- TCP Connect RTT a Cloudflare, Google y GitHub: min/promedio/máximo, jitter y pérdida.
- Download/upload Mbps hacia backend Fastify propio con conteo real de bytes.
- GPS contextual, SQLite local, historial, detalle y eliminación transaccional.
- Mapa con puntos y heatmap en Leaflet + OpenStreetMap dentro de React Native WebView, score de calidad y tendencias temporales.
- Monitoreo background opcional con alertas locales solo por degradación severa.
- Filtros por red/generación, fecha UTC y radio geográfico; exportación CSV/JSON de resultados visibles.

La matriz detallada RF-01–RF-09 y los escenarios pendientes están en [docs/PRD-CHECKLIST.md](docs/PRD-CHECKLIST.md).

## Arquitectura

```text
React Native UI
  ├─ NetInfo / Native Cellular Bridge (Codegen → Kotlin/Swift)
  ├─ Measurement Engine → TCP sockets + HTTP throughput
  ├─ Location Service → GPS contextual
  ├─ SQLite Repository → Historial / Mapa / Tendencias / Filtros
  ├─ Background Scheduler → reglas → Notifee local
  └─ Export Service → CSV/JSON → share sheet nativa

Fastify local → GET /health, GET /download, POST /upload
```

Las pantallas consumen servicios tipados; no abren sockets ni ejecutan SQL directamente. Véase [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

React Native 0.87.1, New Architecture/Fabric, TypeScript strict, Kotlin/TelephonyManager, Swift/CoreTelephony, NetInfo, `react-native-tcp-socket`, `react-native-nitro-sqlite`, `react-native-webview`, Leaflet, `leaflet.heat`, OpenStreetMap, `react-native-svg`, `react-native-background-fetch`, Notifee, `react-native-blob-util`, `react-native-share` y Fastify/Node TypeScript. Las versiones exactas están fijadas en los lockfiles de `mobile/` y `backend/`.

## Estructura del proyecto

```text
network-qos-monitor/
├── mobile/
│   ├── android/ y ios/       # proyectos nativos
│   └── src/
│       ├── features/         # network, measurements, location, history, map, background, export
│       ├── native/           # TurboModule celular y adaptador TS
│       ├── storage/          # SQLite, migraciones, repositories
│       ├── services/         # snapshot NetInfo
│       └── config/           # backend
├── backend/                  # Fastify local para throughput
└── docs/                     # arquitectura, auditoría, defensa, informe y evidencias
```

## Instalación

Requisitos: Node **22.14.0** (archivo `.node-version`), npm, JDK/Android SDK para Android, Xcode y CocoaPods para iOS. Este proyecto se validó con New Architecture activa; no desactivar `newArchEnabled=true` ni `RCTNewArchEnabled`.

```bash
fnm use 22.14.0
cd backend && npm install
cd ../mobile && npm install
cd ios && pod install
```

## Node requerido

Usar Node **22.14.0** mediante `fnm use 22.14.0`. React Native 0.87.1 requiere Node 22.11 o superior. Confirmar con `node --version` antes de instalar o compilar.

## Mobile setup

Desde `mobile/`, iniciar Metro con `npm start` y, en otra terminal, ejecutar la plataforma deseada. No se requiere Expo Go. El primer build nativo puede tardar varios minutos.

## iOS

```bash
cd mobile/ios && pod install
cd .. && npm run ios
```

Para build de simulador sin firma: `xcodebuild -workspace NetworkQosMonitor.xcworkspace -scheme NetworkQosMonitor -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` desde `mobile/ios`. Un teléfono requiere configuración normal de firma de Xcode. iOS usa el mismo mapa Leaflet + OpenStreetMap que Android, y la hoja de compartir ofrece Guardar en Archivos/AirDrop cuando el dispositivo y las apps lo permiten.

## Android

```bash
cd mobile
npm run android
# o validar APK: cd android && ./gradlew assembleDebug --console=plain
```

Verificar SDK/JDK y un emulador o dispositivo conectado. El mapa funciona sin API key; los tiles de OpenStreetMap requieren Internet.

## Backend throughput

Desde `backend/`: `npm install`, copiar `.env.example` a `.env` si se desea personalizar, luego `npm run dev`. Por defecto escucha en `0.0.0.0:3000` con `GET /health`, `GET /download?bytes=N` y `POST /upload`. La descarga por defecto es 5.000.000 bytes (máximo 20.000.000); la subida móvil es 2.000.000 bytes (límite backend 5.000.000). No se escriben archivos recibidos ni se acepta un backend público por defecto. Más detalles en [backend/README.md](backend/README.md).

## Mapa sin API key

RF-05 usa **Leaflet + OpenStreetMap dentro de React Native WebView** en Android e iOS. Puntos y `leaflet.heat` consumen solo mediciones guardadas por `getMeasurementsForMap()`; no hay datos de ejemplo. Se puede abrir Mapa sin mediciones. Los tiles vienen de `https://tile.openstreetmap.org/{z}/{x}/{y}.png` y muestran la atribución visible **© OpenStreetMap contributors**. Para descargar tiles se necesita Internet; no se necesita API key, Google Cloud ni facturación. Leaflet y `leaflet.heat` se cargan desde CDN en la demo, por lo que también requieren Internet. No se descargan tiles en lote ni hay modo offline.

## Configuración backend URL

Los defaults de [mobile/src/config/backend.ts](mobile/src/config/backend.ts) sirven para simulador en puerto 3000: **iOS Simulator** `http://localhost:3000`; **Android Emulator** `http://10.0.2.2:3000`. Para la demo en otro puerto o en teléfono físico, iniciar Metro con `QOS_BACKEND_URL=http://<HOST>:<PORT> npm start -- --reset-cache`; la variable se inserta en el bundle sin editar la lógica ni guardar una IP personal en Git. En teléfono físico usar la IP LAN actual del computador, ambos en una red accesible y el backend escuchando en `0.0.0.0`. Si cambia la URL, reiniciar Metro con la nueva variable y limpiar caché. No se autodetecta IP ni se cambian firewalls. Ver [docs/MANUAL-TEST.md](docs/MANUAL-TEST.md) para el puerto y comandos de demo.

## Metodología RTT

Cada sonda registra `performance.now()` justo antes de abrir un socket TCP/443; al conectarse registra el fin y destruye el socket. Esto mide **TCP Connect RTT**, no ICMP Echo ni respuesta HTTP. Los tres targets están en [config.ts](mobile/src/features/measurements/config.ts), son editables y el motor acepta otros. La medición manual usa **5 sondas/host**, timeout **3000 ms** e intervalo **250 ms**, secuenciales. DNS puede influir en el primer intento por dominio. Min/promedio/máximo se calculan sobre éxitos; jitter = media de `|RTT(n)−RTT(n−1)|` entre éxitos consecutivos; pérdida = fallidas/enviadas × 100. Una cancelación no se cuenta como pérdida.

## Metodología throughput

El móvil mide transferencia HTTP real hacia el backend propio; no usa Speedtest.net. Verifica bytes de descarga contra longitud recibida y bytes de subida contra `receivedBytes` del servidor. Usa `performance.now()`; `Mbps = bytes × 8 / segundos / 1.000.000`. **Mbps** son megabits/s; **MB/s**, megabytes/s. El backend responde `no-store` y la app agrega nonce a la URL para evitar caché. Un backend inaccesible produce “No disponible”, no un número ficticio.

## Quality Score

Índice **académico** 0–100 para visualización: RTT 35 %, pérdida 30 %, download 20 %, upload 15 %, con interpolación por umbrales centralizados en [qualityScore.ts](mobile/src/features/map/qualityScore.ts). Datos nulos se excluyen y los pesos restantes se renormalizan. Pérdida ≥10 % o RTT ≥200 ms limitan score a 39; pérdida ≥20 % o RTT ≥400 ms a 19. Categorías: Excelente 80–100, Buena 60–79, Regular 40–59, Mala 20–39 y Muy mala 0–19. No es una norma científica universal. El calor usa intensidad relativa derivada del score, no color exacto por sesión.

## Persistencia

SQLite local versiona schema con `PRAGMA user_version`. `measurements` guarda sesión, GPS, snapshot y resúmenes; `measurement_targets` guarda estadísticas por host con FK/cascada; `background_monitor_settings` guarda solo preferencia y estado del monitor. El repository inserta sesión + targets en una transacción. Sin ubicación válida no se añade una sesión definitiva; queda visible en memoria y puede reintentarse GPS. Historial, mapa y tendencias leen únicamente SQLite.

## Background

Activar en **Estado → Monitoreo en segundo plano** solicita permiso de notificaciones de forma contextual. `react-native-background-fetch` pide un mínimo aproximado de **15 min**, no una frecuencia garantizada. Cada evento usa NetInfo y **3 sondas TCP/host**, timeout **2000 ms**, pausa **100 ms**, presupuesto global **25 s**; no hace GPS ni throughput. Un mutex evita solaparse con la sesión manual. Solo degradación severa (offline, RTT ≥200 ms, jitter ≥80 ms, pérdida ≥10 % o dos hosts sin respuesta) puede generar alerta local Notifee, con cooldown SQLite de 30 min. Android admite Headless JS tras terminar la actividad salvo restricciones/force-stop; iOS es oportunista y se detiene tras cierre forzado. No usa FCM/APNs remoto. [Guía oficial de Background Fetch](https://github.com/transistorsoft/react-native-background-fetch).

## Exportación

En **Historial → Exportar**, primero se advierte que el archivo contiene coordenadas. CSV tiene una fila resumen por sesión con cabeceras, UTF-8/BOM, nulls vacíos y escaping correcto; por claridad tabular omite targets individuales. JSON agrega `exportedAt`, `measurementCount`, campos legibles y **targets completos**. Ambos incluyen el mismo `qualityScore` del mapa. Si hay filtros, solo se exportan las sesiones visibles. Los archivos `network-qos-YYYY-MM-DD-HHmm.csv/json` se crean en caché privada y se entregan a la hoja nativa de compartir; la app no los sube automáticamente. El sistema puede limpiar caché después.

## Filtros

Historial ofrece redes presentes en SQLite (y 2G/3G/4G/5G presentes cuando se elige Cellular), fechas **UTC** `AAAA-MM-DD` inclusivas y radio de **500 m, 1 km, 5 km o 10 km** alrededor de una medición seleccionada. SQLite filtra red/fecha con parámetros; Haversine filtra distancia localmente. No hay geocoding ni Google Places. Los chips muestran filtros activos y “Limpiar filtros” restaura todo.

## Privacidad

GPS e historial quedan en almacenamiento privado local; el backend de throughput no recibe coordenadas. Mapa solicita tiles a OpenStreetMap al abrirse; el proveedor puede ver el área consultada y la IP del dispositivo. El archivo exportado contiene datos sensibles y solo sale del dispositivo si la persona elige un destino en la share sheet. No hay autenticación, sincronización cloud ni telemetría propia. Revisar capturas y exportaciones antes de publicarlas.

## Tests

```bash
cd backend && npm test && npm run build
cd ../mobile && npx tsc --noEmit && npm run lint && npm test -- --runInBand
cd android && ./gradlew assembleDebug --console=plain
```

Los tests unitarios usan mocks de sockets, HTTP, GPS, SQLite y scheduler; **no dependen de Internet**. Ejecutar `pod install` y el build iOS indicado arriba; generar bundles Metro Android/iOS como validación adicional. Consultar [docs/EVIDENCIAS.md](docs/EVIDENCIAS.md) para capturas de pruebas y builds.

## Limitaciones conocidas

- iOS no proporciona RSSI celular público soportado; el operador puede no estar disponible. Simuladores no sustituyen un teléfono con SIM.
- iOS Background Fetch no garantiza tiempo y cesa tras cierre forzado; Android también está sujeto a energía/force-stop.
- El mapa requiere Internet para tiles de OpenStreetMap y para cargar Leaflet/leaflet.heat desde CDN; no usa claves ni facturación.
- TCP Connect RTT no es ICMP y puede incluir DNS inicial. Throughput mide dispositivo ↔ backend configurado, no velocidad contratada.
- GPS denegado impide persistir la sesión completa; el resultado en memoria sigue visible.
- La entrega final aún requiere pruebas y capturas en equipos físicos para radio, GPS, mapa, scheduler, notificación y share sheet.

## Demo / Happy Path

1. Abrir la app y mostrar Estado de red en WiFi; en teléfono, cambiar a datos y mostrar Native Cellular Bridge.
2. Iniciar Medir y mostrar progreso RTT de los tres destinos, luego download/upload al backend local.
3. Aceptar GPS contextual, guardar y abrir Historial y el detalle con targets.
4. Mostrar Mapa en Puntos y Heatmap; abrir Tendencias con al menos dos sesiones.
5. Aplicar red + fechas + radio, explicar chips y exportar CSV/JSON filtrados revisando el share sheet.
6. Activar monitoreo background, probar notificación y simular un evento según [docs/EVIDENCIAS.md](docs/EVIDENCIAS.md).

Guion oral: [docs/DEFENSA.md](docs/DEFENSA.md). Informe académico editable: [docs/INFORME-BASE.md](docs/INFORME-BASE.md).
