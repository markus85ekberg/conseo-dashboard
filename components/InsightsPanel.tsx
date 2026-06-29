"use client"
import { useEffect, useState } from "react"

interface Insight {
  type: "seo" | "ads" | "meta" | "ga4"
  priority: "high" | "medium" | "low"
  title: string
  description: string
  recommendation: string
  metric_value?: number
  metric_label?: string
}

const TYPE_LABELS: Record<string, string> = {
  seo: "SEO",
  ads: "Google Ads",
  meta: "Meta Ads",
  ga4: "Trafik",
}

const TYPE_COLORS: Record<string, string> = {
  seo: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ads: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  meta: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  ga4: "bg-green-500/20 text-green-300 border-green-500/30",
}

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-400",
  low: "bg-green-400",
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "Hög",
  medium: "Medium",
  low: "Låg",
}

export default function InsightsPanel({ orgId, connectedSources = [] }: { orgId: string; connectedSources?: string[] }) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!orgId) return
    async function fetchInsights() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-insights`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ org_id: orgId }),
          }
        )
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setInsights(data.insights || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [orgId])

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Insikter & Rekommendationer</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-2">Insikter & Rekommendationer</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-2">Insikter & Rekommendationer</h2>
        <p className="text-gray-400 text-sm">Inga insikter just nu — bra jobbat! 🎉</p>
      </div>
    )
  }

  const highCount = insights.filter(i => i.priority === "high").length
  const mediumCount = insights.filter(i => i.priority === "medium").length

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-white">Insikter & Rekommendationer</h2>
        <div className="flex gap-2 text-xs">
          {highCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              {highCount} hög prioritet
            </span>
          )}
          {mediumCount > 0 && (
            <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
              {mediumCount} medium
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="bg-gray-800/60 border border-gray-700/50 rounded-lg overflow-hidden cursor-pointer hover:border-gray-600 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="flex items-start gap-3 p-4">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[insight.priority]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${TYPE_COLORS[insight.type]}`}>
                    {TYPE_LABELS[insight.type]}
                  </span>
                  <span className="text-xs text-gray-500">{PRIORITY_LABEL[insight.priority]}</span>
                  {insight.metric_value !== undefined && (
                    <span className="text-xs text-gray-400 ml-auto font-mono">
                      {typeof insight.metric_value === "number" && insight.metric_value % 1 !== 0
                        ? insight.metric_value.toFixed(1)
                        : insight.metric_value} {insight.metric_label}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-white">{insight.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{insight.description}</p>
              </div>
              <span className="text-gray-600 text-xs mt-1">{expanded === i ? "▲" : "▼"}</span>
            </div>

            {expanded === i && (
              <div className="px-4 pb-4 pt-0 border-t border-gray-700/50">
                <p className="text-xs text-gray-300 mt-3">{insight.description}</p>
                <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-300 mb-1">💡 Rekommendation</p>
                  <p className="text-xs text-gray-300">{insight.recommendation}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
