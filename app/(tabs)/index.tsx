import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

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

export default function LRSHome() {
  const [location, setLocation] = useState("Arroyo Grande, CA");
  const [cuisine, setCuisine] = useState("tacos");
  const [mode, setMode] = useState<"strict" | "best" | "hype">("strict");

  const [results, setResults] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugLine, setDebugLine] = useState("");
  const [showWhy, setShowWhy] = useState(false);

  // ✅ New: lets us show a calm empty-state only after a search
  const [hasSearched, setHasSearched] = useState(false);

  const cuisinePresets = [
    "tacos",
    "ramen",
    "bbq",
    "breakfast",
    "sushi",
    "thai",
    "pizza",
    "burgers",
  ];

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
      setHasSearched(true); // ✅ mark that we ran at least one search
      setLoading(true);
      setNote("");
      setDebugLine("");
      setResults([]);
      setShowWhy(false);

      const params = new URLSearchParams();
      params.append("location", location);
      if (cuisine.trim()) params.append("cuisine", cuisine.trim());
      params.append("mode", mode);

      const res = await fetch(`${API_BASE}/lrs?${params.toString()}`);
      const data = await res.json();

      if (data.error) {
        setNote(data.error);
        return;
      }

      const picks = data.picks || [];
      setResults(picks);

      // Primary note from backend (small towns, widened net, etc.)
      const backendNote = data.limitation_note ? String(data.limitation_note) : "";

      // Guardrail note when user included a country but results appear in a different country
      const guardrail = locationGuardrailNote(location, picks) || "";

      // Combine notes safely (if both exist, show both)
      const combined = [backendNote, guardrail].filter(Boolean).join("\n\n");
      if (combined) setNote(combined);

      if (data.debug) {
        setDebugLine(
          `You’re in ${friendlyModeName(data.debug.mode)} mode. I’m showing ${data.debug.final_count} picks.`
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
    <ScrollView style={{ padding: 16, paddingTop: 32, backgroundColor: THEME.bg }}>
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
        placeholder="e.g. Arroyo Grande, CA"
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
          <Chip
            key={c}
            label={c}
            active={cuisine.toLowerCase() === c}
            onPress={() => setCuisine(c)}
          />
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

      {/* ✅ New: calm loading helper (only while loading) */}
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

      {/* Item #2: limitation_note (and guardrails) as a calm info card */}
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
          <Text style={{ color: THEME.text, fontWeight: "900", marginBottom: 6 }}>
            ℹ️ Heads up
          </Text>
          <Text style={{ color: THEME.muted }}>{note}</Text>
        </View>
      )}

      {/* ✅ New: empty state (only after a search, only if no other note exists) */}
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
          }}
        >
          <Text style={{ color: THEME.text, fontWeight: "900", fontSize: 18 }}>{r.name}</Text>
          <Text style={{ color: THEME.muted, marginTop: 4 }}>{r.location}</Text>

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
            <Text style={{ marginTop: 10, color: THEME.text }}>
              🔥 Hype reason: {r.hype_reason}
            </Text>
          )}

          {r.order && (
            <Text style={{ marginTop: 10, color: THEME.muted, fontStyle: "italic" }}>
              {r.order}
            </Text>
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
