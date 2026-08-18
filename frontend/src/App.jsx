import { useState, useRef, useEffect } from "react";
import axios from "axios";

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_STYLES = {
  "HIGH RISK":     { bg: "#fff0f0", border: "#ff4d4d", badge: "#ff4d4d" },
  "MODERATE RISK": { bg: "#fffbf0", border: "#ffa500", badge: "#ffa500" },
  "LOW RISK":      { bg: "#f0fff4", border: "#52c41a", badge: "#52c41a" },
};

const STATUS_COLORS = {
  "ABNORMAL":   { bg: "#fff0f0", color: "#cf1322", border: "#ff4d4d" },
  "BORDERLINE": { bg: "#fffbf0", color: "#874d00", border: "#ffa500" },
  "NORMAL":     { bg: "#f0fff4", color: "#135200", border: "#52c41a" },
};

const SUGGESTED_QUESTIONS = [
  "What should I eat to improve my results?",
  "Which result is most concerning?",
  "What lifestyle changes do you recommend?",
  "Can you explain my cholesterol values?",
  "Should I be worried about my kidney results?",
];

const TABS = [
  { id: "lab",  label: "🧪 Lab Report", desc: "CBC, metabolic panel, lipids" },
  { id: "ecg",  label: "❤️ ECG",        desc: "Electrocardiogram analysis"  },
  { id: "xray", label: "🩻 X-Ray",      desc: "Chest, bone, abdominal"      },
];

// ─── Reusable Components ──────────────────────────────────────────────────────

function UploadZone({ file, onFileChange, onDrop, accept, hint }) {
  const [dragOver, setDragOver] = useState(false);
  const id = "file-" + Math.random().toString(36).slice(2);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e); }}
      onClick={() => document.getElementById(id).click()}
      style={{
        border: `2px dashed ${dragOver ? "#1a73e8" : "#ccc"}`,
        borderRadius: 10, padding: "36px 20px", textAlign: "center",
        cursor: "pointer", background: dragOver ? "#f0f7ff" : "#fafafa",
        transition: "all 0.2s"
      }}
    >
      <div style={{ fontSize: 40 }}>📁</div>
      <p style={{ margin: "10px 0 4px", fontWeight: 600, color: "#333" }}>
        {file ? file.name : "Drag & drop file here"}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
        {file ? `${(file.size / 1024).toFixed(1)} KB` : hint}
      </p>
      <input id={id} type="file" accept={accept} onChange={onFileChange} style={{ display: "none" }} />
    </div>
  );
}

function RiskBadge({ level }) {
  const s = RISK_STYLES[level] || RISK_STYLES["LOW RISK"];
  const icons = {
    "HIGH RISK":     "🔴",
    "MODERATE RISK": "🟡",
    "LOW RISK":      "🟢",
  };
  return (
    <span style={{
      background: s.badge, color: "white",
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      whiteSpace: "nowrap"
    }}>
      {icons[level] || ""} {level}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["NORMAL"];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600
    }}>
      {status}
    </span>
  );
}

function UrgentFlags({ flags }) {
  if (!flags?.length) return null;
  return (
    <div style={{ background: "#fff0f0", border: "1px solid #ff4d4d", borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ fontWeight: 700, color: "#cf1322", marginBottom: 8 }}>🚨 Urgent Flags</div>
      {flags.map((f, i) => (
        <div key={i} style={{ color: "#cf1322", fontSize: 13, marginBottom: 4 }}>• {f}</div>
      ))}
    </div>
  );
}

function Recommendations({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ background: "#f0f7ff", border: "1px solid #91caff", borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ fontWeight: 700, color: "#0d47a1", marginBottom: 8 }}>💡 Recommendations</div>
      {items.map((r, i) => (
        <div key={i} style={{ color: "#1a1a2e", fontSize: 13, marginBottom: 4 }}>• {r}</div>
      ))}
    </div>
  );
}

function Disclaimer({ text }) {
  return (
    <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 10, padding: 16, color: "#856404", fontSize: 13, marginTop: 16 }}>
      ⚕️ <strong>Medical Disclaimer:</strong> {text}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ result, labText, analysisType }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  useEffect(() => {
    if (!result) return;
    let greeting = "";

    if (analysisType === "lab") {
      const high = result.diseases?.filter(d => d.risk_level === "HIGH RISK") || [];
      const mod  = result.diseases?.filter(d => d.risk_level === "MODERATE RISK") || [];
      if (high.length > 0) {
        greeting = `Hi there! I've gone through your lab report carefully. I can see **${high[0].disease}** came up as a high-risk finding — I know that sounds concerning, but many of these are very manageable with the right steps. Ask me anything, whether it's what a value means, what to eat, or what kind of doctor to see. I'm here to help! 🩺`;
      } else if (mod.length > 0) {
        greeting = `Hi! I've reviewed your lab results. Overall things look okay, though there are a couple of areas worth keeping an eye on — **${mod[0].disease}** showed up as moderate risk. Feel free to ask me what any of the values mean or what you can do about them! 🩺`;
      } else {
        greeting = `Hi! Good news — your lab report looks quite healthy overall, with most markers in the normal range. That said, I'm happy to explain what any specific value means, or give you tips to maintain these results. What would you like to know? 🩺`;
      }
    } else if (analysisType === "ecg") {
      const isUrgent = result.urgent_flags?.length > 0;
      greeting = isUrgent
        ? `Hi! I've analyzed your ECG and there are a couple of findings that need your attention — particularly around **${result.urgent_flags[0]}**. Please don't panic, but do follow up with a cardiologist soon. Ask me anything you'd like to understand better. ❤️`
        : `Hi! I've looked at your ECG. The rhythm is showing as **${result.rhythm}** and overall risk is **${result.overall_risk}**. Happy to explain what any of these findings mean in plain language — just ask! ❤️`;
    } else if (analysisType === "xray") {
      greeting = `Hi! I've reviewed your **${result.xray_type}**. The overall reading is **${result.overall_risk}**. If you're unsure what any of the findings mean, or want to know what happens next, just ask — I'll walk you through it clearly. 🩻`;
    }

    setChatHistory([{ role: "assistant", content: greeting }]);
  }, [result]);

  const formatMessage = (text) =>
    text.split(/\*\*(.*?)\*\*/g).map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);

  const sendMessage = async (msg) => {
    const text = msg || chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg = { role: "user", content: text };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await axios.post("http://localhost:8000/chat", {
        message: text,
        history: chatHistory,
        lab_text: labText || JSON.stringify(result),
        analysis: result,
      });
      setChatHistory(prev => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const suggestions = analysisType === "ecg"
    ? ["What does ST elevation mean?", "Is my heart rate normal?", "What is atrial fibrillation?", "Should I see a cardiologist?"]
    : analysisType === "xray"
    ? ["What did you find in my X-ray?", "Is this finding serious?", "What should I do next?", "What does pleural effusion mean?"]
    : SUGGESTED_QUESTIONS;

  return (
    <div style={{
      background: "white", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      display: "flex", flexDirection: "column", height: 680,
      position: "sticky", top: 20
    }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3a82c1, #3cc7dc)", borderRadius: "12px 12px 0 0", padding: "16px 20px", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>MediBot</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>AI Health Assistant • Context-Aware</div>
          </div>
          <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && <span style={{ marginRight: 8, fontSize: 20, alignSelf: "flex-end" }}>🤖</span>}
            <div style={{
              maxWidth: "82%", padding: "10px 14px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: msg.role === "user" ? "linear-gradient(135deg, #1a73e8, #0d47a1)" : "#f0f4ff",
              color: msg.role === "user" ? "white" : "#1a1a2e",
              fontSize: 13, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
            }}>
              {formatMessage(msg.content)}
            </div>
            {msg.role === "user" && <span style={{ marginLeft: 8, fontSize: 20, alignSelf: "flex-end" }}>👤</span>}
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div style={{ background: "#f0f4ff", borderRadius: "18px 18px 18px 4px", padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#1a73e8", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested questions */}
      {chatHistory.length <= 1 && (
        <div style={{ padding: "0 16px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)} style={{
              background: "#f0f4ff", border: "1px solid #c7d7ff", borderRadius: 20,
              padding: "5px 12px", fontSize: 11, color: "#1a73e8", cursor: "pointer"
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 16, borderTop: "1px solid #f0f0f0", display: "flex", gap: 8 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Ask about your results..."
          style={{ flex: 1, padding: "10px 14px", border: "1px solid #ddd", borderRadius: 24, fontSize: 13, outline: "none", background: "#fafafa" }}
        />
        <button onClick={() => sendMessage()} disabled={!chatInput.trim() || chatLoading} style={{
          width: 40, height: 40, borderRadius: "50%", border: "none",
          background: !chatInput.trim() || chatLoading ? "#ccc" : "linear-gradient(135deg, #1a73e8, #0d47a1)",
          color: "white", fontSize: 16, cursor: !chatInput.trim() || chatLoading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>➤</button>
      </div>
    </div>
  );
}

// ─── ECG Results ──────────────────────────────────────────────────────────────

function ECGResults({ result }) {
  return (
    <div>
      <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: "#1a1a2e" }}>❤️ ECG Analysis</h2>
          <RiskBadge level={result.overall_risk} />
        </div>
        <p style={{ color: "#555", marginBottom: 16 }}>{result.ecg_summary}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Heart Rate",    value: result.heart_rate_estimate,        icon: "💓" },
            { label: "Rhythm",        value: result.rhythm,                     icon: "〰️" },
            { label: "ST Elevation",  value: result.st_analysis?.st_elevation,  icon: "📈" },
            { label: "ST Depression", value: result.st_analysis?.st_depression, icon: "📉" },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, minWidth: 160, background: "#f8f9ff", borderRadius: 8, padding: "14px 16px", borderLeft: "4px solid #1a73e8" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e" }}>{stat.value || "N/A"}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {result.st_analysis?.clinical_significance && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, color: "#1a1a2e" }}>📊 ST Segment Analysis</h3>
          <p style={{ color: "#555", fontSize: 14 }}>{result.st_analysis.clinical_significance}</p>
          {result.st_analysis.leads_affected?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {result.st_analysis.leads_affected.map((lead, i) => (
                <span key={i} style={{ background: "#f0f4ff", border: "1px solid #91caff", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#0d47a1" }}>
                  {lead}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 20 }}>
        {result.findings?.map((f, i) => {
          const s = STATUS_COLORS[f.status] || STATUS_COLORS["NORMAL"];
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>{f.finding}</div>
                <StatusBadge status={f.status} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5 }}>{f.description}</p>
            </div>
          );
        })}
      </div>

      <UrgentFlags flags={result.urgent_flags} />
      <Recommendations items={result.recommendations} />
      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

// ─── X-Ray Results ────────────────────────────────────────────────────────────

function XRayResults({ result }) {
  const typeSpecific = result.type_specific_analysis || {};
  const xrayData = typeSpecific.chest || typeSpecific.bone || typeSpecific.abdominal || null;
  const xrayKey  = typeSpecific.chest ? "chest" : typeSpecific.bone ? "bone" : "abdominal";

  const typeFields = {
    chest: [
      { label: "Lungs",         key: "lungs"         },
      { label: "Heart Size",    key: "heart_size"    },
      { label: "Pleura",        key: "pleura"        },
      { label: "Mediastinum",   key: "mediastinum"   },
      { label: "Visible Bones", key: "bones_visible" },
    ],
    bone: [
      { label: "Fracture",     key: "fracture_present"  },
      { label: "Location",     key: "fracture_location" },
      { label: "Bone Density", key: "bone_density"      },
      { label: "Joint Spaces", key: "joint_spaces"      },
      { label: "Soft Tissue",  key: "soft_tissue"       },
    ],
    abdominal: [
      { label: "Bowel Gas Pattern", key: "bowel_gas_pattern" },
      { label: "Organ Enlargement", key: "organomegaly"      },
      { label: "Calcifications",    key: "calcifications"    },
      { label: "Free Air",          key: "free_air"          },
    ],
  };

  return (
    <div>
      <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", color: "#1a1a2e" }}>🩻 {result.xray_type}</h2>
            <div style={{ fontSize: 13, color: "#888" }}>Image Quality: {result.image_quality}</div>
          </div>
          <RiskBadge level={result.overall_risk} />
        </div>
        <p style={{ color: "#555", margin: 0 }}>{result.xray_summary}</p>
      </div>

      {xrayData && typeFields[xrayKey] && (
        <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, color: "#1a1a2e" }}>🔍 Detailed Findings</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {typeFields[xrayKey].map(field =>
              xrayData[field.key] ? (
                <div key={field.key} style={{ background: "#f8f9ff", borderRadius: 8, padding: "12px 16px", borderLeft: "4px solid #1a73e8" }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{field.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{xrayData[field.key]}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 20 }}>
        {result.findings?.map((f, i) => {
          const s = STATUS_COLORS[f.status] || STATUS_COLORS["NORMAL"];
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>{f.finding}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>📍 {f.region}</div>
                </div>
                <StatusBadge status={f.status} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5 }}>{f.description}</p>
            </div>
          );
        })}
      </div>

      <UrgentFlags flags={result.urgent_flags} />
      <Recommendations items={result.recommendations} />
      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

// ─── Quick Action Summary ─────────────────────────────────────────────────────

function QuickActionSummary({ diseases }) {
  if (!diseases?.length) return null;

  // Collect only HIGH and MODERATE risk diseases with meaningful data
  const urgent = diseases.filter(d => d.risk_level === "HIGH RISK");
  const moderate = diseases.filter(d => d.risk_level === "MODERATE RISK");

  // Nothing to show if everything is low risk
  if (urgent.length === 0 && moderate.length === 0) {
    return (
      <div style={{ background: "linear-gradient(135deg, #f0fff4, #e6ffed)", border: "1px solid #52c41a", borderRadius: 12, padding: 20, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div style={{ fontWeight: 700, color: "#135200", fontSize: 15 }}>Overall: Low Risk Across All Categories</div>
        </div>
        <div style={{ fontSize: 13, color: "#2d6a2d" }}>
          Your lab results and lifestyle profile suggest a generally healthy picture. Keep up your current habits and schedule regular checkups to stay on track.
        </div>
      </div>
    );
  }

  // Pick top quick_remedy from HIGH risk diseases (max 2)
  const topActions = [
    ...urgent.filter(d => d.quick_remedy).slice(0, 2),
    ...moderate.filter(d => d.quick_remedy).slice(0, 1),
  ].slice(0, 3);

  // Pick one lifestyle tip per HIGH risk disease (max 2)
  const topLifestyle = urgent
    .filter(d => d.lifestyle_tips?.length)
    .slice(0, 2)
    .map(d => ({ disease: d.disease, tip: d.lifestyle_tips[0] }));

  // Pick one dietary advice per HIGH risk disease (max 2)
  const topDiet = urgent
    .filter(d => d.dietary_advice?.length)
    .slice(0, 2)
    .map(d => ({ disease: d.disease, advice: d.dietary_advice[0] }));

  return (
    <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", marginTop: 8 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)", padding: "18px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Quick Action Summary</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>Most important actions based on your combined analysis</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {urgent.length > 0 && (
            <span style={{ background: "#ff4d4d", color: "white", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
              🔴 {urgent.length} High Risk
            </span>
          )}
          {moderate.length > 0 && (
            <span style={{ background: "#ffa500", color: "white", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
              🟡 {moderate.length} Moderate Risk
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>

        {/* Immediate Actions */}
        {topActions.length > 0 && (
          <div style={{ background: "#fff5f5", border: "1px solid #ffccc7", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#cf1322", marginBottom: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              🚨 Immediate Actions
            </div>
            {topActions.map((d, i) => (
              <div key={i} style={{ marginBottom: i < topActions.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ff4d4d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  {d.disease}
                </div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{d.quick_remedy}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Lifestyle Changes */}
        {topLifestyle.length > 0 && (
          <div style={{ background: "#f0f7ff", border: "1px solid #91caff", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#0d47a1", marginBottom: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              🏃 Key Lifestyle Changes
            </div>
            {topLifestyle.map((item, i) => (
              <div key={i} style={{ marginBottom: i < topLifestyle.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1a73e8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  {item.disease}
                </div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>✓ {item.tip}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top Dietary Advice */}
        {topDiet.length > 0 && (
          <div style={{ background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#135200", marginBottom: 12, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              🥗 Priority Dietary Advice
            </div>
            {topDiet.map((item, i) => (
              <div key={i} style={{ marginBottom: i < topDiet.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#52c41a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  {item.disease}
                </div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>• {item.advice}</div>
              </div>
            ))}
          </div>
        )}

        {/* See a doctor box — always shown if any HIGH risk */}
        {urgent.length > 0 && (
          <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 700, color: "#856404", marginBottom: 12, fontSize: 13 }}>
              🏥 Specialist Referral
            </div>
            {urgent.slice(0, 2).map((d, i) => (
              <div key={i} style={{ marginBottom: i < Math.min(urgent.length, 2) - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#d48806", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                  {d.disease}
                </div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>
                  {d.disease.includes("Diabetes") || d.disease.includes("Metabolic")
                    ? "See an endocrinologist or your GP for further testing."
                    : d.disease.includes("Cardiovascular") || d.disease.includes("Cholesterol")
                    ? "Consult a cardiologist for a detailed heart risk assessment."
                    : d.disease.includes("Kidney")
                    ? "See a nephrologist or get a kidney function panel done."
                    : d.disease.includes("Liver")
                    ? "Consult a hepatologist or gastroenterologist."
                    : d.disease.includes("Thyroid")
                    ? "See an endocrinologist for thyroid function evaluation."
                    : d.disease.includes("Anemia") || d.disease.includes("Iron")
                    ? "Consult a hematologist or your GP for iron studies."
                    : "Consult your GP or a relevant specialist promptly."
                  }
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Footer note */}
      <div style={{ borderTop: "1px solid #f0f0f0", padding: "12px 24px", background: "#fafafa", fontSize: 12, color: "#888" }}>
        ⚕️ This summary highlights the most critical points only. Review each disease card above for the complete analysis.
      </div>
    </div>
  );
}

// ─── Lab Results ──────────────────────────────────────────────────────────────

function LabResults({ result }) {
  const highRiskCount = result.diseases?.filter(d => d.risk_level === "HIGH RISK").length || 0;
  const modRiskCount  = result.diseases?.filter(d => d.risk_level === "MODERATE RISK").length || 0;

  return (
    <div>
      {/* Summary banner */}
      <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, color: "#1a1a2e" }}>📊 Analysis Summary</h2>
        <p style={{ color: "#555", marginBottom: 16 }}>{result.patient_summary}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "High Risk",       count: highRiskCount,           color: "#ff4d4d" },
            { label: "Moderate Risk",   count: modRiskCount,            color: "#ffa500" },
            { label: "Total Evaluated", count: result.diseases?.length, color: "#1a73e8" },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, minWidth: 120, background: "#f8f9ff", borderRadius: 8, padding: "14px 18px", borderLeft: `4px solid ${stat.color}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.count}</div>
              <div style={{ fontSize: 13, color: "#666" }}>{stat.label}</div>
            </div>
          ))}
        </div>
        {result.overall_health_note && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0f7ff", borderRadius: 8, fontSize: 13, color: "#0d47a1" }}>
            💬 {result.overall_health_note}
          </div>
        )}
      </div>

      {/* Disease cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16, marginBottom: 20 }}>
        {result.diseases?.map((disease, i) => {
          const style = RISK_STYLES[disease.risk_level] || RISK_STYLES["LOW RISK"];
          const isHighOrMod = disease.risk_level !== "LOW RISK";
          return (
            <div key={i} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 12, padding: 20 }}>

              {/* Name + badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <h3 style={{ margin: 0, color: "#1a1a2e", fontSize: 16 }}>{disease.disease}</h3>
                <RiskBadge level={disease.risk_level} />
              </div>

              {/* Reasoning */}
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#444", lineHeight: 1.5 }}>{disease.reasoning}</p>

              {/* Lifestyle contribution */}
              {disease.lifestyle_contribution && (
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10, fontStyle: "italic", paddingLeft: 8, borderLeft: "2px solid #ddd" }}>
                  🧬 {disease.lifestyle_contribution}
                </div>
              )}

              {/* Key indicators */}
              {disease.key_indicators?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {disease.key_indicators.map((ind, j) => (
                    <span key={j} style={{ background: "white", border: `1px solid ${style.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 12, color: "#333" }}>
                      📌 {ind}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick remedy — HIGH and MODERATE only */}
              {isHighOrMod && disease.quick_remedy && (
                <div style={{ background: "white", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: `3px solid ${style.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: style.badge, marginBottom: 4 }}>⚡ Quick Action</div>
                  <div style={{ fontSize: 13, color: "#333" }}>{disease.quick_remedy}</div>
                </div>
              )}

              {/* Lifestyle tips */}
              {disease.lifestyle_tips?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>🏃 Lifestyle Tips</div>
                  {disease.lifestyle_tips.map((tip, j) => (
                    <div key={j} style={{ fontSize: 12, color: "#555", marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ color: style.badge, flexShrink: 0 }}>✓</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dietary advice */}
              {disease.dietary_advice?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>🥗 Dietary Advice</div>
                  {disease.dietary_advice.map((advice, j) => (
                    <div key={j} style={{ fontSize: 12, color: "#555", marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ flexShrink: 0 }}>•</span>
                      <span>{advice}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          );
        })}
      </div>

      <QuickActionSummary diseases={result.diseases} />
      <Disclaimer text={result.disclaimer} />
    </div>
  );
}

// ─── Lifestyle Form ───────────────────────────────────────────────────────────

function LifestyleForm({ onSubmit, extracting, analyzing }) {
  const [form, setForm] = useState({
    smoking: "", alcohol: "", junk_food: "", exercise: "",
    sleep: "", stress: "", water: "", family_history: []
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleFamily = (val) => {
    setForm(prev => {
      const list = prev.family_history.includes(val)
        ? prev.family_history.filter(x => x !== val)
        : [...prev.family_history, val];
      return { ...prev, family_history: list };
    });
  };

  const answeredCount = ["smoking","alcohol","junk_food","exercise","sleep","stress","water"]
    .filter(k => form[k]).length;
  const isComplete = answeredCount === 7;

  const questions = [
    {
      key: "smoking", label: "🚬 Do you smoke?",
      options: [
        { val: "never",        label: "Never"           },
        { val: "ex_smoker",    label: "Ex-smoker"       },
        { val: "occasionally", label: "Occasionally"    },
        { val: "regularly",    label: "Regularly"       },
        { val: "heavy",        label: "Heavy (10+/day)" },
      ]
    },
    {
      key: "alcohol", label: "🍺 Alcohol consumption?",
      options: [
        { val: "never",        label: "Never"        },
        { val: "occasionally", label: "Occasionally" },
        { val: "regularly",    label: "1-2x/week"    },
        { val: "frequently",   label: "3+/week"      },
      ]
    },
    {
      key: "junk_food", label: "🍔 Junk / processed food?",
      options: [
        { val: "rarely",   label: "Rarely"    },
        { val: "sometimes",label: "1-2x/week" },
        { val: "often",    label: "3-4x/week" },
        { val: "daily",    label: "Daily"     },
      ]
    },
    {
      key: "exercise", label: "🏃 How often do you exercise?",
      options: [
        { val: "daily",    label: "Daily"     },
        { val: "often",    label: "3-5x/week" },
        { val: "sometimes",label: "1-2x/week" },
        { val: "rarely",   label: "Rarely"    },
        { val: "never",    label: "Never"     },
      ]
    },
    {
      key: "sleep", label: "😴 Average sleep per night?",
      options: [
        { val: "less5",       label: "Less than 5 hrs" },
        { val: "five_six",    label: "5-6 hrs"         },
        { val: "seven_eight", label: "7-8 hrs"         },
        { val: "more9",       label: "More than 9 hrs" },
      ]
    },
    {
      key: "stress", label: "😤 Daily stress level?",
      options: [
        { val: "low",      label: "Low"       },
        { val: "moderate", label: "Moderate"  },
        { val: "high",     label: "High"      },
        { val: "very_high",label: "Very High" },
      ]
    },
    {
      key: "water", label: "💧 Daily water intake?",
      options: [
        { val: "less1",    label: "Less than 1L" },
        { val: "one_two",  label: "1-2 Litres"   },
        { val: "two_three",label: "2-3 Litres"   },
        { val: "more3",    label: "More than 3L" },
      ]
    },
  ];

  const familyOptions = [
    "Diabetes", "Heart Disease", "Cancer", "Kidney Disease",
    "Hypertension", "Thyroid Disease", "Stroke", "Asthma",
    "Mental Health Disorders", "Autoimmune Disease", "None"
  ];

  const handleSubmitWithOther = () => {
    const lifestyle = { ...form };
    // Merge "Other" text into family_history array if filled
    if (form.family_history_other?.trim()) {
      lifestyle.family_history = [
        ...form.family_history,
        `Other: ${form.family_history_other.trim()}`
      ];
    }
    delete lifestyle.family_history_other;
    onSubmit(lifestyle);
  };

  const buttonDisabled = !isComplete || extracting || analyzing;
  const buttonText = analyzing
    ? "⏳ Analyzing combined results..."
    : extracting
    ? "⏳ Still extracting report text..."
    : !isComplete
    ? `Please answer all questions (${answeredCount}/7 done)`
    : "🔍 Analyze Combined Results";

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📋</span>
          <div>
            <h2 style={{ margin: 0, color: "#1a1a2e", fontSize: 18 }}>Lifestyle Questionnaire</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              Combined with your lab values for a more accurate risk assessment
            </p>
          </div>
        </div>
        <div style={{ fontSize: 12, textAlign: "right", paddingTop: 4 }}>
          {extracting
            ? <span style={{ color: "#1a73e8", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1a73e8", animation: "bounce 1s ease-in-out infinite" }} />
                Extracting report...
              </span>
            : <span style={{ color: "#52c41a" }}>✓ Report text ready</span>
          }
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "#f0f0f0", borderRadius: 4, height: 5, margin: "16px 0 24px" }}>
        <div style={{
          background: isComplete ? "linear-gradient(90deg, #1a73e8, #52c41a)" : "linear-gradient(90deg, #1a73e8, #4ab3f4)",
          borderRadius: 4, height: 5,
          width: `${(answeredCount / 7) * 100}%`,
          transition: "width 0.3s"
        }} />
      </div>

      {/* Questions grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
        {questions.map(q => (
          <div key={q.key}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 10 }}>
              {q.label}
              {form[q.key] && <span style={{ marginLeft: 6, color: "#52c41a", fontSize: 13 }}>✓</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {q.options.map(opt => (
                <button
                  key={opt.val}
                  onClick={() => set(q.key, opt.val)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                    border: form[q.key] === opt.val ? "2px solid #1a73e8" : "1px solid #ddd",
                    background: form[q.key] === opt.val ? "#e8f0fe" : "white",
                    color: form[q.key] === opt.val ? "#1a73e8" : "#555",
                    fontWeight: form[q.key] === opt.val ? 600 : 400,
                    transition: "all 0.15s"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Family history — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 10 }}>
            🧬 Family history of diseases?
            <span style={{ fontSize: 12, color: "#888", fontWeight: 400, marginLeft: 6 }}>Select all that apply</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {familyOptions.map(opt => (
              <button
                key={opt}
                onClick={() => toggleFamily(opt)}
                style={{
                  padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: form.family_history.includes(opt) ? "2px solid #1a73e8" : "1px solid #ddd",
                  background: form.family_history.includes(opt) ? "#e8f0fe" : "white",
                  color: form.family_history.includes(opt) ? "#1a73e8" : "#555",
                  fontWeight: form.family_history.includes(opt) ? 600 : 400,
                  transition: "all 0.15s"
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {/* Other / rare disease input */}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#555", whiteSpace: "nowrap" }}>Other (rare/unlisted):</span>
            <input
              type="text"
              placeholder="e.g. Huntington's, Thalassemia..."
              value={form.family_history_other || ""}
              onChange={e => setForm(prev => ({ ...prev, family_history_other: e.target.value }))}
              style={{
                flex: 1, padding: "7px 14px", border: "1px solid #ddd",
                borderRadius: 20, fontSize: 13, outline: "none",
                background: form.family_history_other ? "#e8f0fe" : "white",
                color: "#333"
              }}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => handleSubmitWithOther()}
        disabled={buttonDisabled}
        style={{
          marginTop: 28, width: "100%", padding: 14,
          background: buttonDisabled ? "#ccc" : "linear-gradient(135deg, #1a73e8, #0d47a1)",
          color: "white", border: "none", borderRadius: 8,
          fontSize: 16, fontWeight: 600,
          cursor: buttonDisabled ? "not-allowed" : "pointer",
          transition: "all 0.2s"
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}

// ─── Lab Tab (3-step flow) ────────────────────────────────────────────────────

function LabTab() {
  const [step, setStep]                   = useState("upload");
  const [file, setFile]                   = useState(null);
  const [extracting, setExtracting]       = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [extractError, setExtractError]   = useState(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [analyzeError, setAnalyzeError]   = useState(null);
  const [result, setResult]               = useState(null);
  const [labText, setLabText]             = useState("");

  const handleFileSelect = (f) => { setFile(f); setExtractError(null); };

  // Kick off extraction immediately, move to lifestyle form in parallel
  const handleProceedToLifestyle = async (selectedFile) => {
    if (!selectedFile) return;
    setStep("lifestyle");
    setExtracting(true);
    setExtractError(null);
    setExtractedText("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const res = await axios.post("http://localhost:8000/extract", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setExtractedText(res.data.extracted_text);
    } catch (err) {
      setExtractError(err.response?.data?.detail || "Text extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const handleLifestyleSubmit = async (lifestyle) => {
    if (extracting) { setAnalyzeError("Report is still being extracted. Please wait a moment."); return; }
    if (extractError || !extractedText) { setAnalyzeError("Report extraction failed. Please go back and re-upload."); return; }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await axios.post("http://localhost:8000/analyze-combined", {
        extracted_text: extractedText,
        lifestyle
      });
      setResult(res.data.analysis);
      setLabText(res.data.extracted_text || extractedText);
      setStep("results");
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setStep("upload"); setFile(null);
    setExtractedText(""); setExtractError(null);
    setResult(null); setLabText(""); setAnalyzeError(null);
  };

  // ── Step 1: Upload ──
  if (step === "upload") {
    return (
      <div style={{ background: "#425a72", borderRadius: 12, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0, color: "#1a1a2e" }}>🧪 Upload Lab Report</h2>
        <p style={{ color: "#0d0101", fontSize: 13, marginBottom: 20 }}>
          After uploading, you'll answer a few quick lifestyle questions. We combine both for a more accurate risk prediction.
        </p>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          onClick={() => document.getElementById("labFileInput").click()}
          style={{
            border: `2px dashed ${file ? "#1a73e8" : "#ccc"}`,
            borderRadius: 10, padding: "36px 20px", textAlign: "center",
            cursor: "pointer", background: file ? "#f0f7ff" : "#e8749d", transition: "all 0.2s"
          }}
        >
          <div style={{ fontSize: 40 }}>📄</div>
          <p style={{ margin: "10px 0 4px", fontWeight: 600, color: "#333" }}>
            {file ? file.name : "Drag & drop lab report here"}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#270a41" }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB — ready` : "PDF, PNG, JPG — Max 10MB"}
          </p>
          <input id="labFileInput" type="file" accept=".pdf,.png,.jpg,.jpeg"
            onChange={e => handleFileSelect(e.target.files[0])} style={{ display: "none" }} />
        </div>
        <button
          onClick={() => handleProceedToLifestyle(file)}
          disabled={!file}
          style={{
            marginTop: 20, width: "100%", padding: 14,
            background: !file ? "#ccc" : "linear-gradient(135deg, #1a73e8, #0d47a1)",
            color: "white", border: "none", borderRadius: 8,
            fontSize: 16, fontWeight: 600, cursor: !file ? "not-allowed" : "pointer"
          }}
        >
          Next: Answer Lifestyle Questions →
        </button>
      </div>
    );
  }

  // ── Step 2: Lifestyle form ──
  if (step === "lifestyle") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={reset} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#555" }}>
            ← Back
          </button>
          <div style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 8 }}>
            <span>📄 {file?.name}</span>
            {extracting && <span style={{ color: "#1a73e8" }}>• Extracting text...</span>}
            {!extracting && extractedText && <span style={{ color: "#52c41a" }}>• ✓ Text extracted</span>}
            {extractError && <span style={{ color: "#cf1322" }}>• ✗ Extraction failed</span>}
          </div>
        </div>

        {extractError && (
          <div style={{ marginBottom: 16, padding: 14, background: "#fff0f0", border: "1px solid #ffccc7", borderRadius: 8, color: "#cf1322", fontSize: 13 }}>
            ⚠️ {extractError} — Please go back and re-upload the file.
          </div>
        )}
        {analyzeError && (
          <div style={{ marginBottom: 16, padding: 14, background: "#fff0f0", border: "1px solid #ffccc7", borderRadius: 8, color: "#cf1322", fontSize: 13 }}>
            ⚠️ {analyzeError}
          </div>
        )}

        <LifestyleForm onSubmit={handleLifestyleSubmit} extracting={extracting} analyzing={analyzing} />
      </div>
    );
  }

  // ── Step 3: Results ──
  if (step === "results") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={reset} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#555" }}>
            ← New Analysis
          </button>
          <div style={{ fontSize: 13, color: "#52c41a", fontWeight: 600 }}>
            ✓ Combined lab + lifestyle analysis complete
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>
          <LabResults result={result} />
          <ChatPanel result={result} labText={labText} analysisType="lab" />
        </div>
      </div>
    );
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState("lab");

  const [ecgFile, setEcgFile]         = useState(null);
  const [ecgResult, setEcgResult]     = useState(null);
  const [ecgLoading, setEcgLoading]   = useState(false);
  const [ecgError, setEcgError]       = useState(null);

  const [xrayFile, setXrayFile]       = useState(null);
  const [xrayResult, setXrayResult]   = useState(null);
  const [xrayLoading, setXrayLoading] = useState(false);
  const [xrayError, setXrayError]     = useState(null);

  const analyze = async (file, endpoint, setLoading, setResult, setError) => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`http://localhost:8000/${endpoint}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setResult(res.data.analysis);
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #9cd3e0, #f4f16b, #52dbc4)", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #ba981d, #3cdca4)", padding: "24px 40px", color: "white" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 750 }}>🧬 Medical AI Analyzer</h1>
        <p style={{ margin: "6px 0 0", opacity: 0.85, fontSize: 14, color: "black"}}>
          AI-powered analysis of lab reports, ECGs, and X-rays
        </p>
      </div>

      {/* Tabs */}
      <div style={{ background: "linear-gradient(135deg, #7bc2de, #cb8cca)", padding: "0 40px", display: "flex"}}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1,
            padding: "16px 24px", border: "none", background: "none", cursor: "pointer",
            borderBottom: activeTab === tab.id ? "3px solid #32b777" : "3px solid transparent",
            color: activeTab === tab.id ? "#552408" : "#666",
            fontWeight: activeTab === tab.id ? 700 : 400,
            fontSize: 14, transition: "all 0.2s",
            textAlign: "center"
          }}>
            <div>{tab.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{tab.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1300, margin: "32px auto", padding: "0 20px" }}>

        {/* ── LAB TAB ── */}
        {activeTab === "lab" && <LabTab />}

        {/* ── ECG TAB ── */}
        {activeTab === "ecg" && (
          <>
            <div style={{ background: "white", borderRadius: 12, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 28 }}>
              <h2 style={{ marginTop: 0, color: "#1a1a2e" }}>❤️ Upload ECG</h2>
              <div style={{ background: "#fff7e6", border: "1px solid #ffd591", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#874d00" }}>
                💡 Upload a clear photo or scan of a 12-lead ECG or ECG strip (PNG or JPG)
              </div>
              <UploadZone
                file={ecgFile}
                onFileChange={e => { setEcgFile(e.target.files[0]); setEcgResult(null); setEcgError(null); }}
                onDrop={e => { const f = e.dataTransfer.files[0]; if (f) { setEcgFile(f); setEcgResult(null); setEcgError(null); } }}
                accept=".png,.jpg,.jpeg"
                hint="PNG or JPG — 12-lead ECG or ECG strip image"
              />
              <button
                onClick={() => analyze(ecgFile, "analyze-ecg", setEcgLoading, setEcgResult, setEcgError)}
                disabled={!ecgFile || ecgLoading}
                style={{
                  marginTop: 20, width: "100%", padding: 14,
                  background: !ecgFile || ecgLoading ? "#ccc" : "linear-gradient(135deg, #e8431a, #b01c00)",
                  color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600,
                  cursor: !ecgFile || ecgLoading ? "not-allowed" : "pointer"
                }}
              >
                {ecgLoading ? "⏳ Analyzing ECG..." : "❤️ Analyze ECG"}
              </button>
              {ecgError && <div style={{ marginTop: 16, padding: 14, background: "#fff0f0", border: "1px solid #ffccc7", borderRadius: 8, color: "#cf1322" }}>⚠️ {ecgError}</div>}
            </div>
            {ecgResult && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>
                <ECGResults result={ecgResult} />
                <ChatPanel result={ecgResult} analysisType="ecg" />
              </div>
            )}
          </>
        )}

        {/* ── X-RAY TAB ── */}
        {activeTab === "xray" && (
          <>
            <div style={{ background: "white", borderRadius: 12, padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginBottom: 28 }}>
              <h2 style={{ marginTop: 0, color: "#1a1a2e" }}>🩻 Upload X-Ray</h2>
              <div style={{ background: "#f0f7ff", border: "1px solid #91caff", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#0d47a1" }}>
                💡 Supports chest, bone, and abdominal X-rays — AI will auto-detect the type
              </div>
              <UploadZone
                file={xrayFile}
                onFileChange={e => { setXrayFile(e.target.files[0]); setXrayResult(null); setXrayError(null); }}
                onDrop={e => { const f = e.dataTransfer.files[0]; if (f) { setXrayFile(f); setXrayResult(null); setXrayError(null); } }}
                accept=".png,.jpg,.jpeg"
                hint="PNG or JPG — chest, bone, or abdominal X-ray"
              />
              <button
                onClick={() => analyze(xrayFile, "analyze-xray", setXrayLoading, setXrayResult, setXrayError)}
                disabled={!xrayFile || xrayLoading}
                style={{
                  marginTop: 20, width: "100%", padding: 14,
                  background: !xrayFile || xrayLoading ? "#ccc" : "linear-gradient(135deg, #6b21a8, #3b0764)",
                  color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600,
                  cursor: !xrayFile || xrayLoading ? "not-allowed" : "pointer"
                }}
              >
                {xrayLoading ? "⏳ Analyzing X-Ray..." : "🩻 Analyze X-Ray"}
              </button>
              {xrayError && <div style={{ marginTop: 16, padding: 14, background: "#fff0f0", border: "1px solid #ffccc7", borderRadius: 8, color: "#cf1322" }}>⚠️ {xrayError}</div>}
            </div>
            {xrayResult && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 20 }}>
                <XRayResults result={xrayResult} />
                <ChatPanel result={xrayResult} analysisType="xray" />
              </div>
            )}
          </>
        )}

      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}