import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const S = {
  card: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, marginBottom: 16 },
  title: { color: "#f1f5f9", fontSize: 16, fontWeight: 700, marginBottom: 16 },
  btn: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15, padding: "12px 28px", cursor: "pointer", width: "100%" },
  sub: { color: "rgba(255,255,255,0.35)", fontSize: 13 },
  row: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" },
  err: { color: "#f87171", fontSize: 13, marginTop: 8 },
};

export default function HomePage() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    supabase.from("statements").select("id,billing_month,bank,created_at,transaction_count")
      .order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => { if (data) setRecent(data); });
  }, []);

  const handleFile = async (file) => {
    if (!file || file.type !== "application/pdf") { setError("請選擇 PDF 檔案"); return; }
    setLoading(true); setError("");
    try {
      const base64 = await toBase64(file);
      const { data: rulesData } = await supabase.from("category_rules").select("*");
      const rules = rulesData || [];

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_base64: base64.split(",")[1], rules }),
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error("API 回應非 JSON：" + text.slice(0, 200)); }
      if (parsed.error) throw new Error(parsed.error + (parsed.detail ? "\n" + parsed.detail.slice(0, 300) : ""));

      // 存到 Supabase
      const { data: saved, error: dbErr } = await supabase.from("statements").insert({
        bank: "HSBC",
        billing_month: parsed.billing_month,
        billing_date: parsed.billing_date,
        transaction_count: parsed.transactions.length,
        transactions: parsed.transactions,
      }).select().single();
      if (dbErr) throw new Error(dbErr.message);

      navigate(`/process/${saved.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ ...S.card, borderStyle: "dashed", borderColor: "rgba(99,102,241,0.4)", textAlign: "center", padding: "40px 24px" }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
        <div style={{ color: "#c7d2fe", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>拖曳或選擇 PDF 帳單</div>
        <div style={{ ...S.sub, marginBottom: 20 }}>支援 HSBC 旅人卡電子帳單</div>
        <button style={{ ...S.btn, width: "auto", padding: "10px 32px" }}
          onClick={() => fileRef.current.click()} disabled={loading}>
          {loading ? "⏳ 解析中…" : "選擇 PDF"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])} />
        {error && <div style={S.err}>{error}</div>}
      </div>

      {recent.length > 0 && (
        <div style={S.card}>
          <div style={S.title}>最近的帳單</div>
          {recent.map(s => (
            <div key={s.id} style={S.row} onClick={() => navigate(`/process/${s.id}`)}>
              <div>
                <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{s.billing_month} · {s.bank}</div>
                <div style={{ ...S.sub, marginTop: 2 }}>{s.transaction_count} 筆交易</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                {new Date(s.created_at).toLocaleDateString("zh-TW")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
