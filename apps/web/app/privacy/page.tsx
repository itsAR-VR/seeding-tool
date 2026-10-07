import { LegalPage, CONTACT_EMAIL, OPERATOR } from "../legal-page";

export const metadata = { title: "Privacy Policy · Seed Scale" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 1, 2026">
      <p>
        Seed Scale is a tool run by {OPERATOR} (&quot;we&quot;) that helps brands send products to creators, track the
        posts creators make, ask for permission to reuse those posts, and run them as ads. This policy explains what
        data the tool handles and why.
      </p>

      <h2 className="text-lg font-semibold">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Brand users:</b> name, email, and login details for the people who use the tool.</li>
        <li><b>Connected accounts:</b> access tokens for the Gmail, Shopify, Instagram, Facebook Page, and Meta ad accounts a brand chooses to connect. Tokens are encrypted at rest.</li>
        <li><b>Creators:</b> public profile information (handle, name, bio, follower count) and the contact email a creator lists publicly.</li>
        <li><b>Gift claims:</b> the name and shipping address a creator enters on a gift claim form, used only to ship that brand&apos;s product.</li>
        <li><b>Brand mentions:</b> Instagram posts, reels, and stories that tag or mention a connected brand account, including copies of the media.</li>
        <li><b>Usage-rights approvals:</b> the name, date, and IP address recorded when a creator agrees to let a brand reuse their post.</li>
        <li><b>Email and messages:</b> replies creators send to a brand&apos;s outreach, so the brand can answer them.</li>
        <li><b>Ad results:</b> performance numbers for ads the brand creates through the tool.</li>
      </ul>

      <h2 className="text-lg font-semibold">How we use it</h2>
      <p>
        Only to run each brand&apos;s creator program: sending outreach, shipping gifts, collecting posts, recording
        usage rights, creating ads the brand approves, and showing results. Each brand only sees its own data.
      </p>

      <h2 className="text-lg font-semibold">Who we share it with</h2>
      <p>
        We do not sell personal information. We use service providers to run the tool: Supabase (database and file
        storage), Vercel (hosting), OpenAI (drafting suggested email replies), and the platforms a brand connects
        (Google, Shopify, and Meta). We may disclose information if the law requires it.
      </p>

      <h2 className="text-lg font-semibold">Meta and Instagram data</h2>
      <p>
        Data from Meta&apos;s platforms is used only for the features above, is never sold, and is deleted when a brand
        disconnects its account or asks us to delete it. Copies of story media are stored so the brand can see them
        after the story expires.
      </p>

      <h2 className="text-lg font-semibold">How long we keep it</h2>
      <p>
        While a brand&apos;s account is active. When a brand closes its account or disconnects a service, we delete the
        related tokens right away and the related data within 30 days, unless the law requires us to keep it.
      </p>

      <h2 className="text-lg font-semibold">Your choices</h2>
      <p>
        Creators can unsubscribe from any email using the link at the bottom. Anyone can ask us to see, correct, or
        delete their data. See <a className="underline" href="/data-deletion">how to delete your data</a>.
      </p>

      <h2 className="text-lg font-semibold">Contact</h2>
      <p>
        {OPERATOR} · <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
