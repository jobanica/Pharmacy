"use client";

import * as React from "react";
import { Loader2, LocateFixed, Search } from "lucide-react";

import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Loaded lazily inside the effect so Leaflet never runs during SSR.
type LeafletMap = import("leaflet").Map;
type LeafletMarker = import("leaflet").Marker;

const ICON = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41] as [number, number],
  iconAnchor: [12, 41] as [number, number],
};

export function DeliveryMap({
  value,
  onChange,
}: {
  value: { lat: number | null; lng: number | null };
  onChange: (next: { lat: number; lng: number; address?: string }) => void;
}) {
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const LRef = React.useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // Reverse-geocode a point to a human address (best effort).
  const reverse = React.useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      return typeof data?.display_name === "string" ? (data.display_name as string) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const place = React.useCallback(
    (lat: number, lng: number, withReverse = true) => {
      const L = LRef.current;
      const map = mapRef.current;
      if (!L || !map) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: L.icon(ICON) }).addTo(map);
      }
      map.panTo([lat, lng]);
      if (withReverse) {
        reverse(lat, lng).then((address) => onChangeRef.current({ lat, lng, address }));
      } else {
        onChangeRef.current({ lat, lng });
      }
    },
    [reverse],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      // Default center: Manila, Philippines.
      const start: [number, number] =
        value.lat != null && value.lng != null ? [value.lat, value.lng] : [14.5995, 120.9842];
      const map = L.map(containerRef.current).setView(start, value.lat != null ? 16 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        place(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      if (value.lat != null && value.lng != null) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: L.icon(ICON) }).addTo(map);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        mapRef.current?.setView([lat, lng], 16);
        place(lat, lng, false);
        onChangeRef.current({ lat, lng, address: data[0].display_name });
      }
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      mapRef.current?.setView([latitude, longitude], 16);
      place(latitude, longitude);
    });
  }

  return (
    <div className="grid gap-2">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your address…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Find"}
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation} title="Use my location">
          <LocateFixed className="size-4" />
        </Button>
      </form>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-lg border"
        style={{ background: "#e5e7eb" }}
      />
      <p className="text-xs text-muted-foreground">
        {ready ? "Tap the map to drop a pin on your delivery location." : "Loading map…"}
      </p>
    </div>
  );
}
