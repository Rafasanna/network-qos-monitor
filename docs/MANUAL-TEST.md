# Prueba manual y capturas — Network QoS Monitor

Esta guía usa datos reales. No requiere editar la lógica de medición ni guardar una IP privada en Git. Los comandos se ejecutan desde `~/Documents/CUARTO/APPM/TP5/network-qos-monitor` salvo que se indique otra cosa.

## A. Preparación

1. Ejecutar `bash scripts/demo-check.sh`. Confirmar Node 22.14.0 mediante `fnm`, SDK/Xcode y el dispositivo elegido. El puerto 3000 estuvo ocupado durante la inspección y luego quedó libre; usar **3207** para que la demo no dependa de ese proceso cambiante. No detener otros servicios.
2. Instalar dependencias solo si faltan: `cd backend && npm install`; `cd ../mobile && npm install`; para iOS, `cd ios && pod install`.
3. Terminal 1: `cd backend && fnm exec --using=22.14.0 env PORT=3207 HOST=0.0.0.0 npm run dev`. Mantenerla abierta. En otra terminal verificar `curl -fsS http://127.0.0.1:3207/health`; debe responder `{"status":"ok"}`. No hace falta descargar el payload para esta comprobación.
4. Elegir **una** URL para el bundle móvil antes de iniciar Metro (Terminal 2):

   | Entorno | `QOS_BACKEND_URL` |
   | --- | --- |
   | iOS Simulator | `http://localhost:3207` |
   | Android Emulator | `http://10.0.2.2:3207` |
   | Teléfono físico Android/iOS | `http://<IP_LAN_DEL_MAC>:3207` |

   Obtener la IP actual con `ipconfig getifaddr en0` o revisar la interfaz WiFi activa con `ifconfig`. No copiar la IP a ningún archivo versionable. Teléfono y Mac deben poder comunicarse por la misma red; VPN, red de invitados o firewall pueden impedirlo. Para el teléfono, abrir `http://<IP_LAN_DEL_MAC>:3207/health` en su navegador antes de medir.
5. Terminal 2, desde `mobile/`: `QOS_BACKEND_URL=http://10.0.2.2:3207 fnm exec --using=22.14.0 npm start -- --reset-cache` para Android Emulator. Para otro entorno, sustituir **la URL completa** por la de la tabla. **La variable se incorpora al bundle por Metro**: si se cambia de entorno/IP, cerrar Metro y reiniciarlo con la nueva URL y `--reset-cache`; recargar la app. Sin variable, permanecen los defaults originales del proyecto en puerto 3000.
6. Terminal 3, desde `mobile/`: `fnm exec --using=22.14.0 npm run android` con el emulador/dispositivo Android ya iniciado, **o** `fnm exec --using=22.14.0 npm run ios -- --simulator "iPhone 17 Pro"`. En iPhone físico se necesita firma/configuración de Xcode. No iniciar simultáneamente dos Metros con URLs diferentes.
7. Asegurar Internet en el dispositivo para descargar Leaflet/leaflet.heat desde CDN y tiles de OpenStreetMap. **No se necesita API key, Google Cloud ni facturación.** Verificar que la atribución **© OpenStreetMap contributors** sea visible.

## B. Happy Path

Seguir el orden; tomar las capturas indicadas en la sección D mientras la pantalla correspondiente está abierta.

1. Abrir la app y verificar **Estado de red** en WiFi. Si hay un Android físico con SIM, cambiar a datos y volver para comprobar los datos celulares; no exigir operador/RSSI en iOS.
2. Ir a **Medir** y pulsar **Iniciar medición**. Capturar el progreso mientras se ejecutan las sondas TCP a tres destinos.
3. Esperar las tres fases: latencia (**RTT**, jitter y pérdida), **descarga** y **subida**. Confirmar que el backend sigue activo. Un valor `No disponible` debe investigarse, no reemplazarse por datos ficticios.
4. Cuando la app pida ubicación, aceptar **When In Use / Mientras se usa**. Esperar el GPS y el guardado SQLite. Si no hay coordenadas, la sesión puede verse en pantalla pero no ingresa al Historial; usar **Intentar ubicación nuevamente**.
5. Repetir una medición con otra conexión o ubicación real. Se necesitan al menos dos sesiones para mostrar tendencias; para un filtro de zona conviene que las ubicaciones estén separadas más que el radio elegido.
6. Abrir **Historial** y comprobar orden descendente. Abrir una sesión y revisar fecha, coordenadas, red, resultados globales y los tres targets.
7. Abrir **Mapa**. Con cero mediciones debe mostrar el mapa base y «Todavía no hay mediciones para mostrar.». Con al menos dos mediciones reales, alternar **Puntos/Heatmap**, tocar un punto y usar **Ver detalle** para abrir la pantalla existente. Confirmar tiles y atribución visibles en Android o iOS.
8. Abrir **Tendencias** desde Historial y revisar ejes temporales de RTT, download y upload de las sesiones reales.
9. Volver a Historial y aplicar filtros: red, fechas `AAAA-MM-DD` en **UTC**, y **Usar como centro** en una medición más radio. Comprobar filtros activos, resultado vacío y **Limpiar filtros**.
10. Con filtros activos, pulsar **Exportar resultados filtrados**, leer la advertencia de coordenadas y compartir **CSV**. Abrirlo y comprobar cabeceras y número de filas visibles. Repetir con **JSON** y comprobar `measurementCount`, coordenadas, `qualityScore` y `targets`. La exportación no sube archivos al backend.
11. Volver a **Estado**; activar **Monitoreo en segundo plano** y conceder notificaciones. Registrar estado/última ejecución. Si aparece **Probar notificación** en desarrollo, usarlo y rotular la captura como prueba. La frecuencia real del scheduler no es exactamente 15 minutos; simular el evento según la documentación de background del README. No se ejecuta throughput/GPS en este chequeo.

## C. Casos secundarios

- **Backend inaccesible:** cerrar o bloquear temporalmente el acceso *después* del happy path; `/health` debe fallar y la app mostrar “Servidor de medición no disponible”, sin inventar Mbps. No detener el proceso que ocupa 3000.
- **GPS denegado:** realizar otra medición, denegar ubicación y comprobar que se ve el resultado pero no se guarda; luego reintentar ubicación. No usar coordenadas falsas.
- **Sin conectividad:** desconectar la red y comprobar Estado y manejo del error de sockets. Restaurarla antes de continuar.
- **Filtros sin coincidencias:** elegir combinación que no devuelva filas; debe aparecer el mensaje específico, distinto al historial vacío.
- **Exportación filtrada:** contrastar IDs/contador del JSON con las cards visibles; el CSV tiene una fila por sesión y no incluye los targets individuales (sí están en JSON).
- **Background:** Android Headless JS y iOS Background Fetch están sujetos al sistema; el cierre forzado de iOS y force-stop de Android pueden impedir ejecuciones. Usar la prueba de notificación de desarrollo para evidenciar Notifee por separado del scheduler.

## D. Evidencias

Tomarlas **durante** los pasos anteriores para no repetir mediciones. La tabla y nombres exactos están en [EVIDENCIAS.md](EVIDENCIAS.md). Secuencia práctica: primero terminal/backend y validaciones; después `01`–`07` durante Estado/Medir/GPS, `08`–`09` en Historial/Detalle, `10`–`12` en Mapa/Tendencias, `15`–`16` al exportar, y finalmente `13`–`14` en Background. Los nombres conservan su numeración original aunque las capturas 15/16 se hagan antes que 13/14.

Antes de compartir capturas o archivos, revisar coordenadas, IP LAN y operador visibles. Las capturas de 4G/5G, señal y scheduler real requieren dispositivo físico y condiciones de red apropiadas; el simulador no las garantiza.
