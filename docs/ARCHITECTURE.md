# Arquitectura final

```text
React Native UI
│
├── NetInfo
├── Cellular Native Bridge → Codegen → Kotlin TelephonyManager / Swift CoreTelephony
├── Measurement Engine
│   ├── TCP Connect RTT → estadísticas min/avg/max, jitter, pérdida
│   └── HTTP Throughput → backend Fastify local
├── Location Service → GPS contextual
├── SQLite Repository
│   ├── History / Detail / Filters
│   ├── Map / Heatmap
│   └── Charts
├── Background Scheduler → chequeo TCP liviano → Notifee local
└── Export Service → CSV/JSON → share sheet nativa

Backend Fastify: GET /health | GET /download | POST /upload
```

La aplicación se organiza como una secuencia de responsabilidades:

```text
Native Bridge
      ↓
Measurement Engine
      ↓
Persistence
      ↓
Geo Layer
      ↓
Presentation
```

## Capas

- **Native Bridge:** TurboModule con Codegen y adaptadores Kotlin/Swift para capacidades que NetInfo no ofrece con suficiente detalle. Ya consulta operador, tecnología y señal cuando cada plataforma los expone; iOS no expone RSSI público soportado.
- **Measurement Engine:** coordina TCP Connect RTT, jitter, pérdida y throughput HTTP sin mezclar reglas con la interfaz.
- **Persistence:** `measurementRepository` guarda sesión y resultados por destino en una transacción SQLite local.
- **Geo Layer:** `locationService` solicita una posición actual con consentimiento contextual y el mapa consulta las coordenadas persistidas.
- **Presentation:** pantallas, componentes y hooks consumen modelos normalizados; no dependen de estructuras nativas crudas.

## Fuentes de datos

```text
NetInfo                 → estado general de conectividad
Native Bridge          → operador / tipo celular / RSSI disponible por plataforma
Measurement Engine     → TCP Connect RTT / jitter / loss / HTTP throughput
```

`networkStatusService` mantiene una única suscripción a NetInfo mientras haya consumidores. `useNetworkStatus()` usa ese servicio y entrega un `NetworkStatus` tipado y normalizado. Al desmontar el último consumidor, el servicio elimina el listener nativo.

## Native Cellular Bridge

```text
TypeScript Spec → Codegen → interfaz/protocolo generado
                         ↙                  ↘
              Kotlin TelephonyManager   Swift CoreTelephony
                         ↘                  ↙
                  Promise<CellularInfo> a React Native
```

`NativeCellularInfo` es un TurboModule New Architecture-only registrado en `codegenConfig`. Android agrega su `BaseReactPackage` a `MainApplication`; iOS registra `RCTNativeCellularInfo` mediante `modulesProvider`. El adaptador Objective-C++ implementa el protocolo de Codegen y delega la lógica de plataforma a Swift.

| Dato | Android | iOS |
| --- | --- | --- |
| Operador | `TelephonyManager.networkOperatorName` | No se usa: las APIs públicas de carrier CoreTelephony están deprecated |
| Tecnología | Tipo activo de datos `NETWORK_TYPE_*` | `serviceCurrentRadioAccessTechnology`, preferentemente el servicio `dataServiceIdentifier` |
| Generación | 2G/3G/4G/5G desde tipo Android | 2G/3G/4G/5G desde radio technology |
| RSSI / dBm | `CellSignalStrength.getDbm()` cuando el modem informa | Siempre `null`: iOS no ofrece API pública soportada |
| Nivel | `CellSignalStrength.getLevel()` (0–4; cero/unknown se normaliza a `null`) | Siempre `null` |
| Roaming | `TelephonyManager.isNetworkRoaming`, sujeto a permiso y disponibilidad | `null`; no se llama a la API antigua deprecated de carrier |

Android declara `READ_BASIC_PHONE_STATE` para API 33+ y nunca solicita `READ_PHONE_STATE`; antes de API 33 se omiten tipo de red y roaming. La resolución tolera falta de SIM, radio, permisos y datos del modem devolviendo campos nullable. iOS deja operador, señal y roaming como `null` y escoge la tecnología de datos cuando puede identificarla.

## Motor de latencia TCP

```text
Measurement Screen
      ↓
Latency Engine
      ↓
TCP Socket
      ↓
Target
      ↓
Statistics
      ↓
UI result
```

`latencyEngine.ts` ejecuta conexiones TCP secuenciales mediante `react-native-tcp-socket`; no depende de componentes UI y no sustituye sockets por HTTP/fetch. Cada RTT usa reloj monotónico desde antes de abrir el socket hasta el callback de conexión. Timeout, fallo de conexión y host inaccesible generan sonda fallida. Conectar y destruir el socket mide TCP Connect RTT, no ICMP ni latencia de una solicitud de aplicación.

Las estadísticas se calculan por destino: min/avg/max solo sobre conexiones exitosas; jitter es la media de diferencias absolutas entre RTT exitosos consecutivos; pérdida es fallidas/enviadas. Una cancelación aborta el socket activo, quita el listener de cancelación y limpia timeout y pausa activa; una sonda cancelada se excluye del conteo de pérdida. El motor mide un único socket por vez para resultados previsibles. El snapshot NetInfo/celular se incorpora a la sesión guardada si hay ubicación válida.

Los destinos iniciales y los parámetros (5 sondas, timeout de 3000 ms, intervalo de 250 ms) están centralizados en `mobile/src/features/measurements/config.ts`. Los nombres DNS pueden introducir resolución en el primer connect y su caché puede modificar los posteriores.

## Throughput HTTP con backend propio

Las metodologías quedan separadas: latencia = TCP Connect RTT hasta `connect`; throughput = HTTP hacia el backend del TP, contando bytes del payload y midiendo con reloj monotónico desde `send` hasta el cuerpo completo/ACK. La sesión combina `Network snapshot + Latency results + Throughput results`; al completar, ubicación y resultados se guardan localmente.

```text
Download:
Mobile → GET /download → Backend → payload binario → Mobile cuenta bytes y calcula Mbps

Upload:
Mobile genera payload → POST /upload → Backend cuenta bytes → ACK receivedBytes → Mobile calcula Mbps
```

El mobile verifica `GET /health` primero, pide exactamente 5.000.000 bytes de descarga y envía 2.000.000 bytes de subida. Rechaza discrepancias con la longitud recibida o con el ACK del servidor. El backend limita descarga a 20.000.000 bytes y subida a 5.000.000 bytes, no persiste el cuerpo, desactiva la caché con headers y no incorpora compresión. La URL editable está en `mobile/src/config/backend.ts`: iOS Simulator usa `localhost`; Android Emulator usa `10.0.2.2`; en un teléfono físico se debe indicar manualmente la IP LAN del computador.

La fórmula es `Mbps = bytes × 8 ÷ duración_en_segundos ÷ 1.000.000` (megabits por segundo decimal), no MB/s (megabytes por segundo). La duración de descarga acaba al recibir el cuerpo binario; la de subida acaba con la respuesta de confirmación, por lo que incluye el ACK HTTP del backend.

## Ubicación, persistencia e historial

```text
Measurement Engine
      ↓
Location Service (consentimiento + GPS actual)
      ↓
Measurement Repository (mapper + transacción)
      ↓
SQLite local
      ↓
History UI → Detail / Delete
```

`locationService.ts` reutiliza `@react-native-community/geolocation`. No se consulta al iniciar la aplicación. Al finalizar una sesión no cancelada se explica el motivo de uso y se solicita permiso en contexto. Android pide Fine y Coarse en runtime (acepta ubicación aproximada); iOS usa el permiso When In Use y la descripción existente en `Info.plist`. Solicita alta precisión, sin caché (`maximumAge: 0`), con timeout de 15 s y descarta fixes con precisión mayor a 500 m, coordenadas inválidas o accuracy desconocida. Si no hay fix válido, la sesión queda visible en pantalla, no se guarda y el usuario puede reintentar el GPS sin repetir la medición.

`database.ts` abre una conexión singleton perezosa y ejecuta una vez las migraciones versionadas por `PRAGMA user_version`. Schema 1 contiene:

- `measurements`: timestamps, lat/lon obligatorias, precisión/fecha GPS, snapshot de red, resumen global RTT/jitter/loss, download/upload y created_at.
- `measurement_targets`: host/puerto, sondas enviadas/recibidas/perdidas y estadísticas por destino. FK a la sesión con `ON DELETE CASCADE`.
- Índices sobre `started_at` y `connection_type` para historial y filtros futuros.

`saveMeasurement()` convierte el resultado ya calculado (no vuelve a ejecutar mediciones), genera un UUID desde `randomblob()` SQLite y escribe fila principal y destinos mediante una única transacción. Nitro SQLite revierte automáticamente si una operación de la transacción falla. Historial consulta las sesiones por `started_at DESC`; detalle obtiene destinos asociados; eliminar una sesión usa la cascada. El módulo de UI no contiene SQL.

La base vive solo en almacenamiento privado local del dispositivo. Lat/lon nunca se envían a los endpoints de throughput ni se sincronizan a servicios externos. No se hace geocoding.

## Visualización geográfica y temporal

```text
SQLite
  ↓
Geo/Chart Query (columnas mínimas, sin targets)
  ↓
Quality Score / series temporales
  ↓
WebView → Leaflet + OpenStreetMap + leaflet.heat / SVG charts
  ↓
Detalle compartido por Historial y Mapa
```

`getMeasurementsForMap()` selecciona ID, fecha, lat/lon, conexión y métricas agregadas en orden descendente. `getMeasurementsForCharts()` selecciona fecha, RTT, jitter, pérdida, download, upload y tipo de red en orden ascendente. Ninguna query visual carga `measurement_targets` ni pide al backend. Cada pantalla recarga SQLite al entrar, de modo que el historial y el mapa reflejan las sesiones guardadas o eliminadas.

`qualityScore.ts` produce un índice académico de 0–100. RTT, pérdida, download y upload se transforman mediante escalas lineales con umbrales documentados en README; sus pesos son 35/30/20/15 %. Un dato ausente queda excluido y los pesos restantes se renormalizan; sin datos suficientes retorna `null`. Pérdida severa o RTT muy alto limitan la categoría máxima. `mapData.ts` deriva la categoría, el color del pin y un peso de severidad para el calor. Los pesos se mantienen en `0.05–1`; `leaflet.heat` los interpreta como **intensidad relativa** y combina puntos próximos. El gradiente del heatmap no equivale directamente al score individual.

En Android e iOS, `react-native-webview` 16.0.0 aloja un documento HTML con Leaflet 1.9.4, `leaflet.heat` y tiles de OpenStreetMap. La query SQLite `getMeasurementsForMap()` entrega solo sesiones reales; `webMapData.ts` prepara JSON con coordenadas, métricas, `qualityScore`, categoría, color y severidad. React Native inyecta esos datos y cambia Puntos/Heatmap sin recrear el WebView. Leaflet ajusta bounds a las mediciones o muestra Argentina como vista general vacía. Los popups envían el ID por `postMessage`; React Native verifica la sesión con `getMeasurementById()` y abre el detalle existente. La atribución **© OpenStreetMap contributors** queda visible. Se necesita Internet para tiles y los scripts CDN; no se necesita API key, Google Cloud ni facturación. No hay precarga masiva ni descarga offline.

`TrendsScreen` utiliza `react-native-svg` 15.15.5 para líneas y puntos de latencia, download y upload. `chartData.ts` ordena por timestamp real, omite nulos y fechas inválidas y conserva un solo punto cuando solo existe una observación. El eje X muestra primera y última fecha para no saturarse con cientos de etiquetas. El detalle de una sesión se obtiene mediante el mismo `getMeasurementById()` tanto desde Historial como desde Mapa.

Las mediciones permanecen en SQLite local. Al abrir el mapa, OpenStreetMap recibe las solicitudes de tiles del área visualizada; eso es independiente del backend de throughput, que no recibe GPS.

## Background QoS y notificaciones locales

```text
Background Scheduler (Background Fetch / Headless JS Android)
  ↓
Background QoS Check (NetInfo, 3 sondas TCP por destino, 25 s máximo)
  ↓
Latency Engine existente (sockets y estadísticas)
  ↓
Degradation Rules (función pura)
  ↓
Notifee → notificación local si severo y cooldown cumplido
```

El monitor se activa de forma contextual en Estado; `App` solo re-registra la preferencia persistida al abrir y `index.js` registra Headless JS fuera de React. `backgroundService` centraliza el scheduler, cancelación y `finish`; `backgroundMeasurement` reutiliza `runLatencySession` y el mutex compartido con la medición manual. No consulta GPS, no ejecuta throughput y no inserta en la tabla `measurements` de sesiones completas. `background_monitor_settings` (migración SQLite 2) conserva solo preferencia, última ejecución/estado/RTT/pérdida y último aviso para cooldown de 30 minutos.

Los umbrales centralizados son severo ante offline, RTT ≥200 ms, jitter ≥80 ms, pérdida ≥10 % o ≥2 destinos completamente inaccesibles; degradado ante RTT ≥100 ms, jitter ≥40 ms o pérdida ≥3 %. Solo severo puede notificar. Un resultado abortado, vencido o sin targets no se convierte en alerta severa. El presupuesto global aborta sockets y timers; el timeout del SO también cancela y finaliza la tarea. El scheduler no exige conectividad para poder detectar el caso offline.

Android permite Headless JS después de terminar la actividad y reinicio del dispositivo cuando el SO lo permite. iOS usa `UIBackgroundModes=fetch` y `com.transistorsoft.fetch`; la ejecución es oportunista, puede demorarse y se detiene tras cierre forzado. La configuración no desactiva New Architecture. No se piden permisos de ubicación Always ni `ACCESS_BACKGROUND_LOCATION`; Notifee requiere permiso contextual para alertas y Android usa `POST_NOTIFICATIONS` en API 33+.

## Filtros y exportación

```text
HistoryScreen
  ├─ filtros red/generación/fecha → SQLite WHERE parametrizado
  ├─ centro/radio → Haversine puro sobre candidatas
  └─ IDs visibles → getMeasurementsForExport()
                    → Quality Score reutilizado
                    → CSV o JSON
                    → archivo caché local → share sheet
```

`getMeasurementsByFilters()` hace `connection_type`, `cellular_generation` y límites UTC de `started_at` en SQLite; hay índices existentes sobre fecha y tipo. Las opciones de red/generación provienen de un `SELECT DISTINCT`, así que no se muestran valores ausentes. El filtro geográfico no usa SQL espacial ni geocoding: una medición guardada actúa como centro, y `distanceMeters()` calcula Haversine para 500 m, 1/5/10 km. Fecha Desde es inclusiva; Hasta se transforma al inicio exclusivo del día UTC siguiente. La lista visible es la fuente de IDs para exportación: filtros combinados y exportación comparten exactamente el mismo conjunto.

`getMeasurementsForExport()` recupera sesiones y targets solo para esos IDs en lotes de hasta 400, con parámetros SQL y preservando el orden visible. `serializeMeasurementsCsv()` produce una fila por sesión, con nulls vacíos, comillas duplicadas, campos entrecomillados cuando corresponde y protección frente a fórmulas de planilla. Los targets quedan fuera del CSV para mantener columnas estables; `serializeMeasurementsJson()` incluye cada destino completo. Ambos agregan `qualityScore` mediante **la misma** `calculateQualityScore()` usada por Mapa, sin duplicar umbrales. `exportService` escribe UTF-8 en caché privada con `react-native-blob-util` y abre la hoja nativa mediante `react-native-share`. Se advierte sobre coordenadas antes de crear/compartir el archivo; no hay upload automático.

Las bibliotecas de archivos y compartir se autolinkean con New Architecture habilitada. La validación por builds demuestra compatibilidad de compilación; el recorrido de share sheet y destino final requiere dispositivo/simulador interactivo. Véase `PRD-CHECKLIST.md` para estados RF y `EVIDENCIAS.md` para pruebas visuales.
