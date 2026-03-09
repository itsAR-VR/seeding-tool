"use client";

import type { ReactNode } from "react";

type InstagramHandleLinkProps = {
  handle?: string | null;
  url?: string | null;
  className?: string;
  children?: ReactNode;
};

function normalizeHandle(handle: string | null | undefined) {
  return handle?.trim().replace(/^@/, "") || "";
}

export function InstagramHandleLink({
  handle,
  url,
  className,
  children,
}: InstagramHandleLinkProps) {
  const normalizedHandle = normalizeHandle(handle);

  if (!normalizedHandle) {
    return <span className={className}>{children ?? "—"}</span>;
  }

  const href = url || `https://instagram.com/${normalizedHandle}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(event) => event.stopPropagation()}
    >
      {children ?? `@${normalizedHandle}`}
    </a>
  );
}
