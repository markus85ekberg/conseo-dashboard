"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("Fel e-post eller lösenord")
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#1a1d2e", borderRadius: 12, padding: "40px 48px",
        width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
      }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Conseo Dashboard
        </h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>
          Logga in för att fortsätta
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#aaa", fontSize: 13, display: "block", marginBottom: 6 }}>
              E-postadress
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "#0f1117", border: "1px solid #333",
                color: "#fff", fontSize: 14, boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: "#aaa", fontSize: 13, display: "block", marginBottom: 6 }}>
              Lösenord
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                background: "#0f1117", border: "1px solid #333",
                color: "#fff", fontSize: 14, boxSizing: "border-box"
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#2d1b1b", border: "1px solid #ff4444",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: "#ff6b6b", fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px",
              background: loading ? "#333" : "#6366f1",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Loggar in..." : "Logga in"}
          </button>
        </form>
      </div>
    </div>
  )
}
