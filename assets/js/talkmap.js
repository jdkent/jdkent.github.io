// Talk map: clusters the points in org-locations.js (written by talkmap.ipynb)
// over a basemap that follows the site theme.
(() => {
  const root = document.documentElement;
  const isDark = () => root.getAttribute("data-theme") === "dark";
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  // Esri's gray canvas basemaps: one tile set for the land, one for the labels.
  const tileUrl = (layer) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${isDark() ? "Dark" : "Light"}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;

  const el = document.getElementById("talkmap");
  // Lowest zoom at which the world is at least as tall as the map, so no
  // blank band shows above or below it.
  const minZoom = Math.max(1, Math.ceil(Math.log2(el.clientHeight / 256)));
  const map = L.map(el, {
    center: [30, 10],
    zoom: minZoom,
    minZoom,
    worldCopyJump: true,
    maxBounds: [[-85, -Infinity], [85, Infinity]],
    maxBoundsViscosity: 1,
  });
  const tiles = ["Base", "Reference"].map((layer) =>
    L.tileLayer(tileUrl(layer), {
      maxZoom: 16,
      attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    }).addTo(map)
  );

  const markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    iconCreateFunction: (cluster) =>
      L.divIcon({
        html: `<span>${cluster.getChildCount()}</span>`,
        className: "talkmap__cluster",
        iconSize: [34, 34],
      }),
  });
  const points = addressPoints.map(([title, lat, lng]) =>
    L.circleMarker([lat, lng], { radius: 7, weight: 2 }).bindPopup(title)
  );
  markers.addLayers(points).addTo(map);
  if (points.length) map.fitBounds(markers.getBounds(), { padding: [40, 40], maxZoom: 4 });

  const paint = () => {
    tiles.forEach((t, i) => t.setUrl(tileUrl(["Base", "Reference"][i])));
    const style = { color: token("--ground"), fillColor: token("--link"), fillOpacity: 0.9 };
    points.forEach((p) => p.setStyle(style));
  };
  paint();
  new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
})();
