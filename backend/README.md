# Backend de throughput

Servicio local Fastify + TypeScript usado exclusivamente para las pruebas de throughput de la app. No consulta Speedtest.net ni servicios externos. No guardar archivos, cuentas, datos personales ni secretos.

## Ejecutar

Requiere Node 22.11 o posterior. Desde `backend/`:

```sh
npm install
cp .env.example .env
npm run dev
```

El servidor escucha por defecto en `0.0.0.0:3000`, para aceptar conexiones del simulador o de dispositivos en una red accesible. `HOST`, `PORT`, `DOWNLOAD_DEFAULT_BYTES`, `DOWNLOAD_MAX_BYTES` y `UPLOAD_MAX_BYTES` se pueden cambiar en `.env`. El `.env.example` fija 5.000.000 bytes para la descarga por defecto, 20.000.000 como máximo de descarga y 5.000.000 como máximo de subida.

Scripts disponibles: `npm run dev`, `npm test`, `npm run build` y `npm start` (tras compilar).

## Endpoints

- `GET /health` → `{"status":"ok"}`.
- `GET /download?bytes=N` → payload binario `application/octet-stream` con longitud conocida. Si se omite `bytes`, envía 5.000.000 bytes; rechaza tamaños cero, inválidos o mayores al máximo de 20.000.000. El payload acotado se genera en memoria y no se escribe al disco.
- `POST /upload` → acepta solo `application/octet-stream`, cuenta bytes sin guardar el cuerpo y devuelve `{"receivedBytes":N}`. El límite por defecto es 5.000.000 bytes.

La descarga responde `Content-Length` y `Cache-Control: no-store, no-cache, must-revalidate`; el servidor no incluye middleware de compresión. El cliente agrega nonce a cada URL para evitar reutilizar una descarga cacheada.

## Conectar la app

`mobile/src/config/backend.ts` centraliza la URL. Los defaults sirven para los simuladores: iOS usa `localhost:3000`; Android Emulator usa `10.0.2.2:3000` para alcanzar el host. Para un dispositivo físico, reemplazar el valor por la IP LAN del equipo que ejecuta el backend, por ejemplo `http://192.168.1.25:3000`. En macOS la IP WiFi suele consultarse con `ipconfig getifaddr en0` (la interfaz puede variar); computadora y teléfono deben estar en una red que permita comunicación entre ambos. Abrir/configurar firewalls manualmente si hiciera falta; el proyecto no los modifica.

Este backend es para desarrollo y demostración local, sin autenticación ni TLS. No exponerlo a redes no confiables o a Internet.
