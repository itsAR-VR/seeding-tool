# Meta App Review package: "Kalm Seeding" (app 1121534507214855)

Submit after KALM WELLNESS LLC business verification clears (submitted 2026-10-01; Meta quoted up to 48 hours).

- App URL: https://kalm-seeding.vercel.app
- Privacy policy: https://kalm-seeding.vercel.app/privacy
- Data deletion: https://kalm-seeding.vercel.app/data-deletion
- Test login for reviewers: create a reviewer user in the tool before submitting, and keep its password out of this file.

## What the app does (one paragraph for the review form)

Seed Scale helps a brand run a creator gifting program. The brand connects its own Instagram professional account, Facebook Page, and Meta ad account. The app collects the brand's tagged posts, caption mentions, and story mentions so the brand can see what creators posted. It records the creator's permission to reuse a post, and turns approved posts into paused ads in the brand's own ad account. A person at the brand reviews and launches every ad. The app never posts or sends ads automatically.

## Permissions to request (Advanced Access)

| Permission | Why we need it | Where the reviewer sees it |
|---|---|---|
| instagram_basic | Read the connected brand account's profile and the posts it's tagged in | Content page |
| instagram_manage_comments | Receive `mentions` webhooks when a creator @mentions the brand in a caption | Content page, "Caption mention" label |
| instagram_manage_insights | Show the brand how creator posts that tag it performed | Content and Ads pages |
| instagram_manage_messages | Receive story mentions (Meta delivers them as messages) and save the story before it expires | Content page, "Story" label |
| pages_show_list | Let the brand pick which Facebook Page and linked Instagram account to connect | Settings → Connections |
| pages_read_engagement | Read the Page's linked Instagram account and Page token | Settings → Connections |
| pages_manage_metadata | Subscribe the brand's Page to webhooks for mentions and story mentions | Happens on connect |
| business_management | Find the brand's business and use the partnership ads content API | Ads page |
| ads_management | Create PAUSED campaigns, ad sets, and ads in the brand's own ad account from approved posts | Content → Create ad |
| ads_read | Show spend, clicks, CTR, CPC, and purchases for those ads | Ads page |
| instagram_branded_content_ads_brand | Create partnership ads from a creator's partnership ad code | Ads → "Got a partnership code" |

## Screen recording script (one video, about 3 minutes)

Record at https://kalm-seeding.vercel.app, logged in as the brand.

1. **Connect.** Settings → Connections → Connect Instagram. Show the Facebook login asking for the permissions above, pick the Page and Instagram account, and land back on "Connected". *(pages_show_list, pages_read_engagement, business_management, pages_manage_metadata)*
2. **Content.** Open Content → Check for new posts. Show tagged posts appear. Point to a "Story" and a "Caption mention" card. *(instagram_basic, instagram_manage_messages, instagram_manage_comments)*
3. **Usage rights.** Click Request rights → Create request → copy the message. Open the link in a private window, type a name, and click I agree. Back on Content, the card says "Rights approved". *(no Meta permission; shows consent before any ad)*
4. **Create a paused ad.** On the approved card, click Create ad → Create paused ad. Open Ads Manager from the Ads page and show the ad is PAUSED. *(ads_management)*
5. **Partnership code.** Ads page → paste a partnership ad code → Create paused ad. Show it in Ads Manager with both handles. *(instagram_branded_content_ads_brand)*
6. **Results.** Ads page shows status, spend, clicks, CTR, and purchases. *(ads_read, instagram_manage_insights)*
7. **Disconnect.** Settings → Connections → Disconnect to show the brand can revoke access.

## Before submitting

- [ ] Business verification approved
- [ ] Reviewer test user created in the tool
- [ ] Every permission above has had at least one API call in the last 30 days (connect + run each step once)
- [ ] Data Use Checkup and Data Handling questions answered in the dashboard
- [ ] Recording uploaded for each permission (the same video can be reused)
