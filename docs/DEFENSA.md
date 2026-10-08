# Defensa oral (3–5 minutos)

## Guion

**0:00–0:35 — Problema.** Network QoS Monitor busca registrar cómo cambia la calidad de conexión que experimenta un dispositivo móvil. No pretende certificar a un operador ni sustituir una medición de laboratorio: muestra estado de red, latencia TCP, pérdida, jitter y velocidad de transferencia hacia destinos concretos, junto con lugar y momento.

**0:35–1:10 — Arquitectura.** La interfaz está en React Native 0.87.1 con New Architecture. NetInfo entrega conectividad general. Un TurboModule con Codegen consulta `TelephonyManager` en Android y `CoreTelephony` en iOS para los datos de radio que cada plataforma permite. Las reglas de medición y calidad no viven en las pantallas. El backend Fastify solo entrega/recibe bytes para throughput.

**1:10–2:00 — Medición.** Para cada uno de tres destinos, la app hace cinco conexiones TCP: mide desde antes de abrir el socket hasta conectarse, cierra el socket y calcula min/promedio/máximo. Jitter es la media de diferencias absolutas entre RTT exitosos consecutivos; pérdida es fallidas/enviadas. Esto se llama **TCP Connect RTT**, no ping ICMP. La descarga/subida se hacen mediante HTTP contra el backend propio, contando bytes reales y duración con `performance.now()`; `Mbps = bits / segundo / 1.000.000`.

**2:00–2:45 — Datos y visualización.** Tras medir, la app solicita GPS con explicación contextual. Solo una sesión con coordenadas válidas se guarda en SQLite, dentro de una transacción con sus resultados por host. Historial abre el detalle; Mapa dibuja puntos reales y calor; Tendencias muestra series temporales. El score 0–100 es un índice académico ponderado, no una norma industrial.

**2:45–3:25 — Background y privacidad.** El monitoreo periódico es opcional y liviano: NetInfo + tres sondas TCP por host, sin throughput ni GPS. Solo degradación severa dispara notificación local con cooldown de 30 minutos. Android puede usar Headless JS; iOS decide cuándo ofrecer un fetch y no lo mantiene tras cierre forzado. Ubicación e historial permanecen locales; exportar CSV/JSON exige acción explícita y advierte sobre coordenadas.

**3:25–5:00 — Demo.** Seguir el happy path de README: Estado → Medir → guardar con GPS → Historial/Detalle → Mapa → Tendencias → Filtros → Exportar → Monitoreo background. Si no hay datos celulares o permisos en el simulador, mostrar `No disponible` y explicarlo; nunca presentar valores simulados como medición física.

## Preguntas que pueden hacerme

**¿Por qué no usar ping ICMP?** ICMP requiere capacidades/permiso de sockets especiales que no son uniformes en mobile. Un connect TCP/443 es ejecutable con APIs soportadas; mide establecimiento TCP, no Echo RTT.

**¿Por qué backend propio?** Permite conocer y verificar los bytes transferidos, controlar tamaño/caché y evitar que una API externa entregue una cifra opaca. El resultado depende del camino dispositivo ↔ backend configurado.

**¿Por qué SQLite?** Las sesiones son relacionales (una sesión, varios targets), locales y consultables para historial, mapa, series y exportación. La transacción evita resultados parciales.

**¿Por qué RSSI no aparece en iOS?** No existe una API pública soportada para RSSI celular. Usar APIs privadas o leer la barra de estado sería frágil e impropio; la app devuelve `null`.

**¿Por qué background no es exacto?** Android/iOS planifican según batería, uso y permisos. `minimumFetchInterval: 15` es un mínimo solicitado, no una alarma puntual; iOS detiene fetch tras cierre forzado.

**¿Cómo funciona el mapa sin API key?** Leaflet corre dentro de React Native WebView en Android e iOS. OpenStreetMap provee los tiles y `leaflet.heat` dibuja el calor usando la severidad derivada del score existente. Requiere Internet para cargar recursos, pero no Google Cloud, facturación ni claves.

**¿Qué diferencia hay entre Mbps y MB/s?** Mbps son megabits por segundo; MB/s son megabytes por segundo. Un byte equivale a ocho bits: 8 Mbps ≈ 1 MB/s antes de overhead.

**¿Qué es jitter?** Variación del RTT entre sondas exitosas consecutivas. Aquí se promedia el valor absoluto de cada diferencia, en milisegundos.

**¿Qué significa packet loss?** Porcentaje de intentos TCP que fallaron o agotaron timeout respecto de las sondas enviadas; una cancelación explícita no cuenta como pérdida.

**¿Cómo se filtra una zona?** Se elige una sesión como centro y se calcula distancia Haversine a cada sesión candidata; fecha y tipo de red se reducen antes mediante SQLite.

**¿CSV y JSON contienen lo mismo?** Los campos resumen sí. CSV tiene una fila por sesión para planillas; JSON además contiene el arreglo completo de targets.
