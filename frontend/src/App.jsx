import { useState, useEffect, useRef } from "react"

export default function App() {
  const [terms, setTerms] = useState([])
  const [selectedTermName, setSelectedTermName] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [status, setStatus] = useState({ is_generating: false, current_term: null, logs: [] })
  const [activeTab, setActiveTab] = useState("viewer")
  const [loading, setLoading] = useState(true)
  const logsEndRef = useRef(null)

  // 1. Fetch Glossary data
  const fetchGlossary = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/glossary")
      const data = await res.json()
      if (data && data.terms) {
        setTerms(data.terms)
        // Auto-select first term on initial load if none selected
        setSelectedTermName(prev => {
          if (!prev && data.terms.length > 0) {
            return data.terms[0].term
          }
          return prev
        })
      }
    } catch (err) {
      console.error("Error fetching glossary:", err)
    } finally {
      setLoading(false)
    }
  }

  // 2. Fetch Generation Status & Logs
  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/glossary/status")
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.error("Error fetching status:", err)
    }
  }

  // Poll status and glossary data
  useEffect(() => {
    fetchGlossary()
    fetchStatus()

    const interval = setInterval(() => {
      fetchGlossary()
      fetchStatus()
    }, 2500)

    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to the bottom of live logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [status.logs])

  // Get currently selected term details
  const activeTerm = terms.find((t) => t.term === selectedTermName) || null

  // Categories list
  const categories = ["All", ...new Set(terms.map((t) => t.category))]

  // Filtered terms based on category & search term
  const filteredTerms = terms.filter((t) => {
    const matchesCategory = selectedCategory === "All" || t.category === selectedCategory
    const matchesSearch = t.term.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Trigger generation for active term
  const generateSelectedTerm = async () => {
    if (!selectedTermName) return
    try {
      await fetch("http://localhost:8000/api/glossary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: selectedTermName }),
      })
      fetchStatus()
    } catch (err) {
      console.error("Error generating selected term:", err)
    }
  }

  // Trigger bulk generation
  const generateAllTerms = async () => {
    try {
      await fetch("http://localhost:8000/api/glossary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_terms: 50 }),
      })
      fetchStatus()
    } catch (err) {
      console.error("Error generating all terms:", err)
    }
  }

  // Get score style classes or colors
  const getScoreColor = (score) => {
    if (!score) return "#64748b"
    if (score >= 95) return "#10b981"
    if (score >= 85) return "#3b82f6"
    if (score >= 70) return "#f59e0b"
    return "#ef4444"
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      backgroundColor: "#060913",
      backgroundImage: "radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 40%)",
      color: "var(--text-primary)",
      overflow: "hidden"
    }}>
      
      {/* HEADER SECTION */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        background: "rgba(10, 15, 30, 0.7)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
            boxShadow: "0 0 15px rgba(139, 92, 246, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "18px"
          }}>Ω</div>
          <div>
            <h1 style={{ fontSize: "19px", fontWeight: "700", letterSpacing: "-0.02em" }}>
              Adversarial Agent Glossary System
            </h1>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Multi-Agent Orchestrated & Adversarially Critiqued Glossary Pipeline
            </p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {status.is_generating ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--accent-amber)"
            }}>
              <span className="dot" style={{
                width: "8px",
                height: "8px",
                backgroundColor: "var(--accent-amber)",
                borderRadius: "50%",
                animation: "pulse-glow-generating 1.5s infinite"
              }}></span>
              Generating: <strong style={{ color: "white" }}>{status.current_term}</strong>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--accent-emerald)"
            }}>
              <span style={{ width: "8px", height: "8px", backgroundColor: "var(--accent-emerald)", borderRadius: "50%" }}></span>
              Pipeline Idle
            </div>
          )}

          <button
            onClick={generateAllTerms}
            disabled={status.is_generating}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: status.is_generating ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
              opacity: status.is_generating ? 0.5 : 1,
              transition: "transform 0.2s"
            }}
          >
            Start Bulk Generation (50 Terms)
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.08)", borderTopColor: "var(--accent-purple)", borderRadius: "50%", animation: "spin-slow 1.5s infinite linear", margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--text-secondary)" }}>Initializing glossary database...</p>
          </div>
        </div>
      ) : (
        /* MAIN BODY WRAPPER */
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          
          {/* COLUMN 1: TERM LIST SIDEBAR */}
          <aside style={{
            width: "320px",
            borderRight: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(10, 14, 23, 0.4)",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Filters */}
            <div style={{ padding: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
              <input
                type="text"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(0,0,0,0.2)",
                  color: "white",
                  fontSize: "13px",
                  outline: "none",
                  marginBottom: "12px"
                }}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(0,0,0,0.2)",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                  outline: "none"
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="scroll-y" style={{ flex: 1 }}>
              {filteredTerms.map((t) => {
                const isSelected = t.term === selectedTermName
                const isGenerating = status.is_generating && status.current_term === t.term
                return (
                  <div
                    key={t.term}
                    onClick={() => setSelectedTermName(t.term)}
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "rgba(139, 92, 246, 0.08)" : "transparent",
                      borderLeft: isSelected ? "4px solid var(--accent-purple)" : "4px solid transparent",
                      transition: "all 0.2s"
                    }}
                    className={isGenerating ? "anim-generating" : ""}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <h3 style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: isSelected ? "white" : "var(--text-secondary)",
                        lineHeight: "1.4"
                      }}>
                        {t.term}
                      </h3>
                      {t.score > 0 && (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          color: getScoreColor(t.score),
                          padding: "2px 6px",
                          backgroundColor: "rgba(0,0,0,0.25)",
                          borderRadius: "4px"
                        }}>
                          {t.score}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{t.category}</span>
                      <span style={{
                        color: t.status === "approved" ? "var(--accent-emerald)" : t.status === "generating" ? "var(--accent-amber)" : "var(--text-muted)"
                      }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>

          {/* COLUMN 2: ACTIVE ENTRY VIEWPORT */}
          <main style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "rgba(6, 9, 17, 0.2)"
          }}>
            {activeTerm ? (
              <>
                {/* Header info */}
                <div style={{
                  padding: "24px 32px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(10, 15, 30, 0.3)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-blue)", fontWeight: "700" }}>
                      {activeTerm.category}
                    </span>
                    <h2 style={{ fontSize: "24px", fontWeight: "700", color: "white", marginTop: "4px" }}>
                      {activeTerm.term}
                    </h2>
                  </div>

                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    {activeTerm.score > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Quality Score</p>
                        <p style={{ fontSize: "20px", fontWeight: "800", color: getScoreColor(activeTerm.score) }}>
                          {activeTerm.score} <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-muted)" }}>/100</span>
                        </p>
                      </div>
                    )}

                    <button
                      onClick={generateSelectedTerm}
                      disabled={status.is_generating}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "white",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: status.is_generating ? "not-allowed" : "pointer",
                        opacity: status.is_generating ? 0.5 : 1
                      }}
                    >
                      {activeTerm.status === "approved" ? "Regenerate Term" : "Generate Term"}
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{
                  display: "flex",
                  padding: "0 32px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(10, 15, 30, 0.15)"
                }}>
                  {["viewer", "history", "raw"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: "14px 20px",
                        background: "none",
                        border: "none",
                        color: activeTab === tab ? "white" : "var(--text-muted)",
                        fontWeight: "600",
                        fontSize: "13px",
                        borderBottom: activeTab === tab ? "2px solid var(--accent-purple)" : "2px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {tab === "viewer" ? "Glossary Entry" : tab === "history" ? "Revision History" : "Raw JSON Data"}
                    </button>
                  ))}
                </div>

                {/* Tab content viewer */}
                <div className="scroll-y" style={{ flex: 1, padding: "32px" }}>
                  {activeTab === "viewer" && (
                    <div className="markdown-body" style={{ maxWidth: "850px" }}>
                      {activeTerm.status === "pending" ? (
                        <div style={{ padding: "40px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "12px", background: "rgba(255,255,255,0.01)" }}>
                          <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>This glossary term has not been generated yet.</p>
                          <button
                            onClick={generateSelectedTerm}
                            disabled={status.is_generating}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "var(--accent-purple)",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontWeight: "600",
                              fontSize: "13px",
                              cursor: status.is_generating ? "not-allowed" : "pointer"
                            }}
                          >
                            Generate Now
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: "24px" }}>
                            <h2>Definition</h2>
                            <p>{activeTerm.definition || "Generating..."}</p>
                          </div>

                          <div style={{ marginBottom: "24px" }}>
                            <h2>Architecture & Mechanics</h2>
                            <p style={{ whiteSpace: "pre-wrap" }}>{activeTerm.architecture || "Generating..."}</p>
                          </div>

                          <div style={{ marginBottom: "24px" }}>
                            <h2>Concrete Examples</h2>
                            <p style={{ whiteSpace: "pre-wrap" }}>{activeTerm.examples || "Generating..."}</p>
                          </div>

                          <div style={{ marginBottom: "24px" }}>
                            <h2>Advantages</h2>
                            <p style={{ whiteSpace: "pre-wrap" }}>{activeTerm.advantages || "Generating..."}</p>
                          </div>

                          <div style={{ marginBottom: "24px" }}>
                            <h2>Limitations</h2>
                            <p style={{ whiteSpace: "pre-wrap" }}>{activeTerm.limitations || "Generating..."}</p>
                          </div>

                          <div style={{ marginBottom: "24px" }}>
                            <h2>Related Concepts</h2>
                            <p style={{ whiteSpace: "pre-wrap" }}>{activeTerm.related_concepts || "Generating..."}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === "history" && (
                    <div style={{ maxWidth: "850px" }}>
                      {!activeTerm.history || activeTerm.history.length === 0 ? (
                        <p style={{ color: "var(--text-muted)" }}>No iteration history available for this term.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                          {activeTerm.history.map((it) => (
                            <div key={it.iteration} className="glass-panel" style={{ padding: "20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px", marginBottom: "16px" }}>
                                <h3 style={{ fontSize: "14px", fontWeight: "700" }}>Iteration {it.iteration}</h3>
                                <span style={{ color: getScoreColor(it.score), fontWeight: "700", fontSize: "14px" }}>Score: {it.score}/100</span>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div>
                                  <h4 style={{ fontSize: "12px", color: "var(--accent-purple)", textTransform: "uppercase", marginBottom: "8px" }}>Adversarial Critiques</h4>
                                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                                    {Object.entries(it.evaluation.critique || {}).map(([dim, text]) => (
                                      <p key={dim} style={{ marginBottom: "6px" }}>
                                        <strong style={{ textTransform: "capitalize" }}>{dim}: </strong>
                                        <span style={{ color: text === "Pass" ? "var(--accent-emerald)" : "var(--text-secondary)" }}>{text}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 style={{ fontSize: "12px", color: "var(--accent-blue)", textTransform: "uppercase", marginBottom: "8px" }}>Suggestions for Improvement</h4>
                                  <ul style={{ paddingLeft: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
                                    {(it.evaluation.suggestions || []).map((s, idx) => (
                                      <li key={idx} style={{ marginBottom: "4px" }}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "raw" && (
                    <pre style={{
                      backgroundColor: "rgba(0,0,0,0.3)",
                      padding: "20px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.05)",
                      color: "#f8f8f2",
                      overflowX: "auto",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      maxWidth: "850px"
                    }}>
                      {JSON.stringify(activeTerm, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>Select a term from the list to view its details.</p>
              </div>
            )}
          </main>

          {/* COLUMN 3: LIVE ORCHESTRATOR LOGS */}
          <aside style={{
            width: "360px",
            borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(10, 14, 23, 0.55)",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", background: "rgba(10,15,30,0.2)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="dot" style={{ width: "8px", height: "8px", backgroundColor: "var(--accent-purple)", borderRadius: "50%", boxShadow: "0 0 10px var(--accent-purple)" }}></span>
                Live Orchestrator Logs
              </h3>
            </div>

            {/* Logs display screen */}
            <div className="scroll-y" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.15)", fontFamily: "var(--font-mono)" }}>
              {status.logs.length === 0 ? (
                <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px" }}>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No logs yet. Generate a term to view the live agent collaboration.</p>
                </div>
              ) : (
                status.logs.map((log, idx) => {
                  const isWorker = log.type === "worker_draft"
                  const isEvaluator = log.type === "evaluator_critique"
                  return (
                    <div key={idx} style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: isWorker ? "rgba(139, 92, 246, 0.04)" : isEvaluator ? "rgba(59, 130, 246, 0.04)" : "rgba(255,255,255,0.02)",
                      borderLeft: `3px solid ${isWorker ? "var(--accent-purple)" : isEvaluator ? "var(--accent-blue)" : "var(--text-muted)"}`,
                      fontSize: "11px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "9px", color: "var(--text-muted)" }}>
                        <span style={{ fontWeight: "700", color: isWorker ? "var(--accent-purple)" : isEvaluator ? "var(--accent-blue)" : "var(--text-secondary)" }}>
                          {isWorker ? "WORKER AGENT" : isEvaluator ? "EVALUATOR AGENT" : "SYSTEM"}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p style={{ color: "white", lineHeight: "1.4" }}>{log.message}</p>
                      {log.details && log.details.score && (
                        <div style={{ marginTop: "6px", padding: "4px 8px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", color: "var(--text-secondary)", fontSize: "10px" }}>
                          Score: <strong style={{ color: getScoreColor(log.details.score) }}>{log.details.score}</strong>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </aside>

        </div>
      )}
    </div>
  )
}