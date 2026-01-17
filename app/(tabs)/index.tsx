import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

const API_BASE = "https://lrs-backend-production.up.railway.app";

const THEME = {
  bg: "#0B0D0F",
  card: "#12161B",
  border: "#24303A",
  text: "#F4F2ED",
  muted: "#B9C0C7",
  inputBg: "#0F1318",
  accent: "#23C4D9",
  button: "#23C4D9",
  buttonText: "#0B0D0F",
  link: "#6EE7FF",
};

// ✅ Google/Yelp-ish “lift”: cross-platform shadow preset
const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6, // Android
};

// ✅ Softer shadow for images (still visible on dark UI)
const PHOTO_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 5 },
  elevation: 5, // Android
};

function Divider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: THEME.border,
        marginVertical: 16,
      }}
    />
  );
}

function Chip({ label, active, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? THEME.accent : THEME.border,
        backgroundColor: active ? THEME.accent : THEME.card,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? THEME.buttonText : THEME.text, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Location interpretation guardrail (safe heuristic):
 * If the user includes a country (e.g., "Philippines") but the returned pick locations
 * clearly show a different country (e.g., "USA"), show a gentle Heads up note.
 */
function locationGuardrailNote(userLocation: string, picks: any[]): string | null {
  const q = (userLocation || "").toLowerCase();

  const userCountries = [
    { key: "philippines", label: "Philippines" },
    { key: "usa", label: "USA" },
    { key: "united states", label: "USA" },
    { key: "canada", label: "Canada" },
    { key: "mexico", label: "Mexico" },
    { key: "uk", label: "UK" },
    { key: "united kingdom", label: "UK" },
    { key: "australia", label: "Australia" },
  ];

  const userCountry = userCountries.find((c) => q.includes(c.key))?.label || null;

  // Only run this guardrail if the user explicitly included a country word.
  if (!userCountry) return null;

  const joinedLocations = (picks || [])
    .map((p: any) => (p?.location || "").toLowerCase())
    .join(" | ");

  const resultCountries = [
    { key: ", usa", label: "USA" },
    { key: " united states", label: "USA" },
    { key: ", canada", label: "Canada" },
    { key: ", mexico", label: "Mexico" },
    { key: ", uk", label: "UK" },
    { key: " united kingdom", label: "UK" },
    { key: ", australia", label: "Australia" },
    { key: ", philippines", label: "Philippines" },
  ];

  const detectedResultCountry =
    resultCountries.find((c) => joinedLocations.includes(c.key))?.label || null;

  if (!detectedResultCountry) return null;

  if (detectedResultCountry !== userCountry) {
    return `I may be interpreting this location broadly. You typed “${userLocation}”, but I’m seeing results in ${detectedResultCountry}. If this isn’t the right place, try adding a nearby city or being more specific.`;
  }

  return null;
}

function maxMilesForMode(mode: "strict" | "best" | "hype"): number {
  // LOCKED CAPS (final safety net)
  if (mode === "strict") return 10;
  if (mode === "best") return 15;
  return 25; // hype
}

type Suggestion = { label: string; name: string; address: string };

export default function LRSHome() {
  // ✅ Starts empty (locked UX decision)
  const [location, setLocation] = useState("");
  // ✅ Starts empty (requested)
  const [cuisine, setCuisine] = useState("");
  const [mode, setMode] = useState<"strict" | "best" | "hype">("strict");

  const [results, setResults] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugLine, setDebugLine] = useState("");
  const [showWhy, setShowWhy] = useState(false);

  // ✅ New: lets us show a calm empty-state only after a search
  const [hasSearched, setHasSearched] = useState(false);

  // ✅ Tap photo → full-screen viewer (Google/Yelp-style)
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  function openPhoto(url: string) {
    setActivePhotoUrl(url);
    setPhotoModalOpen(true);
  }

  function closePhoto() {
    setPhotoModalOpen(false);
    setActivePhotoUrl(null);
  }

  // ✅ LOCKED 12 “Smart Presets” (stable, clean layout)
  const cuisinePresets = [
    "tacos",
    "pizza",
    "sushi",
    "ramen",
    "burgers",
    "bbq",
    "breakfast",
    "thai",
    "pho",
    "coffee",
    "diner",
    "birria",
  ];

  // ----------------------------
  // ✅ Location dropdown (suggest)
  // ----------------------------
  const [locFocused, setLocFocused] = useState(false);
  const [locSuggestions, setLocSuggestions] = useState<Suggestion[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const lastSuggestQueryRef = useRef<string>("");

  const shouldShowDropdown = useMemo(() => {
    const q = (location || "").trim();
    return locFocused && q.length >= 3 && locSuggestions.length > 0;
  }, [locFocused, location, locSuggestions]);

  useEffect(() => {
    let alive = true;

    async function run() {
      const q = (location || "").trim();

      // Only show when clearly helpful
      if (!locFocused || q.length < 3) {
        setLocSuggestions([]);
        setLocLoading(false);
        return;
      }

      // Debounce a bit
      setLocLoading(true);
      const myQuery = q.toLowerCase();
      lastSuggestQueryRef.current = myQuery;

      await new Promise((r) => setTimeout(r, 250));

      // If user typed more while waiting, cancel this run
      if (lastSuggestQueryRef.current !== myQuery) {
        if (alive) setLocLoading(false);
        return;
      }

      try {
        const url = `${API_BASE}/suggest?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();

        const raw: any[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
        const cleaned: Suggestion[] = raw
          .map((s: any) => ({
            label: String(s?.label || "").trim(),
            name: String(s?.name || "").trim(),
            address: String(s?.address || "").trim(),
          }))
          .filter((s) => !!s.label);

        if (!alive) return;

        function looksCityLike(label: string) {
          const t = label.toLowerCase();
          const hasStreetNumber = /^\d+\s/.test(t);
          const hasSuite = t.includes(" ste ") || t.includes(" suite ") || t.includes("#");
          const hasComma = t.includes(",");
          return hasComma && !hasStreetNumber && !hasSuite;
        }

        const cityLike = cleaned.filter((s) => looksCityLike(s.label));

        // Only return city-like by default (your rule).
        // If there are zero city-like, show nothing (better than random businesses).
        const finalList = cityLike.slice(0, 6);

        setLocSuggestions(finalList);
      } catch {
        if (!alive) return;
        setLocSuggestions([]);
      } finally {
        if (alive) setLocLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [location, locFocused]);

  function selectSuggestion(s: Suggestion) {
    // Must use exactly what the user selected (no surprises)
    setLocation(s.label);
    setLocSuggestions([]);
    setLocFocused(false);
  }

  function hideDropdown() {
    setLocSuggestions([]);
    setLocFocused(false);
  }

  function friendlyModeName(m: string) {
    if (m === "strict") return "Top Local Picks";
    if (m === "best") return "Best Available";
    return "Hype";
  }

  function whyText() {
    if (mode === "strict")
      return "These are the safest local picks — strong ratings, deep local reviews, no chains.";
    if (mode === "best") return "These are solid options for this area. Not perfect, but dependable.";
    return "These places have buzz — more popular, more talked about, still rated well.";
  }

  async function runLRS() {
    try {
      const loc = (location || "").trim();
      const food = (cuisine || "").trim();

      // ✅ Existing location guardrail (already working)
      if (!loc) {
        setHasSearched(true);
        setLoading(false);
        setResults([]);
        setDebugLine("");
        setShowWhy(false);

        // Hide dropdown (no surprises)
        setLocSuggestions([]);
        setLocFocused(false);

        setNote("Please type a city or area first (example: “Los Angeles, CA”).");
        return;
      }

      setHasSearched(true);
      setLoading(true);
      setNote("");
      setDebugLine("");
      setResults([]);
      setShowWhy(false);

      // Hide dropdown when searching (your rule)
      setLocSuggestions([]);
      setLocFocused(false);

      const params = new URLSearchParams();
      // Must use EXACTLY what is in the box
      params.append("location", loc);
      if (food) params.append("cuisine", food);
      params.append("mode", mode);

      const res = await fetch(`${API_BASE}/lrs?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        setNote(data.error);
        return;
      }

      const picksRaw = data.picks || [];

      // FRONTEND TRUST HARDENING (DISTANCE):
      // Refuse to display anything beyond the locked cap for the chosen mode.
      const cap = maxMilesForMode(mode);
      const picksWithinCap = picksRaw.filter((p: any) => {
        const d = p?.distance_miles;
        if (typeof d !== "number") return true; // if missing, don't drop silently
        return d <= cap;
      });

      const dropped = picksRaw.length - picksWithinCap.length;

      setResults(picksWithinCap);

      const backendNote = data.limitation_note ? String(data.limitation_note) : "";
      const guardrail = locationGuardrailNote(loc, picksWithinCap) || "";

      const distanceNote =
        dropped > 0
          ? `Heads up: I hid ${dropped} result${dropped === 1 ? "" : "s"} that were beyond ${cap} miles for ${friendlyModeName(
              mode
            )}.`
          : "";

      const combined = [backendNote, distanceNote, guardrail].filter(Boolean).join("\n\n");
      if (combined) setNote(combined);

      if (data.debug) {
        setDebugLine(
          `You’re in ${friendlyModeName(data.debug.mode)} mode. I’m showing ${picksWithinCap.length} picks.`
        );
      }
    } catch {
      setNote("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sharePick(name: string, googleMapsUrl: string) {
    try {
      const msg = googleMapsUrl ? `${name}\n${googleMapsUrl}` : name;
      await Share.share({ message: msg });
    } catch {
      // If share fails, we just do nothing (safe, no crash).
    }
  }

  const showEmptyState = hasSearched && !loading && results.length === 0 && !note;

  return (
    <ScrollView
      style={{ padding: 16, paddingTop: 32, backgroundColor: THEME.bg }}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={() => {
        if (locFocused || locSuggestions.length > 0) hideDropdown();
      }}
      onScroll={() => {
        if (locFocused || locSuggestions.length > 0) hideDropdown();
      }}
      scrollEventThrottle={16}
    >
      {/* ✅ Full-screen photo viewer (Google/Yelp-style tap) */}
      <Modal visible={photoModalOpen} transparent animationType="fade" onRequestClose={closePhoto}>
        <Pressable
          onPress={closePhoto}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {/* Stop tap-through when tapping the image itself */}
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            {activePhotoUrl ? (
              <Image
                source={{ uri: activePhotoUrl }}
                style={{
                  width: "100%",
                  height: 360,
                  borderRadius: 14,
                  backgroundColor: THEME.inputBg,
                }}
                resizeMode="contain"
              />
            ) : null}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: THEME.muted, fontSize: 12 }}>Tap outside to close</Text>
              <Pressable
                onPress={closePhoto}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: THEME.border,
                  backgroundColor: THEME.card,
                }}
              >
                <Text style={{ color: THEME.text, fontWeight: "900" }}>✕ Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Text style={{ fontSize: 30, fontWeight: "900", color: THEME.text }}>
        Local Restaurant Scout
      </Text>
      <Text style={{ color: THEME.muted }}>Locals-first picks. No hype unless you ask for it.</Text>

      <Divider />

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        <Chip label="Top Local Picks" active={mode === "strict"} onPress={() => setMode("strict")} />
        <Chip label="Best Available" active={mode === "best"} onPress={() => setMode("best")} />
        <Chip label="Hype" active={mode === "hype"} onPress={() => setMode("hype")} />
      </View>

      <Text style={{ color: THEME.text, fontWeight: "800" }}>Where are you?</Text>
      <TextInput
        value={location}
        onChangeText={setLocation}
        onFocus={() => setLocFocused(true)}
        onBlur={() => {
          setTimeout(() => setLocFocused(false), 120);
        }}
        placeholder="e.g. Los Angeles, CA"
        placeholderTextColor={THEME.muted}
        style={{
          borderWidth: 1,
          borderColor: THEME.border,
          backgroundColor: THEME.inputBg,
          color: THEME.text,
          padding: 12,
          borderRadius: 12,
          marginTop: 8,
          marginBottom: 6,
        }}
      />

      {locFocused && (location || "").trim().length >= 3 && locLoading && (
        <Text style={{ color: THEME.muted, marginBottom: 8 }}>Finding locations…</Text>
      )}

      {shouldShowDropdown && (
        <View
          style={{
            backgroundColor: THEME.card,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {locSuggestions.map((s, idx) => (
            <Pressable
              key={`${s.label}-${idx}`}
              onPress={() => selectSuggestion(s)}
              style={{
                padding: 12,
                borderBottomWidth: idx === locSuggestions.length - 1 ? 0 : 1,
                borderBottomColor: THEME.border,
              }}
            >
              <Text style={{ color: THEME.text, fontWeight: "800" }}>{s.label}</Text>
            </Pressable>
          ))}

          <Pressable onPress={hideDropdown} style={{ padding: 12 }}>
            <Text style={{ color: THEME.muted }}>Hide</Text>
          </Pressable>
        </View>
      )}

      <Text style={{ color: THEME.text, fontWeight: "800" }}>What are you craving?</Text>
      <TextInput
        value={cuisine}
        onChangeText={setCuisine}
        placeholder="e.g. tacos, ramen, bbq"
        placeholderTextColor={THEME.muted}
        style={{
          borderWidth: 1,
          borderColor: THEME.border,
          backgroundColor: THEME.inputBg,
          color: THEME.text,
          padding: 12,
          borderRadius: 12,
          marginTop: 8,
          marginBottom: 10,
        }}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        {cuisinePresets.map((c) => (
          <Chip key={c} label={c} active={cuisine.toLowerCase() === c} onPress={() => setCuisine(c)} />
        ))}
      </View>

      <Pressable
        onPress={runLRS}
        style={{ backgroundColor: THEME.button, padding: 14, borderRadius: 12 }}
      >
        <Text style={{ color: THEME.buttonText, fontWeight: "900", textAlign: "center" }}>
          {loading ? "Finding local favorites…" : "Find Local Favorites"}
        </Text>
      </Pressable>

      {loading && (
        <Text style={{ color: THEME.muted, marginTop: 10 }}>
          Filtering out chains and weak picks… this can take a few seconds.
        </Text>
      )}

      <Pressable onPress={() => setShowWhy(!showWhy)} style={{ marginTop: 10 }}>
        <Text style={{ color: THEME.link }}>
          {showWhy ? "Hide why locals trust these picks" : "Why locals trust these picks"}
        </Text>
      </Pressable>

      {showWhy && (
        <View
          style={{
            backgroundColor: THEME.card,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 10,
            marginTop: 10,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: THEME.text }}>{whyText()}</Text>
        </View>
      )}

      {debugLine && <Text style={{ color: THEME.muted, marginVertical: 12 }}>{debugLine}</Text>}

      {note && (
        <View
          style={{
            backgroundColor: THEME.card,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: THEME.text, fontWeight: "900", marginBottom: 6 }}>ℹ️ Heads up</Text>
          <Text style={{ color: THEME.muted }}>{note}</Text>
        </View>
      )}

      {showEmptyState && (
        <View
          style={{
            backgroundColor: THEME.card,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: THEME.text, fontWeight: "900", marginBottom: 6 }}>
            No strong matches nearby
          </Text>
          <Text style={{ color: THEME.muted }}>
            Try a simpler food word (like “tacos” instead of “birria”), or add a nearby city for better coverage.
          </Text>
        </View>
      )}

      {results.map((r, i) => (
        <View
          key={i}
          style={{
            backgroundColor: THEME.card,
            borderColor: THEME.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            marginBottom: 12,
            ...CARD_SHADOW, // ✅ Google/Yelp-ish card lift
          }}
        >
          {/* ✅ Photo (tap to view full screen) */}
          <View style={{ ...PHOTO_SHADOW, borderRadius: 12, marginBottom: 10 }}>
            <Pressable
              disabled={!r.photo_url}
              onPress={() => {
                if (r.photo_url) openPhoto(String(r.photo_url));
              }}
              style={{
                width: "100%",
                height: 160,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: THEME.inputBg,
                borderWidth: 1, // tiny edge like Yelp cards
                borderColor: THEME.border,
              }}
            >
              {r.photo_url ? (
                <Image
                  source={{ uri: r.photo_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : null}
            </Pressable>
          </View>

          {r.photo_url ? (
            <Text style={{ color: THEME.muted, fontSize: 12, marginBottom: 6 }}>
              Photo from Google • Tap to view
            </Text>
          ) : null}

          <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 18 }}>{r.name}</Text>
          <Text style={{ color: THEME.muted, marginTop: 4 }}>{r.location}</Text>

          {typeof r.distance_miles === "number" && (
            <Text style={{ marginTop: 8, color: THEME.muted }}>Distance: {r.distance_miles} mi</Text>
          )}

          <Text style={{ marginTop: 10, color: THEME.text }}>
            ⭐ {r.rating} ({r.reviews}) • Local trust: {r.confidence}
          </Text>

          {r.also_in_strict && (
            <Text style={{ marginTop: 6, color: THEME.muted }}>
              Also shows up in Top Local Picks.
            </Text>
          )}

          {r.why && <Text style={{ marginTop: 10, color: THEME.text }}>{r.why}</Text>}

          {r.confidence_explainer && (
            <Text style={{ marginTop: 6, color: THEME.muted }}>{r.confidence_explainer}</Text>
          )}

          {mode === "hype" && r.hype_reason && (
            <Text style={{ marginTop: 10, color: THEME.text }}>🔥 Hype reason: {r.hype_reason}</Text>
          )}

          {r.order && (
            <Text style={{ marginTop: 10, color: THEME.muted, fontStyle: "italic" }}>{r.order}</Text>
          )}

          <View style={{ flexDirection: "row", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(r.links.google_maps)}>
              <Text style={{ color: THEME.link }}>Google Maps</Text>
            </Pressable>

            <Pressable onPress={() => WebBrowser.openBrowserAsync(r.links.yelp_search)}>
              <Text style={{ color: THEME.link }}>Yelp (browser)</Text>
            </Pressable>

            <Pressable onPress={() => sharePick(r.name, r.links.google_maps)}>
              <Text style={{ color: THEME.link }}>Share</Text>
            </Pressable>
          </View>

          <Text style={{ marginTop: 10, color: THEME.muted }}>
            Tip: If the Yelp app gets stuck, close it first, then tap the link again.
          </Text>
        </View>
      ))}

      <Divider />
      <Text style={{ color: THEME.muted, textAlign: "center", marginBottom: 30 }}>
        Where real locals eat. The food that speaks for itself.
      </Text>
    </ScrollView>
  );
}
