import { LegalPage, CONTACT_EMAIL } from "../legal-page";

export const metadata = { title: "Delete Your Data · Seed Scale" };

export default function DataDeletionPage() {
  return (
    <LegalPage title="How to delete your data" updated="October 1, 2026">
      <h2 className="text-lg font-semibold">Brands</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>To stop sharing data right away, go to Settings → Connections in Seed Scale and click Disconnect on Gmail, Shopify, or Instagram. This deletes the saved access for that service.</li>
        <li>To delete your whole account and all of its data, email us from your account&apos;s email address.</li>
      </ol>

      <h2 className="text-lg font-semibold">Creators</h2>
      <p>
        Email us with your Instagram handle and the email address a brand contacted you at. We&apos;ll delete your
        profile, messages, address, and saved posts from the brand&apos;s account, and add you to the do-not-contact list.
      </p>

      <h2 className="text-lg font-semibold">Facebook and Instagram users</h2>
      <p>
        You can also remove the app in your Facebook settings under Apps and Websites (or Business Integrations).
        Then email us and we&apos;ll delete any data we received through it.
      </p>

      <p>
        Email: <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=Delete my data`}>{CONTACT_EMAIL}</a>. We
        confirm deletion within 30 days.
      </p>
    </LegalPage>
  );
}
