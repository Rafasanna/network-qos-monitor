# Auditoría funcional RF-01 a RF-09

Estado al cierre de implementación. **COMPLETO** significa que el flujo está implementado y pasa pruebas automáticas/builds; no reemplaza la evidencia en teléfono físico. **PARCIAL** indica que falta comprobar una acción de UI/dispositivo. **LIMITACIÓN DE PLATAFORMA** indica que una parte del requisito depende de APIs, proveedor o scheduler del SO.

| RF | Estado | Implementación y archivos principales | Cómo demostrarlo / pendiente |
| --- | --- | --- | --- |
| RF-01 Red y operador | LIMITACIÓN DE PLATAFORMA | `src/services/networkStatusService.ts`, `src/features/network/NetworkStatusScreen.tsx`, `src/native/cellularInfo.ts`, `android/.../NativeCellularInfoModule.kt`, `ios/.../CellularInfoProvider.swift`. NetInfo actualiza estado; puente nativo consulta telefonía real cuando está expuesta. | Cambiar WiFi/datos en teléfono Android con SIM. En iOS operador y RSSI pueden permanecer `No disponible`; no se inventan. |
| RF-02 RTT de 3 hosts, min/avg/max/jitter | COMPLETO | `src/features/measurements/latencyEngine.ts`, `statistics.ts`, `config.ts`. Tres destinos TCP/443, cinco sondas manuales, timeouts y pérdida. | Ejecutar Medir y abrir cada destino. Comprobar que el RTT es TCP Connect, no ICMP. |
| RF-03 Download/upload Mbps | COMPLETO | `src/features/measurements/throughputEngine.ts`, `src/config/backend.ts`, `backend/src/server.ts`. Bytes reales y reloj monotónico; backend Fastify propio. | Iniciar backend local, verificar `/health`, medir y comparar bytes/ACK. IP LAN manual para teléfono. |
| RF-04 Timestamp + GPS | COMPLETO | `src/features/location/locationService.ts`, `src/storage/measurementRepository.ts`, `src/storage/migrations.ts`. GPS contextual; no guarda sin coordenadas; sesión y targets transaccionales. | Aceptar ubicación tras medir, abrir detalle y ver fecha/coordenadas; probar denegación. |
| RF-05 Mapa + heatmap | PARCIAL | `MapScreen.tsx`, `webMapData.ts`, `mapData.ts`, `qualityScore.ts` y `getMeasurementsForMap()`. Leaflet + OpenStreetMap en WebView para Android/iOS, con Puntos y `leaflet.heat` basados en SQLite real. | Abrir mapa vacío con tiles y atribución visible; luego realizar ≥2 mediciones reales, comprobar Puntos/Heatmap y abrir detalle. Requiere Internet, sin API key ni facturación. |
| RF-06 Series temporales | COMPLETO | `src/features/history/TrendsScreen.tsx`, `chartData.ts`, query `getMeasurementsForCharts()`. SVG con fechas reales y nulls omitidos. | Guardar ≥2 sesiones y abrir Tendencias desde Historial. |
| RF-07 Background + degradación | LIMITACIÓN DE PLATAFORMA | `src/features/background/`, `measurementMutex.ts`, `index.js`, migración 2. Chequeo liviano, Headless Android, Notifee local, cooldown. | Activar en Estado, probar aviso y simular job. iOS es oportunista y se detiene tras cierre forzado; Android sujeto a política energética/force-stop. Scheduler real aún requiere teléfono físico. |
| RF-08 CSV/JSON | PARCIAL | `src/features/export/serialization.ts`, `exportService.ts`, acción Exportar en `HistoryScreen.tsx`. SQLite real, CSV por sesión y JSON con targets. | Falta verificar visualmente share sheet, Guardar en Archivos/AirDrop o app instalada en dispositivos reales. Tests de contenido y builds pasan. |
| RF-09 Filtros | PARCIAL | `src/features/history/historyFilters.ts`, `HistoryScreen.tsx`, `measurementRepository.ts`. Red/generación, fechas UTC, centro elegido + radio Haversine; exporta solo visibles. | Falta recorrido manual de UI con datos de distintas redes/días/zonas; reglas puras y SQL parametrizado están probados. |

## Decisiones y bordes

- **RTT:** tiempo de establecimiento de conexión TCP medido con `performance.now()`; no equivale a ICMP Echo. DNS puede afectar la primera sonda de un dominio.
- **Jitter:** media de diferencias absolutas entre RTT exitosos consecutivos. **Pérdida:** sondas fallidas / enviadas × 100.
- **Throughput:** transferencia HTTP al backend configurado, no a Speedtest; Mbps = bits transferidos / segundos / 1.000.000. No se infiere velocidad contratada.
- **GPS:** las sesiones completas se guardan solo con coordenadas válidas. Los chequeos background no tienen GPS/throughput y no contaminan `measurements`.
- **CSV:** una fila por sesión; los destinos individuales completos están solo en JSON. Coordenadas hacen sensible el archivo; se advierte antes de compartir.
- **Fechas:** filtro por día calendario UTC, desde inclusivo y hasta inclusivo por límite exclusivo del siguiente día. **Zona:** círculo alrededor de una medición elegida (500 m, 1/5/10 km), sin geocoding.
- **Privacidad:** SQLite y archivos temporales de exportación permanecen locales hasta que la persona elige destino en la hoja nativa. El backend no recibe GPS.

## Evidencia faltante antes de entrega

Seguir `EVIDENCIAS.md`. Particularmente: celular real Android, GPS y tiles de mapa, notificación en teléfono, share sheet CSV/JSON y un recorrido de filtros combinados. No declarar esos escenarios “validados físicamente” hasta obtener capturas.
