export default function LoginPage() {
  return (
    <section style={{ minHeight: "100vh", padding: "4rem 1.5rem" }}>
      <div
        style={{
          maxWidth: "48rem",
          margin: "0 auto",
          padding: "2.5rem",
          borderRadius: "2rem",
          border: "1px solid rgba(27, 21, 37, 0.08)",
          background: "rgba(255, 255, 255, 0.82)",
          boxShadow: "0 18px 50px rgba(17, 13, 25, 0.08)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.24em", opacity: 0.62, textTransform: "uppercase" }}>
          Platform
        </p>
        <h1 style={{ margin: "1rem 0 0", fontSize: "2.5rem", lineHeight: 1.05 }}>Log in</h1>
        <p style={{ maxWidth: "40rem", margin: "0.75rem 0 0", fontSize: "1rem", lineHeight: 1.7, opacity: 0.72 }}>
          Supabase auth, session recovery, and organization-aware redirects land in Phase 9c. This route is the permanent shell target.
        </p>
      </div>
    </section>
  );
}
