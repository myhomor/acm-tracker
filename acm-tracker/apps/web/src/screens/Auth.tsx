import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { RingGauge } from "../components/RingGauge";
import { useLogin } from "../features/auth/api/use-auth";
import { colors } from "../theme/tokens";

const inputStyle = {
  width: "100%",
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 8,
  padding: "14px 16px",
  fontSize: 14,
} as const;

export function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("owner@acm.local");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    login.mutate(email.trim(), {
      onSuccess: () => navigate("/"),
      onError: () => setError(t("auth.errorNoMember")),
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      <div className="grid-bg" style={{ background: colors.surface, padding: 56, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span className="mono" style={{ color: colors.coral, fontWeight: 700, letterSpacing: 1, position: "absolute", top: 40, left: 56 }}>◆ ACM-TRACKER</span>
        <div style={{ opacity: 0.25, position: "absolute", top: "30%", left: "10%" }}>
          <RingGauge total={1840} target={2400} aiFraction={0.18} caption="" />
        </div>
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2 }}>{t("auth.title")}</h1>
          <p style={{ color: colors.muted, marginTop: 16, maxWidth: 360 }}>
            {t("auth.subtitle")}
          </p>
        </div>
        <span className="mono" style={{ color: colors.dim, fontSize: 11, position: "absolute", bottom: 40, left: 56 }}>{t("auth.versionLine")}</span>
      </div>

      <div style={{ background: colors.bg, padding: 56, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h2 style={{ fontSize: 30, fontWeight: 700 }}>{t("auth.signInHeading")}</h2>
        <p className="mono" style={{ color: colors.muted, fontSize: 13, marginTop: 6, marginBottom: 32 }}>{t("auth.signInSubtitle")}</p>

        <label className="mono" style={{ fontSize: 11, letterSpacing: 1.5, color: colors.muted }}>EMAIL</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} aria-label="Email" style={{ ...inputStyle, marginTop: 8, marginBottom: 20 }} />

        {error && <div style={{ color: colors.coral, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <button onClick={submit} disabled={login.isPending} style={{ background: colors.coral, color: colors.bg, border: "none", borderRadius: 8, padding: "14px", fontWeight: 700, fontSize: 15 }}>
          {t("auth.signInButton")}
        </button>
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
          <span className="mono" style={{ fontSize: 12, color: colors.dim }}>{t("auth.helperText")}</span>
        </div>
      </div>
    </div>
  );
}
