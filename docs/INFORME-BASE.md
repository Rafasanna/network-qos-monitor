# Network QoS Monitor — Informe base del TP5

**Asignatura:** Desarrollo de Aplicaciones Móviles  
**Proyecto:** Network QoS Monitor  
**Versión del informe:** base para completar con capturas y pruebas físicas. No presenta valores de red inventados.

## 1. Introducción

La experiencia de conectividad de un teléfono cambia según tecnología de acceso, cobertura, congestión y ruta hacia el servicio usado. Un indicador de “conectado” no alcanza para describir esa experiencia: una conexión puede existir y, sin embargo, tener latencia alta, variación temporal, pérdida de intentos o baja velocidad. Network QoS Monitor reúne estas observaciones en una aplicación móvil nativa React Native y vincula cada sesión completa con fecha y coordenadas para consultarla más tarde.

El sistema separa los datos informados por el sistema operativo de los resultados medidos activamente. NetInfo y las APIs de telefonía describen la red observada; sockets TCP y transferencias HTTP producen métricas de calidad. Esta distinción evita presentar como “medición” un dato inferido o no disponible. El proyecto está pensado para demostración académica y análisis local, no para certificar capacidad de una red ni tomar decisiones de seguridad operativa.

[CAPTURA: 01-estado-wifi]  
[CAPTURA: 02-estado-cellular]

## 2. Objetivos

El objetivo general es construir una aplicación Android/iOS que mida y visualice calidad de red georreferenciada. Los objetivos específicos son: detectar conexión y datos celulares que la plataforma exponga; medir RTT TCP de tres destinos y derivar min/promedio/máximo, jitter y pérdida; medir download/upload Mbps hacia un backend propio; guardar sesiones completas con GPS en SQLite; explorar historial, detalle, mapa y tendencias; realizar chequeos livianos opcionales en background; exportar registros reales y aplicar filtros por red, fecha y zona.

Un principio transversal es representar la ausencia de información mediante `null`/“No disponible”. El simulador, la ausencia de SIM, los permisos denegados o las restricciones de Apple no se sustituyen por valores de ejemplo. También se prioriza el consentimiento contextual: GPS se pide al guardar una sesión y notificaciones al activar monitoreo, no al abrir la app.

## 3. Arquitectura

La solución consta de `mobile/` y `backend/`. Mobile usa React Native 0.87.1 con New Architecture/Fabric, TypeScript strict, proyectos nativos Kotlin y Swift, y librerías autolinkeadas. El backend Fastify TypeScript expone `GET /health`, `GET /download` y `POST /upload`; no recibe GPS ni guarda resultados. El flujo de una sesión manual es: snapshot de red → latencia TCP → throughput HTTP → ubicación → transacción SQLite → presentación. Las pantallas no ejecutan SQL ni abren sockets directamente: usan motor, servicios y repository.

El puente `NativeCellularInfo` se define con una spec TypeScript de Codegen. Android implementa la interfaz mediante `TelephonyManager`; iOS usa un adaptador Objective-C++ hacia Swift/CoreTelephony. El motor de latencia se reutiliza en foreground y background con diferente cantidad de sondas. El monitor background mantiene sus preferencias/último estado en una tabla separada de las sesiones georreferenciadas. Exportación lee los IDs visibles tras filtrar y recupera solo los detalles asociados a ellos.

[CAPTURA: esquema de docs/ARCHITECTURE.md]

## 4. Adquisición de datos de red

`@react-native-community/netinfo` observa conexión, tipo general (WiFi, cellular, Ethernet u otro), alcance estimado de Internet y generación celular cuando el SO la entrega. Un servicio compartido mantiene una suscripción y limpia el listener al desaparecer el último consumidor. La pantalla puede forzar una nueva consulta mediante “Actualizar información”. Estos datos no incluyen de manera uniforme el operador ni RSSI celular.

En Android, el módulo Kotlin consulta nombre de operador, tecnología de datos, roaming y señal cuando el modem y permisos públicos lo permiten. Se privilegia la suscripción de datos activa en dual SIM y se evitan identificadores personales como IMEI/IMSI. En iOS, `serviceCurrentRadioAccessTechnology` informa tecnología y puede mapearse a generación; el operador y RSSI se dejan nulos porque las APIs públicas actuales no ofrecen un resultado soportado y confiable. El contrato nativo tipado es nullable para reflejar estas diferencias.

[CAPTURA: 03-native-cellular-info]

## 5. Motor de medición QoS

El RTT implementado es **TCP Connect RTT**, no ICMP ping. Antes de abrir cada socket se registra `performance.now()`; cuando la conexión se establece se registra el instante final y se destruye el socket. Los tres destinos configurados inicialmente son Cloudflare, Google y GitHub en TCP/443. La sesión manual hace cinco sondas secuenciales por destino, con timeout de 3 s e intervalo de 250 ms. Un timeout o error cuenta como sonda fallida; una cancelación explícita detiene el socket y no se contabiliza como pérdida.

Para un host, min/promedio/máximo utilizan únicamente RTT exitosos. El jitter es la media de `|RTT(n) - RTT(n−1)|` entre éxitos consecutivos; sin dos éxitos es nulo. La pérdida es `fallidas / enviadas × 100`. La primera conexión a un dominio puede incluir resolución DNS, de modo que la métrica representa el establecimiento observado por la app y no una latencia de enlace aislada.

El throughput usa HTTP hacia el backend propio. Download pide 5.000.000 bytes, verifica tamaño real y `Content-Length`; upload envía 2.000.000 bytes de payload no sensible y verifica `receivedBytes`. El tiempo monotónico de descarga termina al recibir todos los bytes; el de subida, al recibir el ACK del backend. La fórmula es `Mbps = bytes × 8 / segundos / 1.000.000`. Los endpoints limitan tamaño, no comprimen y evitan caché; si el backend no está disponible, la app muestra error sin inventar velocidad. El resultado depende de la ruta, del servidor y de la capacidad del dispositivo.

[CAPTURA: 04-medicion-en-progreso]  
[CAPTURA: 05-resultados-rtt]  
[CAPTURA: 06-throughput]

## 6. Persistencia y georreferenciación

Al finalizar una medición manual no cancelada, la app explica el uso de ubicación y pide un fix actual. La consulta tiene timeout de 15 s, no acepta caché y descarta coordenadas inválidas o precisión peor a 500 m. Si no hay permiso o posición aceptable, la sesión permanece visible en memoria y se ofrece reintentar ubicación; no se escribe una fila incompleta. No se solicita permiso Always ni ubicación en background.

SQLite local contiene `measurements` con timestamps, coordenadas, snapshot y resúmenes, y `measurement_targets` con cada host y sus estadísticas. La relación usa clave foránea con cascada. Una transacción inserta sesión y targets o revierte todo. `PRAGMA user_version` controla migraciones: versión 1 creó sesiones/targets; versión 2 agregó estado mínimo del monitor background. Índices sobre fecha y tipo de conexión permiten historial y filtros. Los identificadores se generan con bytes aleatorios de SQLite, no con `Math.random()`.

[CAPTURA: 07-gps-guardado]  
[CAPTURA: 08-historial]  
[CAPTURA: 09-detalle]

## 7. Visualización y exploración

Historial lista sesiones más recientes primero y permite abrir detalle o eliminar con confirmación. Mapa consulta solo columnas geográficas y métricas agregadas; no carga todos los targets para dibujar puntos. Un círculo de Leaflet abre un resumen y permite navegar al detalle compartido. Android e iOS usan Leaflet + OpenStreetMap dentro de React Native WebView y `leaflet.heat` para el calor. La severidad procede del mismo score de calidad; se necesita Internet para los tiles y scripts CDN, sin API key, Google Cloud ni facturación.

Un score académico 0–100 combina RTT, pérdida, download y upload con pesos 35/30/20/15 %. Los campos ausentes se excluyen y se renormalizan los pesos; pérdida o RTT severos limitan la categoría máxima. Ese score alimenta categorías de calidad y visualización relativa, pero no es una norma universal de QoS. Tendencias muestra series con fechas reales y omite métricas nulas sin inventar puntos.

Los filtros del historial combinan tipo de red y generación celular disponible, rango de fechas UTC y una zona circular alrededor de una medición elegida. Red y fecha se aplican en SQLite mediante parámetros; la distancia se calcula con Haversine sobre las filas candidatas. Radios ofrecidos: 500 m, 1 km, 5 km y 10 km. No se hace geocoding ni consulta Google Places. CSV y JSON exportan únicamente la selección visible, previa advertencia por coordenadas.

[CAPTURA: 10-mapa-puntos]  
[CAPTURA: 11-heatmap]  
[CAPTURA: 12-tendencias]  
[CAPTURA: 15-export-csv]  
[CAPTURA: 16-export-json]

## 8. Background

El monitor periódico es opcional. Solicita aproximadamente un evento cada 15 minutos mediante `react-native-background-fetch`; el SO decide si y cuándo lo entrega. Cada evento consulta NetInfo y realiza solo tres conexiones TCP por host, con timeout individual de 2 s y límite global de 25 s. No descarga megabytes, no sube payload y no obtiene GPS. Un mutex evita superponerlo con la sesión manual. Si el SO exige terminar, se abortan sockets/timers y se llama `finish()` para no dejar una tarea pendiente.

Las reglas severas son: desconexión, RTT global ≥200 ms, jitter ≥80 ms, pérdida ≥10 % o dos destinos totalmente inaccesibles. Solo severo genera notificación local Notifee, con cooldown persistido de 30 minutos. Android registra Headless JS y puede continuar después de terminar la actividad; force-stop o políticas de energía pueden impedirlo. iOS ejecuta oportunistamente y deja de ofrecer fetch tras cierre forzado. Las pruebas automáticas verifican reglas y ciclo de cancelación, pero la frecuencia del scheduler y la recepción real de alertas requieren dispositivos físicos.

[CAPTURA: 13-background-activo]  
[CAPTURA: 14-notificacion]

## 9. Seguridad y privacidad

Historial y ubicación se mantienen en SQLite privado del dispositivo; el backend local no recibe coordenadas. Los archivos CSV/JSON se escriben en caché local y solo se comparten cuando la persona confirma formato y destinatario en la hoja nativa. CSV protege campos de texto frente a fórmulas de planilla; JSON incluye targets y CSV solo una fila resumen por sesión. Las claves Maps, configuraciones `.env`, keystores y artefactos de build se excluyen de Git. No hay autenticación, sincronización cloud ni servidor público; el backend de demostración no debe exponerse a redes no confiables.

El proveedor de mapas puede recibir solicitudes de tiles cuando se abre Mapa, distintas del backend de throughput. Una captura de pantalla o archivo exportado puede revelar coordenadas, IP LAN u operador, por lo que se deben revisar antes de compartir públicamente.

## 10. Limitaciones

iOS no expone RSSI celular mediante la API pública usada y el nombre del operador puede no estar disponible; los simuladores pueden carecer de datos de radio. Background Fetch no tiene frecuencia garantizada y un cierre forzado interrumpe eventos iOS. El mapa en ambas plataformas usa tiles OpenStreetMap con atribución visible y requiere Internet; el scheduler Android depende de políticas energéticas. TCP Connect RTT no es ICMP y puede incluir DNS inicial. Throughput refleja la ruta hasta el backend configurado, no la velocidad contratada ni todos los servicios de Internet. La entrada de fechas se mantiene simple (`AAAA-MM-DD`, UTC) para evitar un date picker adicional.

## 11. Pruebas

Se ejecutan tests unitarios Jest para estadísticas, sockets mockeados, throughput HTTP mockeado, bridge/mappers, GPS mockeado, migraciones/repository, score/mapa/chart data, background, serialización CSV/JSON, Haversine, SQL parametrizado y selección de exportación. Las pruebas unitarias no requieren Internet ni GPS real. Además deben registrarse resultados de TypeScript strict, ESLint, build backend, `pod install`, Android `assembleDebug`, iOS Simulator build y bundles Metro. Véase `EVIDENCIAS.md` para capturas exactas.

**Pendiente de completar antes de entregar:** versión/fecha de ejecución final, cantidad de suites/tests, equipos y SO físicos usados, capturas, resultados de escenarios WiFi/cellular, GPS, tiles, share sheet y notificaciones. No consignar cifras de RTT/Mbps ni éxito del scheduler físico sin observarlos.

[CAPTURA: 18-backend-tests]  
[CAPTURA: 19-mobile-tests]  
[CAPTURA: 20-android-build]  
[CAPTURA: 21-ios-build]

## 12. Conclusión

La implementación integra capacidades nativas, mediciones activas y almacenamiento local en un flujo reproducible: cada sesión completa reúne contexto de red, métricas, momento y posición, y puede consultarse o exportarse sin un servicio de sincronización. El diseño distingue claramente medición manual completa de chequeo background liviano y explicita cuándo una plataforma no entrega datos. La validación final para defensa consiste en recorrer el happy path en dispositivos reales, capturar evidencias y contrastar las limitaciones documentadas con el comportamiento observado.
