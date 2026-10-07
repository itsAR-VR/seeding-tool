import type { ReactNode } from "react";
import { SettingsBackLink } from "@/app/(platform)/settings/_components/settings-back-link";

export default function SettingsSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsBackLink />
      {children}
    </>
  );
}
