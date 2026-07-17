"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Compass, 
  Map, 
  Sun, 
  Moon, 
  Send, 
  RotateCcw, 
  Sparkles, 
  Trash2, 
  Plus, 
  Bookmark, 
  Calendar,
  AlertCircle
} from "lucide-react";
import ItineraryCard from "@/components/ItineraryCard";
import ErrorFallback from "@/components/ErrorFallback";

// Interface definitions matching the backend API
interface Stop {
  id: string;
  time: string;
  activity: string;
  description: string;
  cost: string;
  locationName: string;
  category: "Food" | "Sightseeing" | "Transport" | "Shopping" | "Entertainment" | "Lodging" | "Other";
}

interface DayPlan {
  day: number;
  title: string;
  stops: Stop[];
}

interface TripItinerary {
  tripTitle: string;
  location: string;
  durationDays: number;
  summary: string;
  itinerary: DayPlan[];
}

interface SavedSession {
  id: string;
  name: string;
  date: string;
  itinerary: TripItinerary;
}

export default function Home() {
  // Main app states
  const [prompt, setPrompt] = useState("");
  const [itinerary, setItinerary] = useState<TripItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Refinement states
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Storage states
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Stale request handling
  const activeRequestId = useRef<number>(0);

  // Load theme and sessions from localStorage on mount
  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem("trip-planner-theme") as "light" | "dark";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const activeTheme = savedTheme || systemTheme;
    setTheme(activeTheme);
    if (activeTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Sessions initialization
    const savedSessions = localStorage.getItem("trip-planner-sessions");
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions));
      } catch (err) {
        console.error("Failed to parse saved sessions from localStorage", err);
      }
    }
  }, []);

  // Theme toggle helper
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("trip-planner-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Helper to save all sessions to local storage
  const saveSessionsToLocalStorage = (updatedSessions: SavedSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem("trip-planner-sessions", JSON.stringify(updatedSessions));
  };

  // Create a new trip itinerary
  const handleGenerateItinerary = async (customPrompt?: string) => {
    const queryPrompt = customPrompt !== undefined ? customPrompt : prompt;
    if (!queryPrompt || queryPrompt.trim() === "") return;

    setIsLoading(true);
    setError(null);
    setItinerary(null);
    
    // Track the active request to avoid stale responses overwriting newer requests
    const requestId = ++activeRequestId.current;

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: queryPrompt }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to generate itinerary. HTTP status ${response.status}`);
      }

      const data = await response.json();

      // Guard: If this request is not the latest, ignore it
      if (requestId !== activeRequestId.current) return;

      setItinerary(data);

      // Automatically save as a new session
      const newSession: SavedSession = {
        id: `session-${Date.now()}`,
        name: data.tripTitle || `Trip to ${data.location}`,
        date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
        itinerary: data,
      };

      const updatedSessions = [newSession, ...sessions];
      saveSessionsToLocalStorage(updatedSessions);
      setActiveSessionId(newSession.id);
      setPrompt(""); // Clear input on success
    } catch (err: any) {
      if (requestId !== activeRequestId.current) return;
      setError(err.message || "Something went wrong. Please check your setup and try again.");
    } finally {
      if (requestId === activeRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  // Refine existing itinerary
  const handleRefineItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refinementPrompt || refinementPrompt.trim() === "" || !itinerary) return;

    setIsRefining(true);
    setError(null);

    const requestId = ++activeRequestId.current;

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: refinementPrompt,
          currentItinerary: itinerary,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to refine itinerary. HTTP status ${response.status}`);
      }

      const data = await response.json();

      if (requestId !== activeRequestId.current) return;

      setItinerary(data);

      // Update the active session
      if (activeSessionId) {
        const updatedSessions = sessions.map(s => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              name: data.tripTitle || s.name,
              itinerary: data,
            };
          }
          return s;
        });
        saveSessionsToLocalStorage(updatedSessions);
      }
      setRefinementPrompt("");
    } catch (err: any) {
      if (requestId !== activeRequestId.current) return;
      setError(err.message || "Failed to modify itinerary. Please try again.");
    } finally {
      if (requestId === activeRequestId.current) {
        setIsRefining(false);
      }
    }
  };

  // Handle updates from ItineraryCard (stop deletion, stop reordering, stop editing)
  const handleUpdateItinerary = (updatedItinerary: TripItinerary) => {
    setItinerary(updatedItinerary);

    if (activeSessionId) {
      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            name: updatedItinerary.tripTitle || s.name,
            itinerary: updatedItinerary,
          };
        }
        return s;
      });
      saveSessionsToLocalStorage(updatedSessions);
    }
  };

  // Select a saved session from list
  const handleSelectSession = (session: SavedSession) => {
    setItinerary(session.itinerary);
    setActiveSessionId(session.id);
    setError(null);
  };

  // Delete a saved session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the deleted item
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    saveSessionsToLocalStorage(updatedSessions);

    if (activeSessionId === sessionId) {
      setItinerary(null);
      setActiveSessionId(null);
    }
  };

  // Quick prompt suggestions
  const SUGGESTIONS = [
    { title: "Tokyo Gourmet Tour", text: "3-day food tour in Tokyo for sushi, ramen, and street foods. Stay in Shinjuku." },
    { title: "Romance in Paris", text: "2-day romantic weekend in Paris, visiting the Eiffel Tower, Louvre, and cafes." },
    { title: "London Family Adventure", text: "4-day historical London sights for a family with teenagers, on a budget." },
  ];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <Compass size={32} className="brand-icon" />
          <h1 className="brand-title">Wanderlust AI</h1>
        </div>
        <div className="header-controls">
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="planner-grid">
        {/* Left Sidebar */}
        <aside className="sidebar-panel">
          {/* Main Trip Generation Panel */}
          <div className="glass-panel">
            <h2 className="section-title">
              <Sparkles size={16} className="brand-icon" />
              <span>Plan a New Trip</span>
            </h2>
            <textarea
              className="prompt-textarea"
              placeholder="Describe your trip details (e.g. 'A 3-day weekend trip to Tokyo for a family of 3 with a focus on street food and gardens...')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading || isRefining}
            />
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "12px" }}
              onClick={() => handleGenerateItinerary()}
              disabled={isLoading || isRefining || !prompt.trim()}
            >
              <Send size={16} />
              <span>Generate Itinerary</span>
            </button>
            
            {/* Quick Suggestions */}
            {!itinerary && !isLoading && !error && (
              <div style={{ marginTop: "20px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "hsl(var(--text-secondary))", marginBottom: "8px" }}>
                  Try These Suggestions:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      className="btn btn-outline btn-sm"
                      style={{ justifyContent: "flex-start", textAlign: "left", fontSize: "12px", width: "100%" }}
                      onClick={() => {
                        setPrompt(s.text);
                        handleGenerateItinerary(s.text);
                      }}
                    >
                      <Map size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Saved Sessions Panel */}
          <div className="glass-panel">
            <h2 className="section-title">
              <Bookmark size={16} className="brand-icon" />
              <span>My Saved Trips</span>
            </h2>
            {sessions.length === 0 ? (
              <p style={{ fontSize: "13px", color: "hsl(var(--text-secondary))", textAlign: "center", padding: "12px 0" }}>
                No planned trips saved yet.
              </p>
            ) : (
              <div className="sessions-list">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`session-item ${activeSessionId === s.id ? "active" : ""}`}
                    onClick={() => handleSelectSession(s)}
                  >
                    <div className="session-info">
                      <span className="session-name">{s.name}</span>
                      <span className="session-meta">
                        <Calendar size={10} style={{ marginRight: "4px", display: "inline-block", verticalAlign: "middle" }} />
                        {s.date}
                      </span>
                    </div>
                    <button
                      className="session-delete-btn"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete saved trip"
                      aria-label={`Delete trip ${s.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="main-content-panel">
          {/* 1. Loading State */}
          {isLoading && (
            <div className="glass-panel loading-wrapper">
              <div className="loading-spinner"></div>
              <p className="loading-text">Crafting Your Dream Trip...</p>
              <p className="loading-subtext">
                Analyzing destination hotspots, building optimal walking routes, and formatting structured schedule data.
              </p>
            </div>
          )}

          {/* 2. Error State */}
          {error && !isLoading && (
            <div className="glass-panel" style={{ padding: "0" }}>
              <ErrorFallback 
                message={error} 
                onRetry={() => {
                  if (itinerary) {
                    // It was a refinement request that failed, retry refinement
                    const fakeFormEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleRefineItinerary(fakeFormEvent);
                  } else {
                    // Regular generation failed
                    handleGenerateItinerary();
                  }
                }} 
              />
            </div>
          )}

          {/* 3. Empty State (Initial Greeting) */}
          {!itinerary && !isLoading && !error && (
            <div className="glass-panel empty-state-card">
              <Compass size={64} className="empty-state-illustration" />
              <h2 className="empty-state-title">Where to next?</h2>
              <p className="empty-state-subtitle">
                Enter details about your dream getaway on the left panel, and watch the AI curate a comprehensive day-by-day structured itinerary.
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "hsl(var(--text-secondary))" }}>
                  <Sparkles size={14} className="brand-icon" />
                  <span>Powered by Gemini API</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "hsl(var(--text-secondary))" }}>
                  <Plus size={14} className="brand-icon" />
                  <span>Stateful Custom Stops</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Active Itinerary State */}
          {itinerary && !isLoading && (
            <div className="glass-panel" style={{ position: "relative" }}>
              {isRefining && (
                <div 
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "hsl(var(--bg-glass))",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-md)",
                    zIndex: 10,
                    gap: "16px"
                  }}
                >
                  <div className="loading-spinner" style={{ width: "36px", height: "36px" }}></div>
                  <p style={{ fontWeight: 600, fontSize: "14px" }}>Updating Itinerary...</p>
                </div>
              )}

              <ItineraryCard 
                itinerary={itinerary} 
                onUpdateItinerary={handleUpdateItinerary} 
              />

              {/* Refinement Chat Input Panel */}
              <div className="refinement-container">
                <h4 style={{ fontFamily: "var(--font-title)", fontSize: "14px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={14} className="brand-icon" />
                  <span>Refine or adjust this itinerary</span>
                </h4>
                <p style={{ fontSize: "12px", color: "hsl(var(--text-secondary))", marginBottom: "12px" }}>
                  Type adjustments (e.g. *"make Day 2 budget-friendly"*, *"remove check-in stop"*, or *"add a pizza restaurant in the afternoon"*).
                </p>
                <form onSubmit={handleRefineItinerary} className="refinement-input-bar">
                  <input
                    type="text"
                    className="refinement-input"
                    placeholder="Ask AI to modify current trip details..."
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    disabled={isRefining || isLoading}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-icon"
                    disabled={isRefining || isLoading || !refinementPrompt.trim()}
                    title="Send adjustment"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <div>Wanderlust AI Trip Planner • Frontend Assignment</div>
        <div className="footer-links">
          <a href="https://nextjs.org" className="footer-link" target="_blank" rel="noreferrer">Built with Next.js</a>
          <span>•</span>
          <a href="https://aistudio.google.com" className="footer-link" target="_blank" rel="noreferrer">Google Gemini</a>
        </div>
      </footer>
    </div>
  );
}
