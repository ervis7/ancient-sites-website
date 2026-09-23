"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type MapNomos = {
  id: string;
  regionId?: string;
  name: string;
  image: string;
  placeCount: number;
};

export type MapRegion = {
  id: string;
  name: string;
  image: string;
};

export type MapRegionRanking = {
  region_id: string;
  place_id: string;
  place_name: string;
  place_image_url: string;
  visit_count: number;
  visitors: {
    userId: string;
    name: string;
    avatarUrl: string | null;
  }[];
};

const coordinates: Record<string, [number, number]> = {
  aitoloakarnania: [21.2, 38.7],
  argolida: [22.7, 37.6],
  arkadia: [22.4, 37.5],
  arta: [20.99, 39.16],
  "attiki-athina": [23.73, 37.98],
  "attiki-anatoliki": [23.96, 38.05],
  "attiki-dytiki": [23.42, 38.08],
  "attiki-peiraias": [23.62, 37.91],
  achaia: [21.73, 38.25],
  voiotia: [23.32, 38.44],
  grevena: [21.43, 40.08],
  drama: [24.15, 41.15],
  dodekanisa: [28.0, 36.55],
  evros: [26.13, 40.85],
  evrytania: [21.79, 38.91],
  evvoia: [23.65, 38.55],
  zakynthos: [20.9, 37.78],
  ileia: [21.44, 37.67],
  imathia: [22.2, 40.52],
  irakleio: [25.13, 35.34],
  thesprotia: [20.27, 39.5],
  thessaloniki: [22.94, 40.64],
  ioannina: [20.85, 39.67],
  kavala: [24.41, 40.94],
  karditsa: [21.92, 39.36],
  kastoria: [21.27, 40.52],
  kerkira: [19.92, 39.62],
  kefalonia: [20.5, 38.18],
  kilkis: [22.87, 40.99],
  kozani: [21.79, 40.3],
  korinthia: [22.93, 37.94],
  kyklades: [25.4, 37.2],
  lakonia: [22.43, 36.75],
  larisa: [22.42, 39.64],
  lasithi: [25.7, 35.19],
  lefkas: [20.71, 38.83],
  lesvos: [26.55, 39.1],
  magnisia: [22.95, 39.36],
  messinia: [22.1, 37.04],
  xanthi: [24.89, 41.14],
  pella: [22.05, 40.76],
  pieria: [22.5, 40.27],
  preveza: [20.75, 38.96],
  rethymno: [24.47, 35.36],
  rodopi: [25.4, 41.12],
  samos: [26.98, 37.75],
  serres: [23.55, 41.09],
  trikala: [21.77, 39.56],
  fthiotida: [22.43, 38.9],
  florina: [21.41, 40.78],
  fokida: [22.38, 38.48],
  chalkidiki: [23.5, 40.3],
  chania: [24.0, 35.51],
  chios: [26.14, 38.37],
};

// Manual visual nudges for clean land-safe marker placement. Remove this object
// to restore the raw longitude/latitude marker positions.
const markerOffsets: Record<string, [number, number]> = {
  achaia: [0.8, 1.8],
  aitoloakarnania: [1.2, 2.6],
  argolida: [-1.2, 2.3],
  arta: [-0.2, 0.6],
  arkadia: [-1.6, 2.5],
  "attiki-athina": [-0.5, 0.2],
  "attiki-anatoliki": [-1.6, 3.0],
  "attiki-dytiki": [-1.4, 1.2],
  "attiki-peiraias": [-1.5, 0.5],
  chalkidiki: [-1.0, 1.3],
  chania: [-1.4, 1.2],
  chios: [-5.2, 0.4],
  dodekanisa: [-5.7, 4.7],
  drama: [-0.9, 2.7],
  evros: [-1.0, 0.6],
  evrytania: [-1.0, 3.0],
  evvoia: [-1.6, 2.1],
  florina: [0.5, 2.8],
  fthiotida: [0.5, 1.2],
  grevena: [-0.7, 4.0],
  irakleio: [-1.7, 0.8],
  kastoria: [-0.7, 3.3],
  kefalonia: [1.6, 1.7],
  kavala: [-0.3, 2.9],
  kerkira: [1.2, 1.2],
  korinthia: [-1.4, 1.5],
  kyklades: [-3.4, 1.0],
  lakonia: [0.8, -1.0],
  lasithi: [2.1, -1.2],
  lefkas: [0.5, 3.4],
  lesvos: [-5.1, 0.2],
  messinia: [0.5, 0.0],
  magnisia: [-1.3, 1.9],
  preveza: [1.0, -0.6],
  rethymno: [-0.6, 0.9],
  rodopi: [-0.6, 2.5],
  samos: [-5.2, 1.1],
  serres: [-1.5, 0.0],
  thessaloniki: [-0.7, 1.7],
  thesprotia: [1.8, 2.5],
  pieria: [-0.9, 3.0],
  voiotia: [-1.2, 1.3],
  xanthi: [-0.3, 3.4],
  zakynthos: [-0.4, 1.9],
};

const regionNames: Record<string, string> = {
  GRC: "Δυτική Μακεδονία",
  GRD: "Ήπειρος",
  GRB: "Κεντρική Μακεδονία",
  GRA: "Ανατολική Μακεδονία και Θράκη",
  GR69: "Άγιο Όρος",
  GRE: "Θεσσαλία",
  GRH: "Στερεά Ελλάδα",
  GRA1: "Αττική",
  GRJ: "Πελοπόννησος",
  GRG: "Δυτική Ελλάδα",
  GRM: "Κρήτη",
  GRL: "Νότιο Αιγαίο",
  GRK: "Βόρειο Αιγαίο",
  GRF: "Ιόνια Νησιά",
};

const regionIds: Record<string, string> = {
  GRC: "dytiki-makedonia",
  GRD: "ipeiros",
  GRB: "kentriki-makedonia",
  GRA: "anatoliki-makedonia-thraki",
  GR69: "agion-oros",
  GRE: "thessalia",
  GRH: "sterea-ellada",
  GRA1: "attiki",
  GRJ: "peloponnisos",
  GRG: "dytiki-ellada",
  GRM: "kriti",
  GRL: "notio-aigaio",
  GRK: "voreio-aigaio",
  GRF: "ionia-nisia",
};

const regionMarkerPositions: Record<string, [number, number]> = {
  GRA: [58.3, 12.8],
  GRB: [39.8, 16.0],
  GRC: [25.1, 23.8],
  GRD: [18.7, 35.5],
  GRE: [33.8, 35.2],
  GRH: [36.0, 47.0],
  GRA1: [48.2, 53.0],
  GRJ: [33.1, 63.7],
  GRG: [24.2, 47.0],
  GRM: [60.0, 91.5],
  GRL: [60.8, 66.0],
  GRK: [71.5, 48.3],
  GRF: [16.0, 52.5],
};

function mapPosition(nomosId: string, [longitude, latitude]: [number, number]) {
  const [offsetX, offsetY] = markerOffsets[nomosId] ?? [0, 0];
  return {
    left: `${((longitude - 19.3) / 9.05) * 100 + offsetX}%`,
    top: `${((41.8 - latitude) / 7.15) * 100 + offsetY}%`,
  };
}

function previewPosition(nomosId: string, [longitude, latitude]: [number, number]) {
  const [offsetX, offsetY] = markerOffsets[nomosId] ?? [0, 0];
  const horizontal = ((longitude - 19.3) / 9.05) * 100 + offsetX;
  return {
    left: `${Math.max(14, Math.min(86, horizontal))}%`,
    top: `${((41.8 - latitude) / 7.15) * 100 + offsetY}%`,
  };
}

function normalizeSvgMarkup(markup: string) {
  return markup
    .replace(/<\?xml[^>]*\?>/i, "")
    .replace(/<\/?svg:/g, (match) => match.replace("svg:", ""));
}

export default function GreeceNomosMap({
  nomoi,
  regions,
  rankings = [],
  onSelect,
  onRegionSelect,
}: {
  nomoi: MapNomos[];
  regions: MapRegion[];
  rankings?: MapRegionRanking[];
  onSelect: (nomosId: string) => void;
  onRegionSelect?: (regionId: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [focusedRegionId, setFocusedRegionId] = useState<string | null>(null);
  const [mapTransform, setMapTransform] = useState(
    "translate3d(0px, 0px, 0) scale(1)",
  );
  const [zoomScale, setZoomScale] = useState(1);
  const [svgMarkup, setSvgMarkup] = useState("");
  const svgContainer = useRef<HTMLDivElement>(null);
  const hoverClearTimer = useRef<number | null>(null);
  const hoveredNomos = nomoi.find((nomos) => nomos.id === hoveredId);
  const displayedSvgRegionId = hoveredRegionId ?? focusedRegionId;
  const hoveredRegion = regions.find(
    (region) => region.id === regionIds[displayedSvgRegionId ?? ""],
  );
  const hoveredRegionSlug = regionIds[hoveredRegionId ?? ""];
  const hoveredRankings = rankings.filter(
    (ranking) => ranking.region_id === hoveredRegionSlug,
  );

  function prepareRegionMap(container: ParentNode) {
    container.querySelectorAll<SVGPathElement>("#features > path").forEach((path) => {
      if (path.dataset.interactiveRegion === "true") return;
      path.dataset.interactiveRegion = "true";
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
    });
  }

  function regionFromTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    return target.closest<SVGPathElement>("#features > path");
  }

  function showRegion(target: EventTarget | null) {
    const path = regionFromTarget(target);
    if (!path) return;
    if (hoverClearTimer.current) {
      window.clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    setHoveredRegionId(path.id);
  }

  function clearHoveredRegion(delay = 90) {
    if (hoverClearTimer.current) {
      window.clearTimeout(hoverClearTimer.current);
    }
    hoverClearTimer.current = window.setTimeout(() => {
      setHoveredRegionId(null);
      hoverClearTimer.current = null;
    }, delay);
  }

  function selectRegion(target: EventTarget | null) {
    const path = regionFromTarget(target);
    if (!path) return;
    const regionId = regionIds[path.id];
    if (!regionId || !regions.some((region) => region.id === regionId)) return;
    if (focusedRegionId === path.id) {
      onRegionSelect?.(regionId);
      return;
    }

    const canvas = svgContainer.current?.closest<HTMLElement>(".greeceMapCanvas");
    if (!canvas) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const pathBounds = path.getBoundingClientRect();
    const paddedWidth = Math.max(pathBounds.width * 1.45, 1);
    const paddedHeight = Math.max(pathBounds.height * 1.45, 1);
    const scale = Math.max(
      1,
      Math.min(4.5, canvasBounds.width / paddedWidth, canvasBounds.height / paddedHeight),
    );
    const centerX = pathBounds.left - canvasBounds.left + pathBounds.width / 2;
    const centerY = pathBounds.top - canvasBounds.top + pathBounds.height / 2;
    const translateX = canvasBounds.width / 2 - centerX * scale;
    const translateY = canvasBounds.height / 2 - centerY * scale;

    setFocusedRegionId(path.id);
    setZoomScale(scale);
    setHoveredRegionId(path.id);
    setMapTransform(
      `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
    );
  }

  function resetFocus() {
    setFocusedRegionId(null);
    if (hoverClearTimer.current) {
      window.clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    setHoveredRegionId(null);
    setHoveredId(null);
    setMapTransform("translate3d(0px, 0px, 0) scale(1)");
    setZoomScale(1);
  }

  useEffect(() => {
    let active = true;
    fetch("/gr.svg?v=3")
      .then((response) => response.text())
      .then((markup) => {
        if (!active) return;
        setSvgMarkup(normalizeSvgMarkup(markup));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (svgMarkup && svgContainer.current) {
      prepareRegionMap(svgContainer.current);
    }
  }, [svgMarkup]);

  useEffect(() => {
    const container = svgContainer.current;
    if (!container) return;
    container
      .querySelectorAll<SVGPathElement>("#features > path")
      .forEach((path) => {
        path.classList.toggle(
          "greeceRegionFocusedPath",
          path.id === focusedRegionId,
        );
      });
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focusedRegionId) resetFocus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedRegionId]);

  useEffect(() => {
    return () => {
      if (hoverClearTimer.current) {
        window.clearTimeout(hoverClearTimer.current);
      }
    };
  }, []);

  return (
    <section className="greeceMapSection" aria-label="Interactive map of Greece">
      <div
        className={`greeceRegionInfo${displayedSvgRegionId ? " greeceRegionInfoVisible" : ""}`}
        aria-live="polite"
      >
        <span
          className={`greeceRegionInfoImage${
            hoveredRegion?.image ? "" : " greeceRegionInfoPlaceholder"
          }`}
          style={
            hoveredRegion?.image
              ? { backgroundImage: `url("${hoveredRegion.image}")` }
              : undefined
          }
        >
          {!hoveredRegion?.image && "🗺️"}
        </span>
        <span className="greeceRegionInfoText">
          <small>Administrative region</small>
          <strong>
            {hoveredRegion?.name ??
              regionNames[displayedSvgRegionId ?? ""] ??
              "Hover over the map"}
          </strong>
        </span>
      </div>

      {hoveredRegionId && hoveredRankings.length > 0 && (
        <aside className="regionVisitRanking" aria-live="polite">
          <div className="regionVisitRankingHeading">
            <small>Most visited</small>
            <strong>{hoveredRegion?.name ?? regionNames[hoveredRegionId]}</strong>
          </div>
          <div className="regionVisitRankingList">
            {hoveredRankings.map((place, index) => (
              <article className="regionVisitRankingCard" key={place.place_id}>
                {place.place_image_url ? (
                  <span
                    className="regionVisitRankingImage"
                    role="img"
                    aria-label={place.place_name}
                    style={{
                      backgroundImage: `url("${place.place_image_url}")`,
                    }}
                  />
                ) : (
                  <span className="regionVisitRankingImage regionVisitRankingImageFallback">
                    {index + 1}
                  </span>
                )}
                <span className="regionVisitRankingDetails">
                  <strong>{place.place_name}</strong>
                  <small>
                    {place.visit_count} {place.visit_count === 1 ? "visit" : "visits"}
                  </small>
                  {place.visitors.length > 0 && (
                    <span className="regionVisitVisitors">
                      {place.visitors.map((visitor) => (
                        <span className="regionVisitVisitor" key={visitor.userId}>
                          {visitor.avatarUrl ? (
                            <span
                              className="regionVisitVisitorAvatar"
                              role="img"
                              aria-label={`${visitor.name} profile picture`}
                              style={{
                                backgroundImage: `url("${visitor.avatarUrl}")`,
                              }}
                            />
                          ) : (
                            <span className="regionVisitVisitorAvatar regionVisitVisitorFallback">
                              {visitor.name.slice(0, 1)}
                            </span>
                          )}
                          <span>{visitor.name}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </article>
            ))}
          </div>
        </aside>
      )}

      <div
        className={`greeceMapCanvas${focusedRegionId ? " greeceMapCanvasFocused" : ""}`}
        onPointerLeave={() => {
          setHoveredId(null);
          clearHoveredRegion(0);
        }}
        onPointerCancel={() => {
          setHoveredId(null);
          clearHoveredRegion(0);
        }}
        onClick={(event) => {
          if (
            focusedRegionId &&
            !regionFromTarget(event.target) &&
            !(event.target instanceof Element && event.target.closest(".nomosMapMarker"))
          ) {
            resetFocus();
          }
        }}
      >
        <div
          className="greeceMapViewport"
          style={{ transform: mapTransform }}
        >
        <div
          ref={svgContainer}
          className="greeceMapImage greeceMapInline"
          role="img"
          aria-label="Administrative regions of Greece"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
          onPointerOver={(event) => showRegion(event.target)}
          onPointerOut={(event) => {
            const leaving = regionFromTarget(event.target);
            const entering = regionFromTarget(event.relatedTarget);
            if (leaving && leaving !== entering) clearHoveredRegion();
          }}
          onFocusCapture={(event) => showRegion(event.target)}
          onBlurCapture={() => clearHoveredRegion(0)}
          onClick={(event) => selectRegion(event.target)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (!regionFromTarget(event.target)) return;
            event.preventDefault();
            selectRegion(event.target);
          }}
        />

        {Object.entries(regionMarkerPositions).map(([regionSvgId, [left, top]]) => {
          const regionSlug = regionIds[regionSvgId];
          if (!regionSlug || !regions.some((region) => region.id === regionSlug)) {
            return null;
          }
          const hiddenByFocus = Boolean(focusedRegionId);
          return (
            <span
              key={regionSvgId}
              className={`regionOverviewMarker${hoveredRegionId === regionSvgId ? " regionOverviewMarkerActive" : ""}${hiddenByFocus ? " regionOverviewMarkerHidden" : ""}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
              aria-hidden="true"
            />
          );
        })}

        {nomoi.map((nomos) => {
          const coordinate = coordinates[nomos.id];
          if (!coordinate) return null;
          const focusedRegionSlug = regionIds[focusedRegionId ?? ""];
          const hiddenByFocus =
            !focusedRegionSlug || nomos.regionId !== focusedRegionSlug;
          return (
            <button
              key={nomos.id}
              type="button"
              className={`nomosMapMarker${hoveredId === nomos.id ? " nomosMapMarkerActive" : ""}${hiddenByFocus ? " nomosMapMarkerHidden" : ""}`}
              style={{
                ...mapPosition(nomos.id, coordinate),
                "--marker-scale": 1 / zoomScale,
                "--marker-hover-scale": 1.4 / zoomScale,
              } as CSSProperties}
              aria-label={`Open ${nomos.name}`}
              onMouseEnter={() => setHoveredId(nomos.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(nomos.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => onSelect(nomos.id)}
            />
          );
        })}

        {hoveredNomos && coordinates[hoveredNomos.id] && (
          <div
            className="nomosMapPreview"
            style={{
              ...previewPosition(hoveredNomos.id, coordinates[hoveredNomos.id]),
              "--preview-zoom-scale": 1 / zoomScale,
            } as CSSProperties}
            aria-hidden="true"
          >
            <span
              className={`nomosMapPreviewImage${hoveredNomos.image ? "" : " nomosMapPreviewPlaceholder"}`}
              style={
                hoveredNomos.image
                  ? { backgroundImage: `url("${hoveredNomos.image}")` }
                  : undefined
              }
            >
              {!hoveredNomos.image && "📁"}
            </span>
            <span className="nomosMapPreviewDetails">
              <strong>{hoveredNomos.name}</strong>
              <small>
                {hoveredNomos.placeCount}{" "}
                {hoveredNomos.placeCount === 1 ? "place" : "places"}
              </small>
            </span>
          </div>
        )}
        </div>
      </div>

    </section>
  );
}
