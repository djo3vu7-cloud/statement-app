import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";

const S = {
  card: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, marginBottom: 16 },
  title: { color: "#f1f5f9", fontWeight: 700, fontSize: 16, marginBottom: 16 },
  inp: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none" },
  btn: { background: "linear-gradient(135deg,#3b82f6,#6366f1)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 18px", cursor: "pointer" },
  btnSm: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#e2e8f0", fontSize: 12, padding: "4px 10px", cursor: "pointer" },
  btnDanger: { background: "none", border: "none", color: "rgba(248,113,113,0.6)", fontSize: 13, cursor: "pointer", padding: "0 4px" },
  tag: { display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#a5b4fc", margin: "3px" },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [newCat1, setNewCat1] = useState("");
  const [newCat2, setNewCat2] = useState("");
  const [selectedCat1, setSelectedCat1] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRuleCat1, setNewRuleCat1] = useState("");
  const [newRuleCat2, setNewRuleCat2] = useState("");
  const [editRule, setEditRule] = useState(null);

  const load = () => {
    Promise.all([
      supabase.from("categories").select("*").order("level_1,level_2"),
      supabase.from("category_rules").select("*").order("category_1,keyword"),
    ]).then(([{ data: c }, { data: r }]) => {
      if (c) setCategories(c);
      if (r) setRules(r);
    });
  };
  useEffect(load, []);

  // 一級分類列表
  const cat1List = [...new Set(categories.map(c => c.level_1))].sort();
  const cat2ListFor = (c1) => categories.filter(c => c.level_1 === c1 && c.level_2).map(c => c.level_2);

  const addCat1 = async () => {
    if (!newCat1.trim()) return;
    await supabase.from("categories").insert({ level_1: newCat1.trim(), level_2: null });
    setNewCat1(""); load();
  };

  const addCat2 = async () => {
    if (!selectedCat1 || !newCat2.trim()) return;
    await supabase.from("categories").insert({ level_1: selectedCat1, level_2: newCat2.trim() });
    setNewCat2(""); load();
  };

  const deleteCat = async (id) => {
    if (!window.confirm("刪除此分類？相關的規則不會自動刪除")) return;
    await supabase.from("categories").delete().eq("id", id);
    load();
  };

  const addRule = async () => {
    if (!newKeyword.trim() || !newRuleCat1) return;
    await supabase.from("category_rules").upsert({
      keyword: newKeyword.trim(),
      category_1: newRuleCat1,
      category_2: newRuleCat2 || "",
      priority: 0,
    }, { onConflict: "keyword" });
    setNewKeyword(""); setNewRuleCat1(""); setNewRuleCat2(""); load();
  };

  const deleteRule = async (id) => {
    await supabase.from("category_rules").delete().eq("id", id);
    load();
  };

  const saveEditRule = async () => {
    if (!editRule) return;
    await supabase.from("category_rules").update({
      keyword: editRule.keyword,
      category_1: editRule.category_1,
      category_2: editRule.category_2 || "",
    }).eq("id", editRule.id);
    setEditRule(null); load();
  };

  return (
    <div>
      {/* 分類管理 */}
      <div style={S.card}>
        <div style={S.title}>🏷️ 分類管理</div>

        {/* 新增一級 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>新增一級分類</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCat1} onChange={e => setNewCat1(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat1()}
              placeholder="例：旅行" style={{ ...S.inp, flex: 1 }} />
            <button style={S.btn} onClick={addCat1}>＋ 新增</button>
          </div>
        </div>

        {/* 新增二級 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>新增二級分類</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={selectedCat1} onChange={e => setSelectedCat1(e.target.value)}
              style={{ ...S.inp, minWidth: 120 }}>
              <option value="">選擇一級…</option>
              {cat1List.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={newCat2} onChange={e => setNewCat2(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat2()}
              placeholder="例：住宿(日本)" style={{ ...S.inp, flex: 1 }} />
            <button style={S.btn} onClick={addCat2}>＋ 新增</button>
          </div>
        </div>

        {/* 顯示分類樹 */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>現有分類</div>
        {cat1List.map(c1 => (
          <div key={c1} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: "#93c5fd", fontWeight: 700, fontSize: 14 }}>{c1}</span>
              <button style={S.btnDanger} onClick={() => {
                const ids = categories.filter(c => c.level_1 === c1).map(c => c.id);
                if (window.confirm(`刪除「${c1}」及所有子分類？`))
                  Promise.all(ids.map(id => supabase.from("categories").delete().eq("id", id))).then(load);
              }}>✕</button>
            </div>
            <div style={{ paddingLeft: 16 }}>
              {cat2ListFor(c1).map(c2 => {
                const row = categories.find(c => c.level_1 === c1 && c.level_2 === c2);
                return (
                  <span key={c2} style={S.tag}>
                    {c2}
                    <button style={{ ...S.btnDanger, fontSize: 11 }} onClick={() => deleteCat(row.id)}>✕</button>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 關鍵字規則 */}
      <div style={S.card}>
        <div style={S.title}>🔑 關鍵字分類規則</div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 16 }}>
          新增消費包含此關鍵字時自動套用分類
        </div>

        {/* 新增規則 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="關鍵字（大小寫不分）"
            style={{ ...S.inp, flex: 2, minWidth: 130 }} />
          <select value={newRuleCat1} onChange={e => { setNewRuleCat1(e.target.value); setNewRuleCat2(""); }}
            style={{ ...S.inp, minWidth: 110 }}>
            <option value="">一級分類…</option>
            {cat1List.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={newRuleCat2} onChange={e => setNewRuleCat2(e.target.value)}
            style={{ ...S.inp, minWidth: 110 }} disabled={!newRuleCat1 || cat2ListFor(newRuleCat1).length === 0}>
            <option value="">二級（選填）</option>
            {cat2ListFor(newRuleCat1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button style={S.btn} onClick={addRule}>＋ 新增</button>
        </div>

        {/* 規則列表 */}
        {rules.length === 0 && <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center", padding: 16 }}>尚無規則</div>}
        {rules.map(r => (
          <div key={r.id} style={S.row}>
            {editRule?.id === r.id ? (
              <>
                <input value={editRule.keyword} onChange={e => setEditRule({ ...editRule, keyword: e.target.value })}
                  style={{ ...S.inp, flex: 2, fontSize: 12, padding: "4px 8px" }} />
                <select value={editRule.category_1} onChange={e => setEditRule({ ...editRule, category_1: e.target.value, category_2: "" })}
                  style={{ ...S.inp, fontSize: 12, padding: "4px 8px" }}>
                  {cat1List.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={editRule.category_2 || ""} onChange={e => setEditRule({ ...editRule, category_2: e.target.value })}
                  style={{ ...S.inp, fontSize: 12, padding: "4px 8px" }}>
                  <option value="">—</option>
                  {cat2ListFor(editRule.category_1).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button style={S.btn} onClick={saveEditRule}>儲存</button>
                <button style={S.btnSm} onClick={() => setEditRule(null)}>取消</button>
              </>
            ) : (
              <>
                <span style={{ flex: 2, color: "#fbbf24", fontSize: 13, fontFamily: "monospace" }}>{r.keyword}</span>
                <span style={{ color: "#93c5fd", fontSize: 13 }}>{r.category_1}{r.category_2 ? " › " + r.category_2 : ""}</span>
                <button style={S.btnSm} onClick={() => setEditRule({ ...r })}>編輯</button>
                <button style={S.btnDanger} onClick={() => deleteRule(r.id)}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
