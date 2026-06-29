"use client"
import { useState } from "react"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const AREA_LABELS: Record<string, string> = {
  titel: "Titel", meta: "Meta description", rubriker: "Rubriker",
  strukturerad_data: "Strukturerad data", social: "Social (OG/Twitter)",
  bilder: "Bilder", övrigt: "Övrigt",
}

const SEVERITY_STYLE: Record<string, string> = {
  kritisk: "bg-red-500/10 border-red-500/30 text-red-400",
  varning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
}

const SEVERITY_DOT: Record<string, string> = {
  kritisk: "bg-red-500",
  varning: "bg-yellow-500",
  info: "bg-blue-500",
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444"
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" />
        <text x="36" y="41" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
    </div>
  )
}

function MetaRow({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" | "error" }) {
  const dot = status === "ok" ? "bg-green-500" : status === "warn" ? "bg-yellow-500" : status === "error" ? "bg-red-500" : "bg-gray-600"
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-800/50">
      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-200 break-all">{value || <span className="text-gray-600 italic">saknas</span>}</span>
    </div>
  )
}

export default function SeoAnalyzer({ orgId }: { orgId: string }) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  async function runAnalysis() {
    if (!url.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-seo-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ url: url.trim(), org_id: orgId }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e) {
      setError("Något gick fel: " + e)
    } finally {
      setLoading(false)
    }
  }

  const { seo, analysis } = result || {}
  const issues = analysis?.issues || []
  const critical = issues.filter((i: any) => i.severity === "kritisk")
  const warnings = issues.filter((i: any) => i.severity === "varning")
  const info = issues.filter((i: any) => i.severity === "info")

  return (
    <div className="space-y-6">
      {/* URL-input */}
      <div className="bg-gray-900 rounded-xl p-6">
        <h2 className="text-base font-semibold mb-4 text-gray-200">SEO-analys av sida</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="https://southsidebbq.se/produkt/pellets-premium"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runAnalysis()}
          />
          <button
            onClick={runAnalysis}
            disabled={loading || !url.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {loading ? "Analyserar..." : "Analysera"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        <p className="text-xs text-gray-600 mt-2">Analysen tar 5–15 sekunder. Fungerar på alla offentliga URL:er.</p>
      </div>

      {loading && (
        <div className="bg-gray-900 rounded-xl p-8 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Hämtar sidan och analyserar med Claude AI...</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* Sammanfattning + betyg */}
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-200">Analysresultat</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{seo?.url}</p>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${analysis?.overall_score >= 80 ? "text-green-400" : analysis?.overall_score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {analysis?.overall_score ?? "–"}
                </div>
                <div className="text-xs text-gray-500">Totalt</div>
              </div>
            </div>

            {analysis?.summary && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-5 text-sm text-gray-300 leading-relaxed">
                {analysis.summary}
              </div>
            )}

            {/* Betygsringar per område */}
            {analysis?.scores && (
              <div className="flex flex-wrap gap-4 justify-around">
                {Object.entries(analysis.scores).map(([key, val]: any) => (
                  <ScoreRing key={key} score={val} label={
                    key === "title" ? "Titel" :
                    key === "meta_description" ? "Meta desc." :
                    key === "headings" ? "Rubriker" :
                    key === "structured_data" ? "Struct. data" :
                    key === "social_tags" ? "Social" :
                    key === "images" ? "Bilder" : key
                  } />
                ))}
              </div>
            )}
          </div>

          {/* Problem & rekommendationer */}
          {issues.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-4 text-gray-200">
                Åtgärder
                <span className="ml-3 text-xs font-normal text-gray-500">
                  {critical.length > 0 && <span className="text-red-400">{critical.length} kritiska </span>}
                  {warnings.length > 0 && <span className="text-yellow-400">{warnings.length} varningar </span>}
                  {info.length > 0 && <span className="text-blue-400">{info.length} info</span>}
                </span>
              </h2>
              <div className="space-y-3">
                {[...critical, ...warnings, ...info].map((issue: any, i: number) => (
                  <div key={i} className={`border rounded-lg p-4 ${SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.info}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[issue.severity] || "bg-blue-500"}`} />
                      <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                        {AREA_LABELS[issue.area] || issue.area}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{issue.issue}</p>
                    <p className="text-xs opacity-80">→ {issue.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Styrkor */}
          {analysis?.strengths?.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-base font-semibold mb-3 text-gray-200">Det som fungerar bra</h2>
              <ul className="space-y-1.5">
                {analysis.strengths.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rådata */}
          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-base font-semibold mb-4 text-gray-200">Tekniska detaljer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Grundläggande</p>
                <MetaRow label="Title" value={seo?.title} status={seo?.titleLength >= 50 && seo?.titleLength <= 60 ? "ok" : seo?.titleLength > 0 ? "warn" : "error"} />
                <MetaRow label="Titellängd" value={`${seo?.titleLength} tecken`} status={seo?.titleLength >= 50 && seo?.titleLength <= 60 ? "ok" : "warn"} />
                <MetaRow label="Meta description" value={seo?.metaDescription} status={seo?.metaDescriptionLength >= 140 && seo?.metaDescriptionLength <= 160 ? "ok" : seo?.metaDescriptionLength > 0 ? "warn" : "error"} />
                <MetaRow label="Meta längd" value={`${seo?.metaDescriptionLength} tecken`} status={seo?.metaDescriptionLength >= 140 && seo?.metaDescriptionLength <= 160 ? "ok" : "warn"} />
                <MetaRow label="Canonical" value={seo?.canonical} status={seo?.canonical ? "ok" : "warn"} />
                <MetaRow label="Robots" value={seo?.robotsMeta || "Ingen begränsning"} status="ok" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Open Graph & Social</p>
                <MetaRow label="og:title" value={seo?.og?.title} status={seo?.og?.title ? "ok" : "error"} />
                <MetaRow label="og:description" value={seo?.og?.description} status={seo?.og?.description ? "ok" : "error"} />
                <MetaRow label="og:image" value={seo?.og?.image ? "✓ Finns" : ""} status={seo?.og?.image ? "ok" : "warn"} />
                <MetaRow label="og:type" value={seo?.og?.type} status={seo?.og?.type ? "ok" : "warn"} />
                <MetaRow label="twitter:card" value={seo?.twitter?.card} status={seo?.twitter?.card ? "ok" : "warn"} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Rubriker</p>
                <MetaRow label="H1 (antal)" value={`${seo?.headings?.h1s?.length} st`} status={seo?.headings?.h1s?.length === 1 ? "ok" : seo?.headings?.h1s?.length === 0 ? "error" : "warn"} />
                {seo?.headings?.h1s?.map((h: string, i: number) => (
                  <MetaRow key={i} label={`H1 ${i + 1}`} value={h} />
                ))}
                <MetaRow label="H2 (antal)" value={`${seo?.headings?.h2s?.length} st`} status={seo?.headings?.h2s?.length > 0 ? "ok" : "warn"} />
                <MetaRow label="H3 (antal)" value={`${seo?.headings?.h3s?.length} st`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Strukturerad data & Övrigt</p>
                <MetaRow label="JSON-LD scheman" value={`${seo?.structuredData?.count} st`} status={seo?.structuredData?.count > 0 ? "ok" : "warn"} />
                <MetaRow label="Schema-typer" value={seo?.structuredData?.types?.join(", ") || "Inga"} status={seo?.structuredData?.types?.length > 0 ? "ok" : "warn"} />
                <MetaRow label="Bilder totalt" value={`${seo?.images?.total} st`} />
                <MetaRow label="Bilder utan alt" value={`${seo?.images?.withoutAlt} st`} status={seo?.images?.withoutAlt === 0 ? "ok" : "warn"} />
                <MetaRow label="Interna länkar" value={`${seo?.internalLinks} st`} status={seo?.internalLinks > 3 ? "ok" : "warn"} />
                <MetaRow label="Uppskattad ordmängd" value={`~${seo?.wordCount} ord`} status={seo?.wordCount > 300 ? "ok" : "warn"} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
