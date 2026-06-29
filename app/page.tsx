"use client"
import InsightsPanel from "@/components/InsightsPanel"
import SeoAnalyzer from "@/components/SeoAnalyzer"
import AnalysTab from "@/components/AnalysTab"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area
} from "recharts"

interface Org { id: string; name: string }

const DEFAULT_ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!
const TABS = ["Översikt", "Analys", "WooCommerce", "GA4", "Google Ads", "Meta Ads", "SEO"] as const
type Tab = typeof TABS[number]

export default function Dashboard() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState(DEFAULT_ORG_ID)
  const [orgName, setOrgName] = useState("")
  const [connectedSources, setConnectedSources] = useState<string[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("Översikt")

  useEffect(() => {
    async function loadOrgs() {
      const { data } = await supabase.from("organizations").select("id, name").order("created_at")
      if (data?.length) {
        setOrgs(data)
        const saved = localStorage.getItem("selected_org_id")
        const active = data.find(o => o.id === saved) || data.find(o => o.id === DEFAULT_ORG_ID) || data[0]
        setOrgId(active.id); setOrgName(active.name)
      }
    }
    loadOrgs()
  }, [])

  useEffect(() => { if (orgId) fetchAll(orgId) }, [orgId])

  async function fetchSource(id: string, source: string, since: string): Promise<any[]> {
    const all: any[] = []
    let from = 0
    while (true) {
      const { data } = await supabase
        .from("metrics").select("*")
        .eq("org_id", id).eq("source", source).gte("date", since)
        .range(from, from + 999)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return all
  }

  async function fetchAll(id: string) {
    setLoading(true)
    const { data: conns } = await supabase.from("data_source_connections").select("source").eq("org_id", id)
    const sources = (conns || []).map((c: any) => c.source)
    setConnectedSources(sources)

    const since = new Date(Date.now() - 90 * 864e5).toISOString().split("T")[0]

    const results = await Promise.all(
      ["ga4", "google_ads", "meta_ads", "wincher", "woocommerce"].map(source =>
        sources.includes(source) ? fetchSource(id, source, since) : Promise.resolve([])
      )
    )

    setMetrics(results.flat())
    setLoading(false)
  }

  function handleOrgChange(id: string) {
    const org = orgs.find(o => o.id === id)
    setOrgId(id); setOrgName(org?.name || "")
    localStorage.setItem("selected_org_id", id)
  }

  const has = (s: string) => connectedSources.includes(s)

  // ── Hjälpfunktioner ──────────────────────────────────────────────────────
  function sum(source: string, metric: string, dimName = "", dimVal = "") {
    return metrics.filter(r => r.source === source && r.metric_name === metric
      && (!dimName || r.dimension_name === dimName)
      && (!dimVal || r.dimension_value === dimVal)
    ).reduce((s, r) => s + (r.value || 0), 0)
  }

  function byDate(source: string, metric: string, dimName = "") {
    const map: Record<string, number> = {}
    metrics.filter(r => r.source === source && r.metric_name === metric && (!dimName || r.dimension_name === dimName))
      .forEach(r => { map[r.date] = (map[r.date] || 0) + r.value })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date: date.slice(5), value: Math.round(value * 100) / 100 }))
  }

  function topN(source: string, metric: string, dimKey: string, n = 10) {
    const map: Record<string, number> = {}
    metrics.filter(r => r.source === source && r.metric_name === metric && r.dimension_name === dimKey)
      .forEach(r => { map[r.dimension_value] = (map[r.dimension_value] || 0) + r.value })
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, n)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
  }

  function byDateMulti(source: string, metrics_list: { metric: string; key: string; dimName?: string }[]) {
    const map: Record<string, any> = {}
    for (const { metric, key, dimName } of metrics_list) {
      metrics.filter(r => r.source === source && r.metric_name === metric && (!dimName || r.dimension_name === dimName))
        .forEach(r => {
          if (!map[r.date]) map[r.date] = { date: r.date.slice(5) }
          map[r.date][key] = (map[r.date][key] || 0) + r.value
        })
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }

  // ── Nyckeltal ──────────────────────────────────────────────────────────
  const totalSessions = sum("ga4", "sessions")
  const totalRevenue = sum("ga4", "revenue", "total")
  const totalPurchases = sum("ga4", "purchases", "total")
  const convRate = totalSessions > 0 ? (totalPurchases / totalSessions * 100) : 0
  const totalAddToCart = sum("ga4", "add_to_cart", "total")
  const totalBeginCheckout = sum("ga4", "begin_checkout", "total")
  const checkoutAbandonment = totalBeginCheckout > 0 ? ((totalBeginCheckout - totalPurchases) / totalBeginCheckout * 100) : 0

  const gAdsClicks = sum("google_ads", "clicks")
  const gAdsCost = sum("google_ads", "cost")
  const gAdsConversions = sum("google_ads", "conversions")
  const gAdsConvValue = sum("google_ads", "conversion_value")
  const gAdsRoas = gAdsCost > 0 ? gAdsConvValue / gAdsCost : 0
  const gAdsImpressions = sum("google_ads", "impressions")
  const gAdsCtr = gAdsImpressions > 0 ? (gAdsClicks / gAdsImpressions * 100) : 0

  const metaSpend = sum("meta_ads", "spend")
  const metaConvValue = sum("meta_ads", "conversion_value")
  const metaRoas = metaSpend > 0 ? metaConvValue / metaSpend : 0
  const metaReach = sum("meta_ads", "reach")
  const metaImpressions = sum("meta_ads", "impressions")
  const metaPurchases = sum("meta_ads", "conversions")

  // ── WooCommerce ──────────────────────────────────────────────────────────
  const wooOrders = sum("woocommerce", "orders", "total")
  const wooRevenue = sum("woocommerce", "revenue", "total")
  const wooAov = wooOrders > 0 ? wooRevenue / wooOrders : 0
  const wooItemsSold = sum("woocommerce", "items_sold", "total")

  const wincherTop = metrics.filter(r => r.source === "wincher" && r.metric_name === "ranking_position")
    .sort((a, b) => a.value - b.value).slice(0, 10)

  // ── Kampanjstabeller ──────────────────────────────────────────────────────
  function campaignTable(source: string) {
    const camps: Record<string, any> = {}
    const metricKeys = source === "google_ads"
      ? ["clicks", "impressions", "cost", "conversions", "conversion_value", "ctr", "avg_cpc", "roas", "cost_per_conversion"]
      : ["impressions", "clicks", "spend", "reach", "conversions", "conversion_value", "ctr", "cpm", "cpc", "roas", "cost_per_conversion"]
    metrics.filter(r => r.source === source && metricKeys.includes(r.metric_name) && r.dimension_value === "")
      .forEach(r => {
        if (!camps[r.dimension_name]) camps[r.dimension_name] = { name: r.dimension_name }
        camps[r.dimension_name][r.metric_name] = (camps[r.dimension_name][r.metric_name] || 0) + r.value
      })
    return Object.values(camps)
  }

  const fmt = {
    num: (v: number) => v?.toLocaleString("sv", { maximumFractionDigits: 0 }) || "0",
    dec: (v: number, d = 2) => v?.toLocaleString("sv", { maximumFractionDigits: d }) || "0",
    pct: (v: number) => (v * 100)?.toFixed(1) + "%" || "0%",
    kr: (v: number) => v?.toLocaleString("sv", { maximumFractionDigits: 0 }) + " kr" || "0 kr",
  }

  const CHART_STYLE = { backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">{orgName || "Dashboard"}</h1>
            <p className="text-gray-400 text-sm mt-0.5">Senaste 30 dagarna</p>
          </div>
          <div className="flex items-center gap-3">
            {orgs.length > 1 && (
              <select value={orgId} onChange={e => handleOrgChange(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500">
                {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            )}
            <a href="/admin" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
              Hantera kunder
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-8">
        <div className="flex gap-1 max-w-screen-xl mx-auto">
          {TABS.filter(t => {
            if (t === "Analys") return true
            if (t === "WooCommerce") return has("woocommerce")
            if (t === "GA4") return has("ga4")
            if (t === "Google Ads") return has("google_ads")
            if (t === "Meta Ads") return has("meta_ads")
            if (t === "SEO") return has("wincher")
            return true
          }).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">Laddar...</div>
      ) : (
        <div className="p-8 max-w-screen-xl mx-auto">

          {/* ── ÖVERSIKT ────────────────────────────────────────────────── */}
          {activeTab === "Översikt" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {has("ga4") && <>
                  <KpiCard label="Sessioner" value={fmt.num(totalSessions)} sub="GA4" color="blue" />
                  <KpiCard label="Omsättning" value={fmt.kr(totalRevenue)} sub={`${fmt.num(totalPurchases)} köp`} color="green" />
                  <KpiCard label="Konverteringsgrad" value={convRate.toFixed(2) + "%"} sub="Sessioner → köp" color="teal" />
                  <KpiCard label="Avhopp i kassan" value={checkoutAbandonment.toFixed(0) + "%"} sub={`${fmt.num(totalBeginCheckout)} påbörjade`} color={checkoutAbandonment > 60 ? "red" : "yellow"} />
                </>}
                {has("google_ads") && <>
                  <KpiCard label="Google Ads ROAS" value={gAdsRoas.toFixed(2) + "x"} sub={`${fmt.kr(gAdsCost)} spenderat`} color="yellow" />
                  <KpiCard label="Google Konv." value={fmt.num(gAdsConversions)} sub={`CTR ${gAdsCtr.toFixed(2)}%`} color="green" />
                </>}
                {has("meta_ads") && <>
                  <KpiCard label="Meta ROAS" value={metaRoas.toFixed(2) + "x"} sub={`${fmt.kr(metaSpend)} spenderat`} color="purple" />
                  <KpiCard label="Meta Räckvidd" value={fmt.num(metaReach)} sub={`${fmt.num(metaPurchases)} köp`} color="indigo" />
                </>}
              </div>

              {/* Multikanalsgraf */}
              {has("ga4") && (
                <Card title="Trafik & Intäkter — daglig trend">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={byDateMulti("ga4", [
                      { metric: "sessions", key: "Sessioner" },
                      { metric: "revenue", key: "Omsättning", dimName: "total" },
                    ])}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="Sessioner" fill="#3b82f620" stroke="#3b82f6" dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="Omsättning" stroke="#22c55e" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* WooCommerce jämförelse i Översikt */}
              {has("woocommerce") && (
                <Card title="Faktisk försäljning (WooCommerce) vs GA4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">WooCommerce orders</p>
                      <p className="text-lg font-bold text-white">{fmt.num(wooOrders)}</p>
                      {has("ga4") && <p className="text-xs text-gray-500 mt-1">GA4 köp: {fmt.num(totalPurchases)}</p>}
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">WooCommerce omsättning</p>
                      <p className="text-lg font-bold text-white">{fmt.kr(wooRevenue)}</p>
                      {has("ga4") && <p className="text-xs text-gray-500 mt-1">GA4: {fmt.kr(totalRevenue)}</p>}
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Snittordervärde</p>
                      <p className="text-lg font-bold text-white">{fmt.kr(wooAov)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Artiklar sålda</p>
                      <p className="text-lg font-bold text-white">{fmt.num(wooItemsSold)}</p>
                    </div>
                  </div>
                  {has("ga4") && wooOrders > 0 && totalPurchases > 0 && (
                    <p className={`text-xs mt-2 ${Math.abs(wooOrders - totalPurchases) / wooOrders > 0.1 ? "text-yellow-400" : "text-green-400"}`}>
                      {Math.abs(wooOrders - totalPurchases) / wooOrders > 0.1
                        ? `⚠ Avvikelse ${((wooOrders - totalPurchases) / wooOrders * 100).toFixed(0)}% mellan WooCommerce och GA4 — kontrollera spårningen`
                        : `✓ WooCommerce och GA4 stämmer väl överens (${((wooOrders - totalPurchases) / wooOrders * 100).toFixed(1)}% avvikelse)`}
                    </p>
                  )}
                </Card>
              )}

              <InsightsPanel orgId={orgId} connectedSources={connectedSources} />
            </div>
          )}

          {/* ── ANALYS ───────────────────────────────────────────────────── */}
          {activeTab === "Analys" && (
            <AnalysTab orgId={orgId} />
          )}

          {/* ── WOOCOMMERCE ──────────────────────────────────────────────── */}
          {activeTab === "WooCommerce" && has("woocommerce") && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Orders" value={fmt.num(wooOrders)} sub="Completed + Processing" color="green" />
                <KpiCard label="Omsättning" value={fmt.kr(wooRevenue)} color="green" />
                <KpiCard label="Snittordervärde" value={fmt.kr(wooAov)} color="teal" />
                <KpiCard label="Artiklar sålda" value={fmt.num(wooItemsSold)} color="blue" />
                {has("ga4") && <>
                  <KpiCard label="GA4 köp" value={fmt.num(totalPurchases)} sub="Jämförelse" color={Math.abs(wooOrders - totalPurchases) / Math.max(wooOrders, 1) > 0.1 ? "red" : "green"} />
                  <KpiCard label="GA4 omsättning" value={fmt.kr(totalRevenue)} sub="Jämförelse" color={Math.abs(wooRevenue - totalRevenue) / Math.max(wooRevenue, 1) > 0.1 ? "red" : "green"} />
                  <KpiCard label="Avvikelse orders" value={wooOrders > 0 ? ((wooOrders - totalPurchases) / wooOrders * 100).toFixed(1) + "%" : "-"} sub="WooCommerce vs GA4" color={Math.abs(wooOrders - totalPurchases) / Math.max(wooOrders, 1) > 0.1 ? "red" : "green"} />
                  <KpiCard label="Avvikelse omsättning" value={wooRevenue > 0 ? ((wooRevenue - totalRevenue) / wooRevenue * 100).toFixed(1) + "%" : "-"} sub="WooCommerce vs GA4" color={Math.abs(wooRevenue - totalRevenue) / Math.max(wooRevenue, 1) > 0.1 ? "red" : "green"} />
                </>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Orders per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byDate("woocommerce", "orders", "total")}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Bar dataKey="value" fill="#22c55e" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Omsättning per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byDate("woocommerce", "revenue", "total")}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [fmt.kr(v), "Omsättning"]} />
                      <Bar dataKey="value" fill="#10b981" name="Omsättning" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Topp 20 produkter — omsättning">
                  <DataTable
                    headers={["Produkt", "Omsättning", "Antal"]}
                    rows={topN("woocommerce", "item_revenue", "product", 20).map(p => [
                      p.name,
                      fmt.kr(p.value),
                      fmt.num(metrics.filter(r => r.source === "woocommerce" && r.metric_name === "item_purchases" && r.dimension_value === p.name).reduce((s, r) => s + r.value, 0)),
                    ])}
                  />
                </Card>
                <Card title="Geografisk fördelning (betalande kunder)">
                  <DataTable
                    headers={["Land", "Orders", "Omsättning"]}
                    rows={topN("woocommerce", "orders", "country", 15).map(p => [
                      p.name,
                      fmt.num(p.value),
                      fmt.kr(metrics.filter(r => r.source === "woocommerce" && r.metric_name === "revenue" && r.dimension_name === "country" && r.dimension_value === p.name).reduce((s, r) => s + r.value, 0)),
                    ])}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ── GA4 ─────────────────────────────────────────────────────── */}
          {activeTab === "GA4" && has("ga4") && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Sessioner" value={fmt.num(totalSessions)} color="blue" />
                <KpiCard label="Omsättning" value={fmt.kr(totalRevenue)} sub={`${fmt.num(totalPurchases)} köp`} color="green" />
                <KpiCard label="Konv.grad" value={convRate.toFixed(2) + "%"} color="teal" />
                <KpiCard label="Avhopp kassa" value={checkoutAbandonment.toFixed(0) + "%"} sub={`${fmt.num(totalBeginCheckout - totalPurchases)} avhoppade`} color={checkoutAbandonment > 60 ? "red" : "yellow"} />
                <KpiCard label="Lägg i varukorg" value={fmt.num(totalAddToCart)} color="orange" />
                <KpiCard label="Påbörja köp" value={fmt.num(totalBeginCheckout)} color="orange" />
                <KpiCard label="E-postklick" value={fmt.num(sum("ga4", "event_count", "klick__mailadress"))} color="blue" />
                <KpiCard label="Telefonklick" value={fmt.num(sum("ga4", "event_count", "klick_telefonnummer"))} color="blue" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Sessioner per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={byDate("ga4", "sessions")}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" dot={false} name="Sessioner" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Omsättning per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byDate("ga4", "revenue", "total")}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [fmt.kr(v), "Omsättning"]} />
                      <Bar dataKey="value" fill="#22c55e" name="Omsättning" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Topp 10 sålda produkter */}
                <Card title="Topp 10 sålda produkter">
                  <DataTable
                    headers={["Produkt", "Sålda", "Intäkt"]}
                    rows={topN("ga4", "item_purchases", "product").map(p => [
                      p.name,
                      fmt.num(p.value),
                      fmt.kr(metrics.filter(r => r.source === "ga4" && r.metric_name === "item_revenue" && r.dimension_value === p.name).reduce((s, r) => s + r.value, 0))
                    ])}
                  />
                </Card>

                {/* Topp 10 produktsidor */}
                <Card title="Topp 10 produktsidor">
                  <DataTable
                    headers={["Sida", "Visningar"]}
                    rows={topN("ga4", "page_views", "product_page").map(p => [
                      <span className="font-mono text-xs truncate block max-w-[220px]">{p.name}</span>,
                      fmt.num(p.value)
                    ])}
                  />
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Topp kategorisidor */}
                <Card title="Topp 10 kategorisidor">
                  <DataTable
                    headers={["Sida", "Visningar", "Sessioner"]}
                    rows={topN("ga4", "page_views", "category_page").map(p => [
                      <span className="font-mono text-xs truncate block max-w-[180px]">{p.name}</span>,
                      fmt.num(p.value),
                      fmt.num(metrics.filter(r => r.source === "ga4" && r.metric_name === "sessions" && r.dimension_name === "category_page" && r.dimension_value === p.name).reduce((s, r) => s + r.value, 0))
                    ])}
                  />
                </Card>

                {/* Geografisk fördelning */}
                <Card title="Geografisk fördelning (köpare)">
                  <DataTable
                    headers={["Stad", "Köp", "Sessioner"]}
                    rows={topN("ga4", "purchases", "city").map(p => [
                      p.name,
                      fmt.num(p.value),
                      fmt.num(metrics.filter(r => r.source === "ga4" && r.metric_name === "sessions" && r.dimension_name === "city" && r.dimension_value === p.name).reduce((s, r) => s + r.value, 0))
                    ])}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ── GOOGLE ADS ───────────────────────────────────────────────── */}
          {activeTab === "Google Ads" && has("google_ads") && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Klick" value={fmt.num(gAdsClicks)} color="green" />
                <KpiCard label="Exponeringar" value={fmt.num(gAdsImpressions)} color="blue" />
                <KpiCard label="CTR" value={gAdsCtr.toFixed(2) + "%"} color={gAdsCtr < 2 ? "red" : "green"} />
                <KpiCard label="ROAS" value={gAdsRoas.toFixed(2) + "x"} sub={`${fmt.num(gAdsConversions)} konv.`} color={gAdsRoas < 2 ? "red" : "green"} />
                <KpiCard label="Total kostnad" value={fmt.kr(gAdsCost)} color="yellow" />
                <KpiCard label="Konv.värde" value={fmt.kr(gAdsConvValue)} color="green" />
                <KpiCard label="Kostnad/konv." value={fmt.kr(gAdsConversions > 0 ? gAdsCost / gAdsConversions : 0)} color="yellow" />
                <KpiCard label="Gen. CPC" value={fmt.kr(gAdsClicks > 0 ? gAdsCost / gAdsClicks : 0)} color="yellow" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Klick & Kostnad per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={byDateMulti("google_ads", [
                      { metric: "clicks", key: "Klick" },
                      { metric: "cost", key: "Kostnad" },
                    ])}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="Klick" fill="#22c55e" />
                      <Line yAxisId="right" type="monotone" dataKey="Kostnad" stroke="#eab308" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Konverteringar & ROAS per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={byDateMulti("google_ads", [
                      { metric: "conversions", key: "Konv." },
                      { metric: "roas", key: "ROAS" },
                    ])}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="Konv." fill="#3b82f6" />
                      <Line yAxisId="right" type="monotone" dataKey="ROAS" stroke="#a855f7" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card title="Kampanjprestanda">
                <DataTable
                  headers={["Kampanj", "Exp.", "Klick", "CTR", "Kostnad", "Konv.", "Konv.värde", "ROAS", "Kr/konv."]}
                  rows={campaignTable("google_ads").map((c: any) => [
                    c.name,
                    fmt.num(c.impressions),
                    fmt.num(c.clicks),
                    (c.ctr * 100 || 0).toFixed(2) + "%",
                    fmt.kr(c.cost),
                    fmt.num(c.conversions),
                    fmt.kr(c.conversion_value),
                    (c.roas || 0).toFixed(2) + "x",
                    fmt.kr(c.cost_per_conversion),
                  ])}
                />
              </Card>
            </div>
          )}

          {/* ── META ADS ─────────────────────────────────────────────────── */}
          {activeTab === "Meta Ads" && has("meta_ads") && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Räckvidd" value={fmt.num(metaReach)} color="indigo" />
                <KpiCard label="Exponeringar" value={fmt.num(metaImpressions)} color="blue" />
                <KpiCard label="ROAS" value={metaRoas.toFixed(2) + "x"} sub={`${fmt.num(metaPurchases)} köp`} color={metaRoas < 2 ? "red" : "green"} />
                <KpiCard label="Total spend" value={fmt.kr(metaSpend)} color="yellow" />
                <KpiCard label="Konv.värde" value={fmt.kr(metaConvValue)} color="green" />
                <KpiCard label="CPM" value={fmt.kr(sum("meta_ads", "cpm") / Math.max(campaignTable("meta_ads").length, 1))} color="yellow" />
                <KpiCard label="CPC" value={fmt.kr(sum("meta_ads", "cpc") / Math.max(campaignTable("meta_ads").length, 1))} color="yellow" />
                <KpiCard label="Lägg i varukorg" value={fmt.num(sum("meta_ads", "add_to_cart"))} color="orange" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Spend & Konverteringar per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={byDateMulti("meta_ads", [
                      { metric: "spend", key: "Spend" },
                      { metric: "conversions", key: "Köp" },
                    ])}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend />
                      <Bar yAxisId="right" dataKey="Köp" fill="#a855f7" />
                      <Line yAxisId="left" type="monotone" dataKey="Spend" stroke="#eab308" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Räckvidd & Frekvens per dag">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={byDateMulti("meta_ads", [
                      { metric: "reach", key: "Räckvidd" },
                      { metric: "frequency", key: "Frekvens" },
                    ])}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                      <Tooltip contentStyle={CHART_STYLE} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="Räckvidd" fill="#6366f120" stroke="#6366f1" dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="Frekvens" stroke="#f59e0b" dot={false} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card title="Kampanjprestanda">
                <DataTable
                  headers={["Kampanj", "Räckvidd", "Exp.", "Klick", "CTR", "Spend", "Köp", "Konv.värde", "ROAS", "Kr/köp"]}
                  rows={campaignTable("meta_ads").map((c: any) => [
                    c.name,
                    fmt.num(c.reach),
                    fmt.num(c.impressions),
                    fmt.num(c.clicks),
                    (c.ctr || 0).toFixed(2) + "%",
                    fmt.kr(c.spend),
                    fmt.num(c.conversions),
                    fmt.kr(c.conversion_value),
                    (c.roas || 0).toFixed(2) + "x",
                    fmt.kr(c.cost_per_conversion),
                  ])}
                />
              </Card>
            </div>
          )}

          {/* ── SEO ──────────────────────────────────────────────────────── */}
          {activeTab === "SEO" && has("wincher") && (
            <div className="space-y-6">
              <SeoAnalyzer orgId={orgId} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Bästa position" value={`#${wincherTop[0]?.value ?? "-"}`} color="orange" />
                <KpiCard label="Sökord i topp 3" value={fmt.num(metrics.filter(r => r.source === "wincher" && r.metric_name === "ranking_position" && r.value <= 3).length)} color="green" />
                <KpiCard label="Sökord pos 4–10" value={fmt.num(metrics.filter(r => r.source === "wincher" && r.metric_name === "ranking_position" && r.value >= 4 && r.value <= 10).length)} color="yellow" />
                <KpiCard label="Totalt sökord" value={fmt.num(new Set(metrics.filter(r => r.source === "wincher").map(r => r.dimension_name)).size)} color="blue" />
              </div>

              <Card title="Topp 10 rankingar">
                <DataTable
                  headers={["Sökord", "Position"]}
                  rows={wincherTop.map(kw => [
                    kw.dimension_name,
                    <span className={`font-bold ${kw.value <= 3 ? "text-green-400" : kw.value <= 10 ? "text-yellow-400" : "text-gray-400"}`}>
                      #{kw.value}
                    </span>
                  ])}
                />
              </Card>

              <Card title="Sökord nära topp 3 (position 4–10)">
                <DataTable
                  headers={["Sökord", "Position", "Potential"]}
                  rows={metrics
                    .filter(r => r.source === "wincher" && r.metric_name === "ranking_position" && r.value >= 4 && r.value <= 10)
                    .sort((a, b) => a.value - b.value)
                    .slice(0, 20)
                    .map(r => [
                      r.dimension_name,
                      <span className="text-yellow-400 font-bold">#{r.value}</span>,
                      <span className="text-xs text-gray-400">{r.value <= 5 ? "🔥 Hög" : r.value <= 8 ? "Medium" : "Låg"}</span>
                    ])}
                />
              </Card>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Komponenter ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const border: Record<string, string> = {
    blue: "border-blue-500", green: "border-green-500", teal: "border-teal-500",
    yellow: "border-yellow-500", orange: "border-orange-500", purple: "border-purple-500",
    indigo: "border-indigo-500", red: "border-red-500",
  }
  return (
    <div className={`bg-gray-900 border-l-4 ${border[color] || "border-gray-600"} rounded-lg p-4`}>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <h2 className="text-base font-semibold mb-4 text-gray-200">{title}</h2>
      {children}
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  if (rows.length === 0) return <p className="text-gray-500 text-sm">Ingen data</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {headers.map((h, i) => (
              <th key={i} className={`pb-2 text-xs font-medium text-gray-400 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`py-2.5 ${j === 0 ? "text-left text-gray-200" : "text-right text-gray-300"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
