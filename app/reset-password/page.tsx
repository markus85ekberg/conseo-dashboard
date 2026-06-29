"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase skickar token i URL-hashen — hämta sessionen därifrån
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else {
        // Försök hämta från hash
        const hash = window.location.hash
        if (hash.includes("access_token")) setReady(true)
        else router.push("/login")
      }
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Lösenorden matchar inte"); return }
    if (password.length < 8) { setError("Lösenordet måste vara minst 8 tecken"); return }

    setLoading(true)
    setError("")

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#666" }}>Laddar...</p>
    </div>
  )

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
          Sätt nytt lösenord
        </h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>
          Välj ett nytt lösenord för ditt konto
        </p>

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#aaa", fontSize: 13, display: "block", marginBottom: 6 }}>
              Nytt lösenord
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

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: "#aaa", fontSize: 13, display: "block", marginBottom: 6 }}>
              Bekräfta lösenord
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
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
            {loading ? "Sparar..." : "Spara nytt lösenord"}
          </button>
        </form>
      </div>
    </div>
  )
}
