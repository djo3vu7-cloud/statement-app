import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProcessPage from "./pages/ProcessPage";
import HistoryPage from "./pages/HistoryPage";
import CategoriesPage from "./pages/CategoriesPage";

const NAV = [
  { path: "/", label: "上傳" },
  { path: "/history", label: "歷史" },
  { path: "/categories", label: "分類管理" },
];

function Layout({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isProcess = pathname.startsWith("/process");
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a,#1e1b4b)", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 20px", display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ color: "#93c5fd", fontWeight: 800, fontSize: 16, padding: "14px 12px 14px 0", marginRight: 8, cursor: "pointer" }} onClick={() => navigate("/")}>📊 帳單分析</div>
        {NAV.map(n => (
          <button key={n.path} onClick={() => navigate(n.path)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "14px 14px", fontSize: 14, fontWeight: 600,
              color: (!isProcess && pathname === n.path) ? "#93c5fd" : "rgba(255,255,255,0.45)",
              borderBottom: (!isProcess && pathname === n.path) ? "2px solid #93c5fd" : "2px solid transparent" }}>
            {n.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/process/:id" element={<Layout><ProcessPage /></Layout>} />
        <Route path="/history" element={<Layout><HistoryPage /></Layout>} />
        <Route path="/categories" element={<Layout><CategoriesPage /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
