export default function DashboardPage() {
  return (
    <section
      style={{
        borderRadius: "2rem",
        border: "1px solid rgba(27, 21, 37, 0.08)",
        background: "rgba(255, 255, 255, 0.85)",
        padding: "2rem",
        boxShadow: "0 18px 50px rgba(17, 13, 25, 0.08)",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.24em", opacity: 0.62, textTransform: "uppercase" }}>
        Platform shell
      </p>
      <h1 style={{ margin: "1rem 0 0", fontSize: "2.5rem", lineHeight: 1.05 }}>Dashboard scaffold</h1>
      <p style={{ maxWidth: "42rem", margin: "0.75rem 0 0", fontSize: "1rem", lineHeight: 1.7, opacity: 0.72 }}>
        Phase 9a establishes the authenticated product shell, runtime helpers, and route topology. Real auth, tenancy, and data-backed dashboard content land in 9c.
      </p>
    </section>
  );
}
