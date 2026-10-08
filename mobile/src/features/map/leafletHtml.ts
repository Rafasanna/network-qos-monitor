/** Static page: measurements are sent later through injectJavaScript, never embedded in HTML. */
export const LEAFLET_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
    body { background: #eef3f6; font-family: sans-serif; }
    .leaflet-control-attribution { font-size: 12px !important; background: rgba(255,255,255,.95) !important; }
    .popup-row { margin: 3px 0; }
    .popup-label { font-weight: 600; }
    .detail-button { margin-top: 8px; padding: 8px 10px; background: #2563eb; border: 0; border-radius: 7px; color: #fff; font-weight: 600; }
    #failure { display: none; position: absolute; inset: 0; z-index: 1000; padding: 24px; background: #eef3f6; color: #344054; }
  </style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
</head>
<body>
  <div id="map"></div>
  <div id="failure">No se pudo cargar el mapa. Comprobá la conexión a Internet.</div>
  <script>
    (function () {
      function send(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }
      function fail(message) {
        document.getElementById('failure').style.display = 'block';
        send({type: 'error', message: message});
      }
      if (!window.L) {
        fail('Leaflet no se pudo descargar.');
        return;
      }
      var map = L.map('map', {zoomControl: true}).setView([-38.4, -63.6], 4);
      var tileLoaded = false;
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      });
      tiles.on('tileload', function () {
        if (!tileLoaded) {
          tileLoaded = true;
          send({type: 'tilesLoaded'});
        }
      });
      tiles.addTo(map);

      var points = [];
      var mode = 'heatmap';
      var markers = L.layerGroup().addTo(map);
      var heat = null;

      function formatNumber(value, digits, unit) {
        return typeof value === 'number' && isFinite(value)
          ? value.toFixed(digits) + ' ' + unit : 'No disponible';
      }
      function addRow(container, label, value) {
        var row = document.createElement('div');
        row.className = 'popup-row';
        var name = document.createElement('span');
        name.className = 'popup-label';
        name.textContent = label + ': ';
        row.appendChild(name);
        row.appendChild(document.createTextNode(value));
        container.appendChild(row);
      }
      function popupFor(point) {
        var popup = document.createElement('div');
        var date = new Date(point.startedAt);
        addRow(popup, 'Fecha', isNaN(date.getTime()) ? 'No disponible' : date.toLocaleString('es-AR'));
        addRow(popup, 'Conexión', point.connectionType +
          (point.cellularGeneration ? ' · ' + point.cellularGeneration : ''));
        addRow(popup, 'RTT', formatNumber(point.globalAvgRttMs, 0, 'ms'));
        addRow(popup, 'Download', formatNumber(point.downloadMbps, 1, 'Mbps'));
        addRow(popup, 'Upload', formatNumber(point.uploadMbps, 1, 'Mbps'));
        addRow(popup, 'Calidad', point.qualityCategory
          ? point.qualityCategory + ' (' + point.qualityScore + '/100)' : 'No disponible');
        var button = document.createElement('button');
        button.className = 'detail-button';
        button.type = 'button';
        button.textContent = 'Ver detalle';
        button.addEventListener('click', function () {
          send({type: 'openDetail', id: point.id});
        });
        popup.appendChild(button);
        return popup;
      }
      function renderLayers() {
        markers.clearLayers();
        if (heat) {
          map.removeLayer(heat);
          heat = null;
        }
        if (mode === 'points') {
          points.forEach(function (point) {
            L.circleMarker([point.latitude, point.longitude], {
              radius: 8, weight: 2, color: '#fff',
              fillColor: point.color, fillOpacity: 0.95
            }).bindPopup(popupFor(point)).addTo(markers);
          });
        } else if (typeof L.heatLayer === 'function') {
          var heatPoints = points.filter(function (point) {
            return typeof point.heatWeight === 'number' && isFinite(point.heatWeight);
          }).map(function (point) {
            return [point.latitude, point.longitude, point.heatWeight];
          });
          heat = L.heatLayer(heatPoints, {
            radius: 35, blur: 22, max: 1, minOpacity: 0.25,
            gradient: {0.2: '#16a34a', 0.4: '#84cc16', 0.6: '#eab308',
              0.8: '#f97316', 1: '#dc2626'}
          }).addTo(map);
        } else {
          send({type: 'error', message: 'No se pudo descargar leaflet.heat.'});
        }
      }
      window.setMapData = function (nextPoints) {
        points = Array.isArray(nextPoints) ? nextPoints.filter(function (point) {
          return typeof point.latitude === 'number' && isFinite(point.latitude) &&
            typeof point.longitude === 'number' && isFinite(point.longitude) &&
            Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
        }) : [];
        if (points.length === 1) {
          map.setView([points[0].latitude, points[0].longitude], 13);
        } else if (points.length > 1) {
          map.fitBounds(points.map(function (point) {
            return [point.latitude, point.longitude];
          }), {padding: [24, 24], maxZoom: 13});
        } else {
          map.setView([-38.4, -63.6], 4);
        }
        renderLayers();
      };
      window.setMapMode = function (nextMode) {
        if (nextMode === 'points' || nextMode === 'heatmap') {
          mode = nextMode;
          renderLayers();
        }
      };
      send({type: 'ready'});
    })();
  </script>
</body>
</html>`;

export const LEAFLET_SOURCE = {html: LEAFLET_HTML, baseUrl: 'https://localhost/'};
