"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area
} from "recharts"

const CHART_STYLE = { backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-200">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const border: Record<string, string> = {
    blue: "border-blue-500", green: "border-green-500", teal: "border-teal-500",
    yellow: "border-yellow-500", orange: "border-orange-500", purple: "border-purple-500",
    red: "border-red-500",
  }
  return (
    <div className={`bg-gray-900 border-l-4 ${border[color] || "border-gray-600"} rounded-lg p-4`}>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

const fmt = {
  num: (v: number) => v?.toLocaleString("sv", { maximumFractionDigits: 0 }) || "0",
  kr: (v: number) => v?.toLocaleString("sv", { maximumFractionDigits: 0 }) + " kr" || "0 kr",
  pct: (v: number) => (v * 100).toFixed(1) + "%",
  dec: (v: number, d = 2) => v?.toFixed(d) || "0",
}

interface Props { orgId: string }

export default function AnalysTab({ orgId }: Props) {
  const [metrics, setMetrics] = useState<any[]>([])
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [margins, setMargins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadStatus, setUploadStatus] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (orgId) loadAll() }, [orgId])

  async function loadAll() {
    setLoading(true)
    const [{ data: m }, { data: co }, { data: mg }] = await Promise.all([
      fetchAllMetrics(),
      supabase.from("customer_orders").select("*").eq("org_id", orgId).order("order_date"),
      supabase.from("product_margins").select("*").eq("org_id", orgId),
    ])
    setMetrics(m || [])
    setCustomerOrders(co || [])
    setMargins(mg || [])
    setLoading(false)
  }

  async function fetchAllMetrics() {
    const sources = ["ga4_historical", "google_ads_historical", "woocommerce_historical"]
    const results = await Promise.all(sources.map(async source => {
      const all: any[] = []
      let from = 0
      while (true) {
        const { data } = await supabase.from("metrics").select("*")
          .eq("org_id", orgId).eq("source", source).range(from, from + 999)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < 1000) break
        from += 1000
      }
      return all
    }))
    return { data: results.flat() }
  }

  // ── Hjälpfunktioner ────────────────────────────────────────────────────────
  function getMonthly(source: string, metric: string, dimName = "total") {
    const map: Record<string, number> = {}
    metrics.filter(r => r.source === source && r.metric_name === metric
      && r.dimension_name === dimName && r.dimension_value === "monthly")
      .forEach(r => { map[r.date] = (map[r.date] || 0) + r.value })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date: date.slice(0, 7), value: Math.round(value * 100) / 100 }))
  }

  function mergeMonthly(entries: { key: string; source: string; metric: string; dimName?: string }[]) {
    const map: Record<string, any> = {}
    for (const { key, source, metric, dimName } of entries) {
      metrics.filter(r => r.source === source && r.metric_name === metric
        && r.dimension_name === (dimName || "total") && r.dimension_value === "monthly")
        .forEach(r => {
          if (!map[r.date]) map[r.date] = { date: r.date.slice(0, 7) }
          map[r.date][key] = (map[r.date][key] || 0) + r.value
        })
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }

  // ── Beräknade nyckeltal ────────────────────────────────────────────────────
  const wooMonths = getMonthly("woocommerce_historical", "orders")
  const totalOrders = wooMonths.reduce((s, m) => s + m.value, 0)
  const avgMonthlyOrders = wooMonths.length > 0 ? totalOrders / wooMonths.length : 0
  const aovData = getMonthly("woocommerce_historical", "avg_order_value")
  const latestAov = aovData[aovData.length - 1]?.value || 0
  const totalNewCustomers = metrics.filter(r => r.source === "woocommerce_historical" && r.metric_name === "new_customers" && r.dimension_value === "monthly").reduce((s, r) => s + r.value, 0)
  const totalReturning = metrics.filter(r => r.source === "woocommerce_historical" && r.metric_name === "returning_customers" && r.dimension_value === "monthly").reduce((s, r) => s + r.value, 0)
  const returnRate = (totalNewCustomers + totalReturning) > 0 ? totalReturning / (totalNewCustomers + totalReturning) : 0

  const totalAdsCost = metrics.filter(r => r.source === "google_ads_historical" && r.metric_name === "cost" && r.dimension_name === "total").reduce((s, r) => s + r.value, 0)
  const totalAdsConvValue = metrics.filter(r => r.source === "google_ads_historical" && r.metric_name === "conversion_value" && r.dimension_name === "total").reduce((s, r) => s + r.value, 0)
  const overallRoas = totalAdsCost > 0 ? totalAdsConvValue / totalAdsCost : 0
  const costPerOrder = totalAdsCost > 0 && totalOrders > 0 ? totalAdsCost / totalOrders : 0

  // ── Kohortanalys ──────────────────────────────────────────────────────────
  function buildCohortMatrix() {
    if (customerOrders.length === 0) return { cohorts: [], maxOffset: 0 }

    // Hitta första köpet per kund
    const firstPurchase: Record<string, string> = {}
    for (const o of customerOrders) {
      if (!firstPurchase[o.customer_hash] || o.order_date < firstPurchase[o.customer_hash]) {
        firstPurchase[o.customer_hash] = o.order_date
      }
    }

    // Bygg kohort: { cohortMonth: { offset: count } }
    const cohorts: Record<string, Record<number, Set<string>>> = {}
    for (const o of customerOrders) {
      const cohortMonth = firstPurchase[o.customer_hash]?.slice(0, 7)
      if (!cohortMonth) continue
      const orderMonth = o.order_date?.slice(0, 7)
      const [cy, cm] = cohortMonth.split("-").map(Number)
      const [oy, om] = orderMonth.split("-").map(Number)
      const offset = (oy - cy) * 12 + (om - cm)
      if (!cohorts[cohortMonth]) cohorts[cohortMonth] = {}
      if (!cohorts[cohortMonth][offset]) cohorts[cohortMonth][offset] = new Set()
      cohorts[cohortMonth][offset].add(o.customer_hash)
    }

    const sortedMonths = Object.keys(cohorts).sort()
    const maxOffset = Math.max(...sortedMonths.map(m => Math.max(...Object.keys(cohorts[m]).map(Number))))

    const rows = sortedMonths.map(month => {
      const baseCount = cohorts[month][0]?.size || 0
      const retentions: (number | null)[] = []
      for (let i = 0; i <= Math.min(maxOffset, 11); i++) {
        const count = cohorts[month][i]?.size || 0
        retentions.push(baseCount > 0 ? count / baseCount : null)
      }
      return { month, baseCount, retentions }
    })

    return { cohorts: rows, maxOffset: Math.min(maxOffset, 11) }
  }

  // ── Marketing ROI per månad ────────────────────────────────────────────────
  const roiData = mergeMonthly([
    { key: "Ads kostnad", source: "google_ads_historical", metric: "cost" },
    { key: "Ads konv.värde", source: "google_ads_historical", metric: "conversion_value" },
    { key: "WooCommerce omsättning", source: "woocommerce_historical", metric: "revenue" },
  ]).map(m => ({
    ...m,
    ROAS: m["Ads kostnad"] > 0 ? +(m["Ads konv.värde"] / m["Ads kostnad"]).toFixed(2) : 0,
  }))

  // ── Rabatter & frakt per månad ─────────────────────────────────────────────
  const discountData = mergeMonthly([
    { key: "Omsättning", source: "woocommerce_historical", metric: "revenue" },
    { key: "Rabatter", source: "woocommerce_historical", metric: "discount_total" },
    { key: "Frakt", source: "woocommerce_historical", metric: "shipping_total" },
  ])

  // ── CSV-import av marginaler ───────────────────────────────────────────────
  async function handleMarginUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus("Läser fil...")
    const text = await file.text()
    const lines = text.split("\n").filter(l => l.trim())
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const [product_name, margin_pct, cost_price] = lines[i].split(";").map(s => s.trim().replace(/"/g, ""))
      if (!product_name) continue
      rows.push({ org_id: orgId, product_name, margin_pct: parseFloat(margin_pct) || null, cost_price: parseFloat(cost_price) || null, updated_at: new Date().toISOString() })
    }
    const { error } = await supabase.from("product_margins").upsert(rows, { onConflict: "org_id,product_name" })
    if (error) { setUploadStatus("Fel: " + error.message); return }
    setUploadStatus(`✓ ${rows.length} produkter importerade`)
    loadAll()
  }

  const { cohorts, maxOffset } = buildCohortMatrix()

  const retentionColor = (v: number | null, isBase = false) => {
    if (isBase) return "bg-blue-600 text-white"
    if (v === null) return "bg-gray-800 text-gray-600"
    if (v >= 0.3) return "bg-green-500/80 text-white"
    if (v >= 0.1) return "bg-yellow-500/60 text-white"
    return "bg-gray-700 text-gray-400"
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Laddar historisk data...</div>

  return (
    <div className="space-y-6">

      {/* KPI-kort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Snitt orders/månad" value={fmt.num(avgMonthlyOrders)} sub={`Totalt ${fmt.num(totalOrders)} orders`} color="blue" />
        <KpiCard label="Snittordervärde (senaste)" value={fmt.kr(latestAov)} sub="WooCommerce netto" color="green" />
        <KpiCard label="Återköpsandel" value={fmt.pct(returnRate)} sub={`${fmt.num(totalReturning)} återköp`} color="teal" />
        <KpiCard label="Google Ads ROAS totalt" value={fmt.dec(overallRoas) + "x"} sub={`${fmt.kr(totalAdsCost)} spenderat`} color={overallRoas < 2 ? "red" : "green"} />
        <KpiCard label="Kostnad/order (Ads)" value={fmt.kr(costPerOrder)} color="yellow" />
        <KpiCard label="Nya kunder" value={fmt.num(totalNewCustomers)} sub="WooCommerce 2024–" color="blue" />
        <KpiCard label="Återkommande kunder" value={fmt.num(totalReturning)} color="teal" />
        <KpiCard label="Ads konv.värde totalt" value={fmt.kr(totalAdsConvValue)} color="green" />
      </div>

      {/* Orders per månad */}
      <Card title="Orders per månad (WooCommerce)">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={mergeMonthly([
            { key: "Orders", source: "woocommerce_historical", metric: "orders" },
            { key: "Nya kunder", source: "woocommerce_historical", metric: "new_customers" },
            { key: "Återköp", source: "woocommerce_historical", metric: "returning_customers" },
          ])}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={CHART_STYLE} />
            <Legend />
            <Bar dataKey="Nya kunder" stackId="a" fill="#3b82f6" />
            <Bar dataKey="Återköp" stackId="a" fill="#10b981" />
            <Line type="monotone" dataKey="Orders" stroke="#ffffff" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* AOV + omsättning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Genomsnittligt ordervärde per månad">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={aovData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [fmt.kr(v), "AOV"]} />
              <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} strokeWidth={2} name="AOV" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Konverteringsgrad per månad (GA4)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={getMonthly("ga4_historical", "conv_rate").map(m => ({ ...m, value: +(m.value * 100).toFixed(2) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [v + "%", "Konv.grad"]} />
              <Line type="monotone" dataKey="value" stroke="#a855f7" dot={false} strokeWidth={2} name="Konv.grad" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Marketing ROI */}
      <Card title="Marketing ROI — Google Ads kostnad vs WooCommerce omsättning">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={roiData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} domain={[0, 'auto']} />
            <Tooltip contentStyle={CHART_STYLE} formatter={(v: any, name: string) =>
              name === "ROAS" ? [v + "x", name] : [fmt.kr(v), name]
            } />
            <Legend />
            <Bar yAxisId="left" dataKey="Ads kostnad" fill="#ef444460" />
            <Bar yAxisId="left" dataKey="WooCommerce omsättning" fill="#22c55e60" />
            <Line yAxisId="right" type="monotone" dataKey="ROAS" stroke="#eab308" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Rabatter & frakt */}
      <Card title="Omsättning, rabatter & frakt per månad">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={discountData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={CHART_STYLE} formatter={(v: any) => [fmt.kr(v)]} />
            <Legend />
            <Bar dataKey="Omsättning" fill="#22c55e80" />
            <Bar dataKey="Rabatter" fill="#ef444480" />
            <Bar dataKey="Frakt" fill="#3b82f680" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Kohortanalys */}
      {cohorts.length > 0 && (
        <Card title="Kohortanalys — återköp (% av kohortens ursprungliga kunder)">
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 pr-4 text-gray-400 font-medium">Kohort</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Kunder</th>
                  {Array.from({ length: maxOffset + 1 }, (_, i) => (
                    <th key={i} className="text-center py-2 px-1 text-gray-400 font-medium w-12">
                      {i === 0 ? "M0" : `+${i}m`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-4 text-gray-300 font-medium">{row.month}</td>
                    <td className="text-right px-2 text-gray-400">{row.baseCount}</td>
                    {row.retentions.map((v, j) => (
                      <td key={j} className="px-1 py-1">
                        <div className={`text-center rounded px-1 py-0.5 text-xs font-medium ${retentionColor(v, j === 0)}`}>
                          {v === null ? "–" : j === 0 ? "100%" : fmt.pct(v)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-3">Grön = ≥30% återköp · Gul = 10–29% · Grå = {"<"}10%</p>
        </Card>
      )}

      {/* Marginuppladdning */}
      <Card
        title="Produktmarginaler"
        action={
          <button onClick={() => fileRef.current?.click()}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
            Ladda upp CSV
          </button>
        }
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleMarginUpload} />
        {uploadStatus && <p className="text-sm text-green-400 mb-3">{uploadStatus}</p>}
        <p className="text-xs text-gray-500 mb-4">
          CSV-format: <code className="bg-gray-800 px-1 rounded">produkt_namn;marginal_pct;inköpspris</code> (semikolon-separerat, rubrikrad på rad 1)
        </p>
        {margins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left pb-2 text-xs text-gray-400">Produkt</th>
                  <th className="text-right pb-2 text-xs text-gray-400">Marginal %</th>
                  <th className="text-right pb-2 text-xs text-gray-400">Inköpspris</th>
                </tr>
              </thead>
              <tbody>
                {margins.map((m, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-200">{m.product_name}</td>
                    <td className="text-right text-gray-300">{m.margin_pct != null ? m.margin_pct + "%" : "–"}</td>
                    <td className="text-right text-gray-300">{m.cost_price != null ? fmt.kr(m.cost_price) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-sm">Inga marginaler uppladdade ännu.</p>
        )}
      </Card>

    </div>
  )
}
