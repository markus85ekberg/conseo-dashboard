"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Org { id: string; name: string; created_at: string }
interface Connection { org_id: string; source: string; extra_config: any }

const SOURCES = ["wincher", "ga4", "google_ads", "meta_ads", "gsc", "woocommerce"]
const SOURCE_LABELS: Record<string, string> = {
  wincher: "Wincher", ga4: "GA4", google_ads: "Google Ads", meta_ads: "Meta Ads", gsc: "Search Console", woocommerce: "WooCommerce",
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function generateSlug(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

async function triggerSync(fnName: string, orgId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ org_id: orgId }),
    })
  } catch (_) {}
}

// ── Formulär (används för både ny och redigera) ───────────────────────────
interface OrgFormProps {
  title: string
  initial?: {
    name: string
    wincherApiKey: string; wincherWebsiteId: string
    ga4PropertyId: string; adsCustomerId: string; metaAdAccountId: string
    wooSiteUrl: string; wooConsumerKey: string; wooConsumerSecret: string
  }
  orgId?: string        // finns vid redigering
  savedOrgId?: string   // returneras vid ny kund
  onSaved: (org: Org) => void
  onCancel: () => void
}

function OrgForm({ title, initial, orgId, onSaved, onCancel }: OrgFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [wincherApiKey, setWincherApiKey] = useState(initial?.wincherApiKey ?? "")
  const [wincherWebsiteId, setWincherWebsiteId] = useState(initial?.wincherWebsiteId ?? "")
  const [ga4PropertyId, setGa4PropertyId] = useState(initial?.ga4PropertyId ?? "")
  const [adsCustomerId, setAdsCustomerId] = useState(initial?.adsCustomerId ?? "")
  const [metaAdAccountId, setMetaAdAccountId] = useState(initial?.metaAdAccountId ?? "")
  const [wooSiteUrl, setWooSiteUrl] = useState(initial?.wooSiteUrl ?? "")
  const [wooConsumerKey, setWooConsumerKey] = useState(initial?.wooConsumerKey ?? "")
  const [wooConsumerSecret, setWooConsumerSecret] = useState(initial?.wooConsumerSecret ?? "")
  const [saving, setSaving] = useState(false)
  const [savedOrg, setSavedOrg] = useState<Org | null>(null)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    let org: Org
    if (orgId) {
      // Uppdatera befintlig kund
      const { data, error } = await supabase
        .from("organizations").update({ name: name.trim(), slug: generateSlug(name.trim()) })
        .eq("id", orgId).select().maybeSingle()
      if (error || !data) { alert("Fel: " + (error?.message || "Org hittades inte")); setSaving(false); return }
      org = data
    } else {
      // Skapa ny kund
      const { data, error } = await supabase
        .from("organizations").insert({ name: name.trim(), slug: generateSlug(name.trim()) })
        .select().single()
      if (error || !data) { alert("Fel: " + error?.message); setSaving(false); return }
      org = data
    }

    const id = orgId ?? org.id
    const isNew = !orgId

    // Wincher
    if (wincherApiKey && wincherWebsiteId) {
      await supabase.from("data_source_connections").upsert({
        org_id: id, source: "wincher",
        extra_config: { api_key: wincherApiKey, website_id: wincherWebsiteId },
      }, { onConflict: "org_id,source" })
      triggerSync("sync-wincher", id)
    }

    // GA4
    if (ga4PropertyId) {
      const { data: existing } = await supabase.from("data_source_connections")
        .select("extra_config").eq("org_id", id).eq("source", "ga4").maybeSingle()
      await supabase.from("data_source_connections").upsert({
        org_id: id, source: "ga4",
        extra_config: { ...(existing?.extra_config || {}), property_id: ga4PropertyId },
      }, { onConflict: "org_id,source" })
    }

    // Google Ads
    if (adsCustomerId) {
      const { data: existing } = await supabase.from("data_source_connections")
        .select("extra_config").eq("org_id", id).eq("source", "google_ads").maybeSingle()
      await supabase.from("data_source_connections").upsert({
        org_id: id, source: "google_ads",
        extra_config: { ...(existing?.extra_config || {}), customer_id: adsCustomerId.replace(/-/g, "") },
      }, { onConflict: "org_id,source" })
    }

    // Meta
    if (metaAdAccountId) {
      const { data: existing } = await supabase.from("data_source_connections")
        .select("extra_config").eq("org_id", id).eq("source", "meta_ads").maybeSingle()
      await supabase.from("data_source_connections").upsert({
        org_id: id, source: "meta_ads",
        extra_config: { ...(existing?.extra_config || {}), ad_account_id: metaAdAccountId },
      }, { onConflict: "org_id,source" })
    }

    // WooCommerce
    if (wooSiteUrl && wooConsumerKey && wooConsumerSecret) {
      await supabase.from("data_source_connections").upsert({
        org_id: id, source: "woocommerce",
        extra_config: { site_url: wooSiteUrl, consumer_key: wooConsumerKey, consumer_secret: wooConsumerSecret },
      }, { onConflict: "org_id,source" })
      triggerSync("sync-woocommerce", id)
    }

    setSavedOrg(org)
    setSaving(false)
    onSaved(org)
  }

  const Field = ({ label, value, onChange, placeholder }: any) => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-8">
      <h2 className="text-lg font-semibold mb-5">{title}</h2>

      {savedOrg && !orgId && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-5">
          <p className="text-green-400 font-medium">✓ {savedOrg.name} skapad!</p>
          <p className="text-gray-400 text-xs mt-1">Org ID: <span className="font-mono text-gray-300">{savedOrg.id}</span></p>
          <p className="text-gray-400 text-xs mt-2">Klicka nedan för att koppla Google/Meta OAuth:</p>
          <div className="mt-2 space-y-1">
            <a href={`${SUPABASE_URL}/functions/v1/google-oauth-start?org_id=${savedOrg.id}&source=ga4`}
              className="block text-xs font-mono bg-gray-800 rounded px-3 py-1.5 text-blue-300 hover:bg-gray-700">
              → Anslut GA4
            </a>
            <a href={`${SUPABASE_URL}/functions/v1/google-oauth-start?org_id=${savedOrg.id}&source=google_ads`}
              className="block text-xs font-mono bg-gray-800 rounded px-3 py-1.5 text-blue-300 hover:bg-gray-700">
              → Anslut Google Ads
            </a>
            <a href={`${SUPABASE_URL}/functions/v1/meta-oauth-start?org_id=${savedOrg.id}`}
              className="block text-xs font-mono bg-gray-800 rounded px-3 py-1.5 text-indigo-300 hover:bg-gray-700">
              → Anslut Meta Ads
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Kundnamn *" value={name} onChange={setName} placeholder="t.ex. South Side BBQ" />
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 mt-2">Wincher</p>
        </div>
        <Field label="API-nyckel" value={wincherApiKey} onChange={setWincherApiKey} placeholder="Wincher API key" />
        <Field label="Website ID" value={wincherWebsiteId} onChange={setWincherWebsiteId} placeholder="t.ex. 2745656" />
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 mt-2">Google</p>
        </div>
        <Field label="GA4 Property ID" value={ga4PropertyId} onChange={setGa4PropertyId} placeholder="t.ex. 312639019" />
        <Field label="Google Ads Customer ID" value={adsCustomerId} onChange={setAdsCustomerId} placeholder="t.ex. 816-327-6949" />
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 mt-2">Meta</p>
        </div>
        <Field label="Ad Account ID" value={metaAdAccountId} onChange={setMetaAdAccountId} placeholder="t.ex. act_2880933385581480" />
        <div className="md:col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 mt-2">WooCommerce</p>
        </div>
        <div className="md:col-span-2">
          <Field label="Webbplatsens URL" value={wooSiteUrl} onChange={setWooSiteUrl} placeholder="t.ex. https://southsidebbq.se" />
        </div>
        <Field label="Consumer Key" value={wooConsumerKey} onChange={setWooConsumerKey} placeholder="ck_xxxxxxxxxxxx" />
        <Field label="Consumer Secret" value={wooConsumerSecret} onChange={setWooConsumerSecret} placeholder="cs_xxxxxxxxxxxx" />
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? "Sparar..." : orgId ? "Spara ändringar" : "Spara kund"}
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
          Avbryt
        </button>
      </div>
    </div>
  )
}

const SYNC_FUNCTIONS: Record<string, string> = {
  wincher: "sync-wincher",
  ga4: "sync-ga4",
  google_ads: "sync-google-ads",
  meta_ads: "sync-meta-ads",
  woocommerce: "sync-woocommerce",
}

// ── Huvudsida ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Org | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null) // "orgId" while syncing

  useEffect(() => { fetchData() }, [])

  async function syncAll(org: Org) {
    setSyncing(org.id)
    const conns = getConns(org.id)
    const fns = conns.map(c => SYNC_FUNCTIONS[c.source]).filter(Boolean)
    await Promise.all(fns.map(fn => triggerSync(fn, org.id)))
    setSyncing(null)
    alert(`✓ Synkning klar för ${org.name}`)
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: orgData }, { data: connData }] = await Promise.all([
      supabase.from("organizations").select("*").order("created_at", { ascending: false }),
      supabase.from("data_source_connections").select("org_id, source, extra_config"),
    ])
    setOrgs(orgData || [])
    setConnections(connData || [])
    setLoading(false)
  }

  function getConns(orgId: string) {
    return connections.filter(c => c.org_id === orgId)
  }

  function getInitialValues(org: Org) {
    const conns = getConns(org.id)
    const w = conns.find(c => c.source === "wincher")?.extra_config || {}
    const g = conns.find(c => c.source === "ga4")?.extra_config || {}
    const a = conns.find(c => c.source === "google_ads")?.extra_config || {}
    const m = conns.find(c => c.source === "meta_ads")?.extra_config || {}
    const woo = conns.find(c => c.source === "woocommerce")?.extra_config || {}
    return {
      name: org.name,
      wincherApiKey: w.api_key || "",
      wincherWebsiteId: w.website_id || "",
      ga4PropertyId: g.property_id || "",
      adsCustomerId: a.customer_id || "",
      metaAdAccountId: m.ad_account_id || "",
      wooSiteUrl: woo.site_url || "",
      wooConsumerKey: woo.consumer_key || "",
      wooConsumerSecret: woo.consumer_secret || "",
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-500">Laddar...</div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Kundhantering</h1>
          <p className="text-gray-400 mt-1">{orgs.length} kund(er) i systemet</p>
        </div>
        <div className="flex gap-3">
          <a href="/" className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
            ← Dashboard
          </a>
          <button onClick={() => { setShowNewForm(true); setEditingOrg(null) }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Lägg till kund
          </button>
        </div>
      </div>

      {showNewForm && (
        <OrgForm
          title="Ny kund"
          onSaved={() => { fetchData() }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {editingOrg && (
        <OrgForm
          title={`Redigera — ${editingOrg.name}`}
          orgId={editingOrg.id}
          initial={getInitialValues(editingOrg)}
          onSaved={() => { setEditingOrg(null); fetchData() }}
          onCancel={() => setEditingOrg(null)}
        />
      )}

      <div className="space-y-4">
        {orgs.map(org => {
          const conns = getConns(org.id)
          return (
            <div key={org.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{org.name}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{org.id}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500">{new Date(org.created_at).toLocaleDateString("sv-SE")}</span>
                  <button
                    onClick={() => syncAll(org)}
                    disabled={syncing === org.id}
                    className="text-xs text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-400/50 bg-green-500/10 hover:bg-green-500/20 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncing === org.id ? "Synkar..." : "↻ Synka"}
                  </button>
                  <button
                    onClick={() => { setEditingOrg(org); setShowNewForm(false); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                    className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-lg transition-colors"
                  >
                    Redigera
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {SOURCES.map(source => {
                  const conn = conns.find(c => c.source === source)
                  return (
                    <span key={source} className={`text-xs px-2.5 py-1 rounded-full border ${
                      conn ? "bg-green-500/10 text-green-400 border-green-500/30"
                           : "bg-gray-800 text-gray-600 border-gray-700"}`}>
                      {conn ? "✓" : "○"} {SOURCE_LABELS[source]}
                    </span>
                  )
                })}
              </div>

              {conns.length < SOURCES.length && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500 mb-2">Anslut fler källor:</p>
                  <div className="flex flex-wrap gap-2">
                    {!conns.find(c => c.source === "ga4") && (
                      <a href={`${SUPABASE_URL}/functions/v1/google-oauth-start?org_id=${org.id}&source=ga4`}
                        className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition-colors">
                        + GA4
                      </a>
                    )}
                    {!conns.find(c => c.source === "google_ads") && (
                      <a href={`${SUPABASE_URL}/functions/v1/google-oauth-start?org_id=${org.id}&source=google_ads`}
                        className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition-colors">
                        + Google Ads
                      </a>
                    )}
                    {!conns.find(c => c.source === "gsc") && (
                      <a href={`${SUPABASE_URL}/functions/v1/google-oauth-start?org_id=${org.id}&source=gsc`}
                        className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full hover:bg-blue-500/20 transition-colors">
                        + Search Console
                      </a>
                    )}
                    {!conns.find(c => c.source === "meta_ads") && (
                      <a href={`${SUPABASE_URL}/functions/v1/meta-oauth-start?org_id=${org.id}`}
                        className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full hover:bg-indigo-500/20 transition-colors">
                        + Meta Ads
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
