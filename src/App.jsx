import { useState, useRef } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const WORK_RADIUS_METERS = 200;

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function App() {
  const [homeAddress, setHomeAddress] = useState(localStorage.getItem("homeAddress") || "");
  const [workAddress, setWorkAddress] = useState(localStorage.getItem("workAddress") || "");
  const [saved, setSaved] = useState(false);
  const [trafficStatus, setTrafficStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [workCoords, setWorkCoords] = useState(JSON.parse(localStorage.getItem("workCoords") || "null"));
  const [notifEnabled, setNotifEnabled] = useState(Notification.permission === "granted");
  const wasAtWork = useRef(false);

  const sendNotification = async (message) => {
    if (Notification.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("🏃 HomeRun", { body: message, icon: "/vite.svg" });
      } catch (e) {
        console.log("Notification error:", e);
      }
    }
  };

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotifEnabled(true);
      sendNotification("✅ Notifications enabled! You'll be alerted when there's traffic.");
    }
  };

  const saveAddresses = async () => {
    localStorage.setItem("homeAddress", homeAddress);
    localStorage.setItem("workAddress", workAddress);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(workAddress)}&key=${API_KEY}`
      );
      const data = await res.json();
      const coords = data.results?.[0]?.geometry?.location;
      if (coords) {
        localStorage.setItem("workCoords", JSON.stringify(coords));
        setWorkCoords(coords);
      }
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const checkTraffic = async () => {
    setLoading(true);
    setTrafficStatus(null);
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { address: workAddress },
          destination: { address: homeAddress },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      const data = await response.json();
      const route = data.routes?.[0];
      if (route) {
        const duration = parseInt(route.duration);
        const staticDuration = parseInt(route.staticDuration);
        const delayMinutes = Math.round((duration - staticDuration) / 60);
        setTrafficStatus({ duration, staticDuration, delayMinutes });
        if (delayMinutes > 5) {
          sendNotification(`⚠️ Traffic alert! ${delayMinutes} min delay on your way home.`);
        } else {
          sendNotification(`✅ Road is clear! ${Math.round(duration / 60)} min drive home.`);
        }
      } else {
        setTrafficStatus({ error: "Could not get route info." });
      }
    } catch (e) {
      setTrafficStatus({ error: e.message });
    }
    setLoading(false);
  };

  const startWatching = () => {
    if (!workCoords) { alert("Please save your addresses first!"); return; }
    if (!navigator.geolocation) { alert("GPS not supported."); return; }
    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceMeters(latitude, longitude, workCoords.lat, workCoords.lng);
        if (dist < WORK_RADIUS_METERS) {
          wasAtWork.current = true;
          setGpsStatus("at_work");
        } else if (wasAtWork.current) {
          wasAtWork.current = false;
          setGpsStatus("left_work");
          checkTraffic();
        }
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true }
    );
  };

  const s = {
    page: { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Segoe UI', sans-serif", padding: "24px 16px" },
    container: { maxWidth: 480, margin: "0 auto" },
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
    headerIcon: { fontSize: 38, lineHeight: 1 },
    headerText: {},
    h1: { margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" },
    subtitle: { margin: 0, fontSize: 13, color: "#64748b" },
    statusRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
    statusCard: { background: "#1e2130", borderRadius: 12, padding: 16, border: "1px solid #2d3148" },
    statusLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
    statusValue: (color) => ({ fontSize: 14, fontWeight: 600, color }),
    card: { background: "#1e2130", borderRadius: 16, padding: 20, border: "1px solid #2d3148", marginBottom: 16 },
    cardTitle: { fontSize: 13, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
    inputGroup: { marginBottom: 12 },
    inputLabel: { display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 },
    input: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #2d3148", background: "#0f1117", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" },
    btnSave: (saved) => ({ width: "100%", padding: 11, background: saved ? "#059669" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }),
    actionsRow: { display: "flex", gap: 10 },
    actionBtn: (bg) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", border: "none", borderRadius: 12, cursor: "pointer", color: "white", fontSize: 11, fontWeight: 600, background: bg }),
    actionIcon: { fontSize: 22 },
    trafficCard: (hasTraffic) => ({ marginTop: 0, padding: 16, borderRadius: 16, background: hasTraffic ? "#2d1f0a" : "#0a2d1f", border: `1px solid ${hasTraffic ? "#92400e" : "#065f46"}`, marginBottom: 16 }),
    trafficTitle: (hasTraffic) => ({ margin: "0 0 12px", fontSize: 18, color: hasTraffic ? "#f59e0b" : "#34d399" }),
    trafficGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    trafficStat: { background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 12 },
    trafficStatLabel: { fontSize: 11, color: "#64748b", marginBottom: 4 },
    trafficStatValue: { fontSize: 22, fontWeight: 700 },
    trafficDelay: { marginTop: 12, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 10, fontSize: 14, color: "#f59e0b" },
    errorCard: { padding: 16, borderRadius: 16, background: "#2d0f0f", border: "1px solid #7f1d1d" },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>🏃</div>
          <div style={s.headerText}>
            <h1 style={s.h1}>HomeRun</h1>
            <p style={s.subtitle}>Smart commute traffic alerts</p>
          </div>
        </div>

        {/* Status Cards */}
        <div style={s.statusRow}>
          <div style={s.statusCard}>
            <div style={s.statusLabel}>GPS Status</div>
            <div style={s.statusValue(gpsStatus === "at_work" ? "#34d399" : gpsStatus === "left_work" ? "#f59e0b" : "#64748b")}>
              {gpsStatus === "at_work" ? "🟢 At Work" : gpsStatus === "left_work" ? "🟡 Left Work" : "⚪ Idle"}
            </div>
          </div>
          <div style={s.statusCard}>
            <div style={s.statusLabel}>Notifications</div>
            <div style={s.statusValue(notifEnabled ? "#34d399" : "#64748b")}>
              {notifEnabled ? "🔔 Enabled" : "🔕 Disabled"}
            </div>
          </div>
        </div>

        {/* Addresses Card */}
        <div style={s.card}>
          <div style={s.cardTitle}>📍 Addresses</div>
          <div style={s.inputGroup}>
            <label style={s.inputLabel}>Home Address</label>
            <input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} placeholder="e.g. Hanaton, Israel" style={s.input} />
          </div>
          <div style={s.inputGroup}>
            <label style={s.inputLabel}>Work Address</label>
            <input value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} placeholder="e.g. Migdal Tefen, Israel" style={s.input} />
          </div>
          <button onClick={saveAddresses} style={s.btnSave(saved)}>
            {saved ? "✅ Saved!" : "Save Addresses"}
          </button>
        </div>

        {/* Actions Card */}
        <div style={s.card}>
          <div style={s.cardTitle}>⚡ Actions</div>
          <div style={s.actionsRow}>
            <button onClick={checkTraffic} disabled={!homeAddress || !workAddress || loading} style={s.actionBtn("linear-gradient(135deg, #0ea5e9, #2563eb)")}>
              <span style={s.actionIcon}>🚦</span>
              <span>{loading ? "..." : "Check Traffic"}</span>
            </button>
            <button onClick={requestNotificationPermission} style={s.actionBtn("linear-gradient(135deg, #0d9488, #0891b2)")}>
              <span style={s.actionIcon}>🔔</span>
              <span>Notifications</span>
            </button>
            <button onClick={startWatching} style={s.actionBtn("linear-gradient(135deg, #475569, #334155)")}>
              <span style={s.actionIcon}>📍</span>
              <span>Monitor</span>
            </button>
          </div>
        </div>

        {/* Traffic Result */}
        {trafficStatus && !trafficStatus.error && (
          <div style={s.trafficCard(trafficStatus.delayMinutes > 5)}>
            <h3 style={s.trafficTitle(trafficStatus.delayMinutes > 5)}>
              {trafficStatus.delayMinutes > 5 ? "⚠️ Traffic Detected" : "✅ Road is Clear"}
            </h3>
            <div style={s.trafficGrid}>
              <div style={s.trafficStat}>
                <div style={s.trafficStatLabel}>CURRENT TIME</div>
                <div style={s.trafficStatValue}>{Math.round(trafficStatus.duration / 60)}<span style={{ fontSize: 13, color: "#64748b" }}> min</span></div>
              </div>
              <div style={s.trafficStat}>
                <div style={s.trafficStatLabel}>WITHOUT TRAFFIC</div>
                <div style={s.trafficStatValue}>{Math.round(trafficStatus.staticDuration / 60)}<span style={{ fontSize: 13, color: "#64748b" }}> min</span></div>
              </div>
            </div>
            {trafficStatus.delayMinutes > 0 && (
              <div style={s.trafficDelay}>⏱ Delay: <strong>{trafficStatus.delayMinutes} min</strong></div>
            )}
          </div>
        )}

        {trafficStatus?.error && (
          <div style={s.errorCard}>
            <p style={{ margin: 0, color: "#f87171" }}>❌ {trafficStatus.error}</p>
          </div>
        )}

      </div>
    </div>
  );
}