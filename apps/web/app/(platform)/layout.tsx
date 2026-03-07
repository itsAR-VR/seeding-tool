import type { ReactNode } from "react";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" },
];

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "80rem",
          minHeight: "100vh",
          margin: "0 auto",
          padding: "2rem 1.5rem",
          display: "grid",
          gap: "1.5rem",
          alignItems: "start",
          gridTemplateColumns: "18rem minmax(0, 1fr)",
        }}
      >
        <aside
          style={{
            borderRadius: "2rem",
            border: "1px solid rgba(27, 21, 37, 0.08)",
            background: "rgba(255, 255, 255, 0.82)",
            padding: "1.5rem",
            boxShadow: "0 18px 50px rgba(17, 13, 25, 0.08)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.24em", opacity: 0.62, textTransform: "uppercase" }}>
            Seed Scale
          </p>
          <nav style={{ marginTop: "1.5rem", display: "grid", gap: "0.5rem" }}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.85rem 1rem",
                  borderRadius: "1rem",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "inherit",
                  background: "rgba(246, 241, 231, 0.5)",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
