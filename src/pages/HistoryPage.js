import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const S = {
  card: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, marginBottom: 12 },
  btn: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 22px", cursor: "pointer" },
  btnSm: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e2e8f0", fontSize: 12, padding: "6px 12px", cursor: "pointer" },
  btnDanger: { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#f87171", fontSize: 12, padding: "6px 12px", cursor: "pointer" },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [statements, setStatements] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const load = () => {
    supabase.from("statements").select("id,billing_month,bank,created_at,transaction_count")
      .order("billing_month", { ascending: false })
      .then(({ data }) => { if (data) setStatements(data); setLoading(false); });
  };
  useEffect(load, []);

  const toggleSelect = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const deleteStatement = async (id) => {
    if (!window.confirm("確定要刪除此帳單？")) return;
    await supabase.from("statements").delete().eq("id", id);
    load();
  };

  const exportMerged = async () => {
    if (selected.size === 0) { alert("請先勾選要合併的帳單"); return; }
    const ids = [...selected];
    const { data } = await supabase.from("statements").select("billing_month,bank,transactions").in("id", ids);
    if (!data) return;

    const allTx = data.flatMap(s => s.transactions || []);
    const headers = ["類別", "記帳月份", "交易帳戶", "交易帳本", "貨幣符號", "交易金額", "一級分類", "二級分類", "交易標籤", "備註", "還款&報帳", "收入", "歸屬", "手續費", "稅", "交易貨幣", "原幣金額"];
    const rows = allTx.map(t => {
      const isForeign = t.currency && t.currency !== "TWD";
      const foreignNote = isForeign ? ` ${t.currency} ${t.foreign_amount}` : "";
      return [
        "支出", `${t.charge_date} 00:00:00`, "HSBC", "日常帳本", "NT$",
        t.amount_twd, t.category_1 || "", t.category_2 || "", "",
        `${t.description}${foreignNote}`, "", "", "",
        t.fee || "",
        isForeign ? (t.exchange_rate || "") : "1.0",
        isForeign ? t.currency : "",
        isForeign ? t.foreign_amount : "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const months = data.map(d => d.billing_month).sort().join("_");
    a.download = `帳單彙整_${months}.csv`;
    a.click();
  };

  if (loading) return <div style={{ color: "#fff", padding: 40, textAlign: "center" }}>⏳ 載入中…</div>;

  return (
    <div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>帳單歷史</div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <button style={S.btn} onClick={exportMerged}>⬇ 合併匯出 ({selected.size})</button>
          )}
          <button style={S.btnSm} onClick={() => setSelected(new Set(statements.map(s => s.id)))}>全選</button>
          <button style={S.btnSm} onClick={() => setSelected(new Set())}>清除</button>
        </div>
      </div>

      {statements.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>
          尚無帳單記錄，請上傳 PDF
        </div>
      )}

      {statements.map(s => {
        const sel = selected.has(s.id);
        return (
          <div key={s.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: sel ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)", borderColor: sel ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)" }}>
            <input type="checkbox" checked={sel} onChange={() => toggleSelect(s.id)} style={{ width: 16, height: 16, cursor: "pointer" }} onClick={e => e.stopPropagation()} />
            <div style={{ flex: 1 }} onClick={() => navigate(`/process/${s.id}`)}>
              <div style={{ color: "#f1f5f9", fontWeight: 700 }}>{s.billing_month} · {s.bank}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>
                {s.transaction_count} 筆 · {new Date(s.created_at).toLocaleDateString("zh-TW")} 匯入
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
              <button style={S.btnSm} onClick={() => navigate(`/process/${s.id}`)}>開啟</button>
              <button style={S.btnDanger} onClick={() => deleteStatement(s.id)}>刪除</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
