import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiGlobe,
  FiClock,
  FiLoader,
  FiAlertCircle,
  FiSearch,
  FiList,
  FiMap,
  FiChevronLeft,
  FiExternalLink,
  FiX,
} from "react-icons/fi";
import ThemeToggle from "../components/ui/ThemeToggle";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Hospital {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distance: number; // km
  address?: string;
  phone?: string;
  website?: string;
  emergency?: string;
  openingHours?: string;
  type: string; // hospital | clinic | doctors
}

interface UserLocation {
  lat: number;
  lon: number;
}

/* ═══════════════════════════════════════════════════════════════
   Haversine distance (km)
   ═══════════════════════════════════════════════════════════════ */

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ═══════════════════════════════════════════════════════════════
   Overpass API query builder — fetches hospitals/clinics nearby
   ═══════════════════════════════════════════════════════════════ */

async function fetchNearbyHospitals(
  lat: number,
  lon: number,
  radiusKm: number = 10
): Promise<Hospital[]> {
  const radiusM = radiusKm * 1000;

  // Query hospitals, clinics, and doctors within radius
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusM},${lat},${lon});
      way["amenity"="hospital"](around:${radiusM},${lat},${lon});
      node["amenity"="clinic"](around:${radiusM},${lat},${lon});
      way["amenity"="clinic"](around:${radiusM},${lat},${lon});
      node["amenity"="doctors"](around:${radiusM},${lat},${lon});
    );
    out center body;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) throw new Error("Failed to fetch hospital data");

  const data = await response.json();

  return data.elements
    .map((el: any) => {
      const elLat = el.lat || el.center?.lat;
      const elLon = el.lon || el.center?.lon;
      if (!elLat || !elLon) return null;

      const tags = el.tags || {};
      return {
        id: el.id,
        name: tags.name || tags["name:en"] || "Unnamed Medical Facility",
        lat: elLat,
        lon: elLon,
        distance: haversine(lat, lon, elLat, elLon),
        address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
          .filter(Boolean)
          .join(", ") || undefined,
        phone: tags.phone || tags["contact:phone"] || undefined,
        website: tags.website || tags["contact:website"] || undefined,
        emergency: tags.emergency || undefined,
        openingHours: tags.opening_hours || undefined,
        type: tags.amenity || "hospital",
      } as Hospital;
    })
    .filter(Boolean)
    .sort((a: Hospital, b: Hospital) => a.distance - b.distance);
}

/* ═══════════════════════════════════════════════════════════════
   Leaflet Map Component (loaded dynamically to avoid SSR issues)
   ═══════════════════════════════════════════════════════════════ */

function HospitalMap({
  userLocation,
  hospitals,
  selectedId,
  onSelect,
}: {
  userLocation: UserLocation;
  hospitals: Hospital[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet
    const initMap = async () => {
      const L = (await import("leaflet")).default;

      // Fix default icon paths (common Leaflet + bundler issue)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        zoomControl: false,
      }).setView([userLocation.lat, userLocation.lon], 13);

      // Add zoom control to bottom-right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Dark-themed map tiles from CartoDB
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      // User location marker with pulsing effect
      const userIcon = L.divIcon({
        className: "user-location-marker",
        html: `
          <div style="position:relative;width:20px;height:20px;">
            <div style="position:absolute;inset:0;background:rgb(139,92,246);border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(139,92,246,0.6);"></div>
            <div style="position:absolute;inset:-8px;background:rgba(139,92,246,0.2);border-radius:50%;animation:pulse 2s infinite;"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup("<b>Your Location</b>");

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation]);

  // Update hospital markers whenever hospitals change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const updateMarkers = async () => {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      // Clear old markers
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      hospitals.forEach((h) => {
        const isSelected = h.id === selectedId;
        const color =
          h.type === "hospital"
            ? "rgb(239,68,68)"
            : h.type === "clinic"
            ? "rgb(16,185,129)"
            : "rgb(59,130,246)";

        const hospitalIcon = L.divIcon({
          className: "hospital-marker",
          html: `
            <div style="
              width:${isSelected ? "16" : "12"}px;
              height:${isSelected ? "16" : "12"}px;
              background:${color};
              border-radius:50%;
              border:2px solid white;
              box-shadow:0 0 ${isSelected ? "14" : "8"}px ${color}80;
              transition:all 0.3s ease;
            "></div>
          `,
          iconSize: [isSelected ? 16 : 12, isSelected ? 16 : 12],
          iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6],
        });

        const marker = L.marker([h.lat, h.lon], { icon: hospitalIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;">
              <b style="font-size:13px;">${h.name}</b><br/>
              <span style="font-size:11px;color:#666;">${h.distance.toFixed(1)} km away</span>
              ${h.address ? `<br/><span style="font-size:11px;color:#888;">${h.address}</span>` : ""}
            </div>`
          );

        marker.on("click", () => onSelect(h.id));
        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [hospitals, selectedId, onSelect]);

  // Pan to selected hospital
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedId) return;
    const h = hospitals.find((x) => x.id === selectedId);
    if (h) {
      mapInstanceRef.current.flyTo([h.lat, h.lon], 15, { duration: 0.8 });
    }
  }, [selectedId, hospitals]);

  return (
    <div ref={mapRef} className="w-full h-full rounded-2xl" style={{ minHeight: "100%" }} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Hospital Card
   ═══════════════════════════════════════════════════════════════ */

function HospitalCard({
  hospital,
  isSelected,
  onClick,
}: {
  hospital: Hospital;
  isSelected: boolean;
  onClick: () => void;
}) {
  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    hospital: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    clinic: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    doctors: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  };
  const style = typeColors[hospital.type] || typeColors.hospital;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
        isSelected
          ? "bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className={`font-bold text-sm leading-tight ${isSelected ? "text-white" : "text-slate-200"}`}>
          {hospital.name}
        </h3>
        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
          {hospital.type}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
        <FiNavigation className="w-3 h-3 text-purple-400 shrink-0" />
        <span>{hospital.distance.toFixed(1)} km away</span>
      </div>

      {hospital.address && (
        <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-1">
          <FiMapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="line-clamp-1">{hospital.address}</span>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {hospital.phone && (
          <a
            href={`tel:${hospital.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 transition-colors"
          >
            <FiPhone className="w-3 h-3" /> Call
          </a>
        )}
        {hospital.website && (
          <a
            href={hospital.website.startsWith("http") ? hospital.website : `https://${hospital.website}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:text-cyan-400 hover:border-cyan-500/20 transition-colors"
          >
            <FiGlobe className="w-3 h-3" /> Website
          </a>
        )}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[11px] text-slate-400 hover:text-purple-400 hover:border-purple-500/20 transition-colors"
        >
          <FiExternalLink className="w-3 h-3" /> Directions
        </a>
      </div>

      {hospital.emergency === "yes" && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400 font-semibold">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
          Emergency Services Available
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function NearbyHospitals() {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [view, setView] = useState<"split" | "list" | "map">("split");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        // Default to Mumbai if denied
        console.warn("Geolocation denied, defaulting to Mumbai:", err.message);
        setUserLocation({ lat: 19.076, lon: 72.8777 });
        setError("Location access denied — showing results near Mumbai. Allow location for accurate results.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Fetch hospitals when location or radius changes
  useEffect(() => {
    if (!userLocation) return;

    setLoading(true);
    setError("");

    fetchNearbyHospitals(userLocation.lat, userLocation.lon, radiusKm)
      .then((results) => {
        setHospitals(results);
        setFilteredHospitals(results);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch nearby hospitals. Please try again.");
        setLoading(false);
      });
  }, [userLocation, radiusKm]);

  // Filter hospitals by search and type
  useEffect(() => {
    let filtered = hospitals;

    if (typeFilter !== "all") {
      filtered = filtered.filter((h) => h.type === typeFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.name.toLowerCase().includes(term) ||
          h.address?.toLowerCase().includes(term)
      );
    }

    setFilteredHospitals(filtered);
  }, [searchTerm, typeFilter, hospitals]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const hospitalCount = filteredHospitals.length;
  const typeCounts = {
    all: hospitals.length,
    hospital: hospitals.filter((h) => h.type === "hospital").length,
    clinic: hospitals.filter((h) => h.type === "clinic").length,
    doctors: hospitals.filter((h) => h.type === "doctors").length,
  };

  return (
    <div className="min-h-screen bg-[#070514] text-white relative overflow-hidden flex flex-col">

      {/* ── Background ── */}
      <div className="fixed inset-0 bg-[url('https://api.typedream.com/v0/document/public/80f7bc74-6869-45d2-a7d5-dacedaab59f7_Noise_Background_png.png')] opacity-[0.08] pointer-events-none mix-blend-overlay z-0" />
      <div className="fixed top-[-15%] right-[-10%] w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-[180px] pointer-events-none" />
      <div className="fixed bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="Back to Dashboard"
            >
              <FiChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <FiMapPin className="text-red-400 w-4 h-4" />
                Nearby Hospitals
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {loading
                  ? "Searching..."
                  : `${hospitalCount} medical ${hospitalCount === 1 ? "facility" : "facilities"} within ${radiusKm} km`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Radius selector */}
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40 appearance-none cursor-pointer"
            >
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={20}>20 km</option>
              <option value={50}>50 km</option>
            </select>

            {/* View toggle */}
            <div className="hidden sm:flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              {(["split", "map", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === v ? "bg-purple-500/20 text-purple-300" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {v === "split" ? "Split" : v === "map" ? <FiMap className="w-3.5 h-3.5" /> : <FiList className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            <ThemeToggle />
          </div>
        </div>

        {/* Search + Filters row */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search hospitals..."
              className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: "all", label: "All", count: typeCounts.all },
                { key: "hospital", label: "Hospitals", count: typeCounts.hospital },
                { key: "clinic", label: "Clinics", count: typeCounts.clinic },
                { key: "doctors", label: "Doctors", count: typeCounts.doctors },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                  typeFilter === f.key
                    ? "bg-purple-500/15 text-purple-300 border-purple-500/25"
                    : "text-slate-500 border-white/5 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                {f.label} {f.count > 0 && <span className="text-slate-600 ml-0.5">({f.count})</span>}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Warning banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-6 py-2.5 flex items-center gap-2 text-xs text-amber-300 z-30"
          >
            <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-amber-400 hover:text-white transition-colors">
              <FiX className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex relative z-10 overflow-hidden">
        {loading ? (
          /* Loading state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            >
              <FiLoader className="w-8 h-8 text-purple-400" />
            </motion.div>
            <div className="text-center">
              <p className="text-slate-300 font-semibold">Discovering nearby hospitals...</p>
              <p className="text-slate-500 text-sm mt-1">Using OpenStreetMap data</p>
            </div>
          </div>
        ) : !userLocation ? (
          /* No location state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <FiMapPin className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-slate-300 font-semibold text-center">Unable to get your location</p>
            <p className="text-slate-500 text-sm text-center max-w-sm">
              Please allow location access in your browser to find hospitals near you.
            </p>
          </div>
        ) : (
          /* Map + List layout */
          <>
            {/* Hospital List Panel */}
            {(view === "split" || view === "list") && (
              <div
                className={`${
                  view === "split" ? "w-[420px]" : "w-full max-w-3xl mx-auto"
                } border-r border-white/5 overflow-y-auto h-[calc(100vh-120px)] p-3 space-y-2 flex-shrink-0`}
              >
                {filteredHospitals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <FiSearch className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-semibold text-sm">No facilities found</p>
                    <p className="text-slate-600 text-xs mt-1 max-w-[250px]">
                      Try increasing the search radius or changing filters.
                    </p>
                  </div>
                ) : (
                  filteredHospitals.map((h) => (
                    <HospitalCard
                      key={h.id}
                      hospital={h}
                      isSelected={selectedId === h.id}
                      onClick={() => handleSelect(h.id)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Map Panel */}
            {(view === "split" || view === "map") && (
              <div className="flex-1 relative min-h-[400px]">
                <HospitalMap
                  userLocation={userLocation}
                  hospitals={filteredHospitals}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                />

                {/* Map legend overlay */}
                <div className="absolute bottom-4 left-4 z-[1000] bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-white" />
                    Your Location
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                    Hospital
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    Clinic
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" />
                    Doctor&apos;s Office
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Leaflet CSS injection */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
        .leaflet-container { background: #0a0a1a !important; border-radius: 0; }
        .leaflet-control-zoom a { background: rgba(0,0,0,0.7) !important; color: #a78bfa !important; border-color: rgba(255,255,255,0.1) !important; }
        .leaflet-control-zoom a:hover { background: rgba(0,0,0,0.9) !important; }
        .leaflet-control-attribution { background: rgba(0,0,0,0.6) !important; color: #64748b !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #8b5cf6 !important; }
        .leaflet-popup-content-wrapper { background: rgba(15,10,40,0.95) !important; color: #e2e8f0 !important; border-radius: 12px !important; border: 1px solid rgba(255,255,255,0.1) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important; }
        .leaflet-popup-tip { background: rgba(15,10,40,0.95) !important; }
        .user-location-marker { background: none !important; border: none !important; }
        .hospital-marker { background: none !important; border: none !important; }
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}