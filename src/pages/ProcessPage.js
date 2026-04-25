import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const S = {
  card: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, marginBottom: 12 },
  th: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "6px 10px", textAlign: "left" },
  td: { color: "#e2e8f0", fontSize: 13, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", verticalAlign: "middle" },
  btn: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 22px", cursor: "pointer" },
  btnSm: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e2e8f0", fontSize: 12, padding: "4px 10px", cursor: "pointer" },
  sel: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e2e8f0", fontSize: 12, padding: "4px 8px", cursor: "pointer" },
  badge: (ok) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: ok ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)", color: ok ? "#34d399" : "#fbbf24" }),
};

export default function ProcessPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [statement, setStatement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveRule, setSaveRule] = useState(null); // {desc, cat1, cat2}
  const [filterUncategorized, setFilterUncategorized] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("statements").select("*").eq("id", id).single(),
      supabase.from("categories").select("*").order("level_1"),
    ]).then(([{ data: s }, { data: cats }]) => {
      if (s) { setStatement(s); setTransactions(s.transactions || []); }
      if (cats) {
        const map = {};
        cats.forEach(c => {
          if (!map[c.level_1]) map[c.level_1] = [];
          if (c.level_2) map[c.level_1].push(c.level_2);
        });
        setCategories(map);
      }
      setLoading(false);
    });
  }, [id]);

  const updateTx = useCallback((txId, field, value) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, [field]: value } : t));
  }, []);

  const saveAll = async () => {
    setSaving(true);
    await supabase.from("statements").update({ transactions }).eq("id", id);
    setSaving(false);
    alert("已儲存");
  };

  const exportCSV = () => {
    const headers = ["類別", "記帳月份", "交易帳戶", "交易帳本", "貨幣符號", "交易金額", "一級分類", "二級分類", "交易標籤", "備註", "還款&報帳", "收入", "歸屬", "手續費", "稅", "交易貨幣", "原幣金額"];
    const rows = transactions.map(t => {
      const isForeign = t.currency && t.currency !== "TWD";
      const foreignNote = isForeign ? ` ${t.currency} ${t.foreign_amount}` : "";
      return [
        "支出",
        `${t.charge_date} 00:00:00`,
        "HSBC",
        "日常帳本",
        "NT$",
        t.amount_twd,
        t.category_1 || "",
        t.category_2 || "",
        "",
        `${t.description}${foreignNote}`,
        "", "", "",
        t.fee || "",
        isForeign ? (t.exchange_rate || "") : "1.0",
        isForeign ? t.currency : "",
        isForeign ? t.foreign_amount : "",
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `${v}`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `帳單彙整_${statement?.billing_month?.replace("-", "") || id}.csv`;
    a.click();
  };

  const confirmSaveRule = async () => {
    if (!saveRule) return;
    // 取關鍵字（描述前10字）
    const keyword = saveRule.desc.slice(0, 12).trim();
    await supabase.from("category_rules").upsert({
      keyword,
      category_1: saveRule.cat1,
      category_2: saveRule.cat2 || "",
      priority: 0,
    }, { onConflict: "keyword" });
    setSaveRule(null);
    alert(`已記住：「${keyword}」→ ${saveRule.cat1}`);
  };

  const cat1List = Object.keys(categories).sort();
  const filtered = transactions.filter(t => {
    if (filterUncategorized && t.category_1) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const uncategorizedCount = transactions.filter(t => !t.category_1).length;

  if (loading) return <div style={{ color: "#fff", padding: 40, textAlign: "center" }}>⏳ 載入中…</div>;
  if (!statement) return <div style={{ color: "#f87171", padding: 40 }}>找不到此帳單</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 18 }}>{statement.billing_month} · {statement.bank}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
            共 {transactions.length} 筆 ·
            <span style={{ color: uncategorizedCount > 0 ? "#fbbf24" : "#34d399", marginLeft: 4 }}>
              {uncategorizedCount > 0 ? `${uncategorizedCount} 筆未分類` : "✅ 全部已分類"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btnSm} onClick={() => navigate(-1)}>← 返回</button>
          <button style={S.btnSm} onClick={saveAll} disabled={saving}>{saving ? "儲存中…" : "💾 儲存"}</button>
          <button style={S.btn} onClick={exportCSV}>⬇ 匯出 CSV</button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋交易說明…"
          style={{ flex: 1, minWidth: 160, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13 }} />
        <button style={{ ...S.btnSm, background: filterUncategorized ? "rgba(251,191,36,0.15)" : undefined, color: filterUncategorized ? "#fbbf24" : undefined }}
          onClick={() => setFilterUncategorized(v => !v)}>
          {filterUncategorized ? "🔸 只看未分類" : "🔸 只看未分類"}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                <th style={S.th}>日期</th>
                <th style={S.th}>交易說明</th>
                <th style={S.th}>金額(NT$)</th>
                <th style={S.th}>外幣</th>
                <th style={S.th}>手續費</th>
                <th style={S.th}>一級分類</th>
                <th style={S.th}>二級分類</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <TxRow key={tx.id} tx={tx} categories={categories} cat1List={cat1List}
                  onChange={(f, v) => updateTx(tx.id, f, v)}
                  onSaveRule={() => setSaveRule({ desc: tx.description, cat1: tx.category_1, cat2: tx.category_2 })} />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "rgba(255,255,255,0.25)", padding: 32 }}>沒有符合的資料</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Rule Modal */}
      {saveRule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1e2a3a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%" }}>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>記住此分類規則</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 16 }}>
              往後包含「{saveRule.desc.slice(0, 12)}」的交易<br />將自動分類為：{saveRule.cat1}{saveRule.cat2 ? " › " + saveRule.cat2 : ""}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btnSm} onClick={() => setSaveRule(null)}>取消</button>
              <button style={S.btn} onClick={confirmSaveRule}>確認記住</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TxRow({ tx, categories, cat1List, onChange, onSaveRule }) {
  const [editDesc, setEditDesc] = useState(false);
  const cat2List = tx.category_1 ? (categories[tx.category_1] || []) : [];
  const isForeign = tx.currency && tx.currency !== "TWD";
  const categorized = !!tx.category_1;

  return (
    <tr style={{ background: categorized ? "transparent" : "rgba(251,191,36,0.04)" }}>
      <td style={{ ...S.td, whiteSpace: "nowrap", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
        {tx.charge_date?.slice(5)}
      </td>
      <td style={{ ...S.td, maxWidth: 220 }}>
        {editDesc
          ? <input value={tx.description} onChange={e => onChange("description", e.target.value)}
              onBlur={() => setEditDesc(false)} autoFocus
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(99,102,241,0.5)", borderRadius: 4, color: "#e2e8f0", padding: "3px 6px", fontSize: 12, width: "100%" }} />
          : <span onDoubleClick={() => setEditDesc(true)} title={tx.description} style={{ cursor: "pointer" }}>
              {tx.description.length > 30 ? tx.description.slice(0, 30) + "…" : tx.description}
            </span>
        }
      </td>
      <td style={{ ...S.td, textAlign: "right", color: "#f87171", fontWeight: 600, whiteSpace: "nowrap" }}>
        {Number(tx.amount_twd).toLocaleString()}
      </td>
      <td style={{ ...S.td, fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
        {isForeign ? `${tx.currency} ${Number(tx.foreign_amount).toLocaleString()}` : ""}
      </td>
      <td style={{ ...S.td, textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
        {tx.fee ? tx.fee : ""}
      </td>
      <td style={S.td}>
        <select value={tx.category_1 || ""} onChange={e => { onChange("category_1", e.target.value); onChange("category_2", ""); }} style={S.sel}>
          <option value="">— 選擇 —</option>
          {cat1List.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td style={S.td}>
        <select value={tx.category_2 || ""} onChange={e => onChange("category_2", e.target.value)} style={S.sel} disabled={!tx.category_1 || cat2List.length === 0}>
          <option value="">—</option>
          {cat2List.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td style={{ ...S.td, whiteSpace: "nowrap" }}>
        {tx.category_1 && (
          <button style={{ ...S.btnSm, fontSize: 11 }} onClick={onSaveRule} title="記住此分類規則">💾 記住</button>
        )}
      </td>
    </tr>
  );
}
