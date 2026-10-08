# Evidencias de entrega

No hay capturas de dispositivo incluidas todavía. Tomarlas sobre datos reales (sesiones guardadas en SQLite); no cargar fixtures productivos ni editar imágenes para simular valores. Se sugiere guardarlas fuera del repositorio o en una carpeta explícita antes de la entrega.

Orden práctico de captura (sin renombrar archivos): **18 → 19 → 20 → 21 → 17 → 01–12 → 15 → 16 → 13 → 14**. Los tests/builds se capturan antes de abrir la app; CSV/JSON se capturan desde Historial antes de pasar a Background.

| Archivo sugerido | Qué debe verse | Condición |
| --- | --- | --- |
| `01-estado-wifi.png` | Estado de red: conectado, WiFi, Internet disponible | WiFi real |
| `02-estado-cellular.png` | Estado de red: Cellular y generación cuando esté disponible | Teléfono con datos móviles |
| `03-native-cellular-info.png` | Bloque operador/tecnología/señal o `No disponible` justificado | Preferir Android físico con SIM; iOS muestra límites reales |
| `04-medicion-en-progreso.png` | Target, sonda y etapa 1/3 | Durante RTT |
| `05-resultados-rtt.png` | Tres destinos, min/avg/max, jitter, pérdida | Medición terminada |
| `06-throughput.png` | Download/Upload Mbps y backend accesible | Backend propio activo |
| `07-gps-guardado.png` | Confirmación de guardado tras ubicación | GPS válido; no exponer ubicación si la captura circulará públicamente |
| `08-historial.png` | ≥2 sesiones reales, orden descendente | SQLite local |
| `09-detalle.png` | Fecha, coordenadas, red, QoS y targets | Abrir desde Historial |
| `10-mapa-puntos.png` | Pines reales y llamada a detalle | Leaflet + OpenStreetMap en Android/iOS; tiles y atribución visibles |
| `11-heatmap.png` | Heatmap de leaflet.heat con ≥2 mediciones reales | ≥2 puntos y tiles visibles |
| `12-tendencias.png` | Series RTT, download y upload con fechas reales | ≥2 sesiones |
| `15-export-csv.png` | Hoja de compartir/archivo CSV y, si es posible, cabeceras verificadas | Con filtros activos, contrastar filas visibles |
| `16-export-json.png` | Hoja de compartir/archivo JSON con `targets` | Mismos filtros; verificar `measurementCount` |
| `13-background-activo.png` | Toggle activo, permiso y última ejecución | Tras evento simulado o real |
| `14-notificacion.png` | Alerta local severa o botón de prueba claramente identificado | Permiso concedido; no inventar valores |

## Capturas de terminal adicionales

| Archivo sugerido | Comando y resultado esperado |
| --- | --- |
| `18-backend-tests.png` | `cd backend && npm test` y `npm run build`, ambos sin errores. |
| `19-mobile-tests.png` | `cd mobile && npm test -- --runInBand`, `npx tsc --noEmit` y `npm run lint`. |
| `20-android-build.png` | `cd mobile/android && ./gradlew assembleDebug --console=plain` con `BUILD SUCCESSFUL`. |
| `21-ios-build.png` | `cd mobile/ios && xcodebuild -workspace NetworkQosMonitor.xcworkspace -scheme NetworkQosMonitor -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` con salida exitosa. |
| `17-backend-terminal.png` | `cd backend && PORT=3207 HOST=0.0.0.0 npm run dev`; mostrar `GET /health` con `{"status":"ok"}` en 3207. |

## Orden recomendado de captura

1. Capturar tests/builds, iniciar backend en 3207 y comprobar `/health`; conectar teléfono/simulador a su URL correcta.
2. Capturar Estado en WiFi; cambiar a datos móviles en un equipo físico y capturar red/celular.
3. Medir una sesión completa, aceptar GPS, capturar progreso y resultados.
4. Medir al menos otra sesión para que mapa y tendencias tengan puntos.
5. Recorrer Historial → Detalle → Mapa Puntos/Heatmap → Tendencias.
6. En Historial, probar filtros combinados (red + fecha + radio), exportar CSV y JSON de los resultados visibles y revisar sus contenidos (`15`, `16`).
7. Activar background, probar permiso/notificación y usar simulación oficial del scheduler (`13`, `14`); no esperar exactamente 15 minutos.

Antes de publicar evidencias, revisar coordenadas, IP LAN, operador y notificaciones visibles. Redactar datos privados si la entrega se hará pública, sin alterar las métricas técnicas.
