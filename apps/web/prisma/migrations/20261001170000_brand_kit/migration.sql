ALTER TABLE "brands" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "brands" ADD COLUMN "sender_first_name" TEXT;
ALTER TABLE "brands" ADD COLUMN "brand_description" TEXT;
ALTER TABLE "brands" ADD COLUMN "product_facts" TEXT;
ALTER TABLE "brands" ADD COLUMN "reply_examples" TEXT;
ALTER TABLE "brands" ADD COLUMN "follow_up_template" TEXT;
ALTER TABLE "brands" ADD COLUMN "ad_default_text" TEXT;
ALTER TABLE "brands" ADD COLUMN "ad_default_headline" TEXT;
ALTER TABLE "brands" ADD COLUMN "ad_default_link" TEXT;
ALTER TABLE "brands" ADD COLUMN "ship_countries" TEXT[] NOT NULL DEFAULT ARRAY['US']::TEXT[];

-- Kalm's existing content moves into Kalm's brand kit (it was hard-coded before).
UPDATE "brands" SET
  "logo_url" = '/kalm-logo.png',
  "sender_first_name" = 'Kam',
  "brand_description" = 'Kalm, a women''s wellness brand. The gift is Kalm mouth tape (a 30-strip pack).',
  "product_facts" = '- The gift is Kalm mouth tape (a 30-strip pack). It is completely free: Kam covers the product and the shipping. No card or payment is ever needed.
- Kalm''s mouth tape helps you breathe through your nose while you sleep, so you sleep deeper and wake up more rested.
- How to use it: at bedtime, place one strip over closed lips.
- What''s in it / how it''s different: the strips are infused with aloe, collagen, vitamin E, vitamin B5, biotin and CoQ10. The material is softer and stretchier than regular mouth tape, so it''s gentler on sensitive or dry skin. It isn''t a plain KT-tape-style strip.
- Sensitive skin: Kalm developed it to be gentle on sensitive skin. Suggest testing one on a small patch of skin first.
- Posting: use this answer, word for word: "I''d love for you to try it first, and share only if you love it!" Don''t say they don''t have to post.
- Two packs: yes, Kam is happy to send 2 (for example one for a partner).
- Shipping: US only right now. If they''re outside the US, thank them, say we can only ship within the US right now, that Kam would love to send one once we can ship there, and leave the link out.
- Health conditions (sleep apnea, CPAP, breathing or medical conditions, pregnancy): say "I''d check with your doctor first." Make no health claims.
- Website: sleepkalm.com
- To get one, they add their shipping address at a private link. Write the link exactly as {address link} and never invent a URL.',
  "reply_examples" = 'Their reply: how does this work and do I have to pay shipping?
Good answer:
There''s no cost at all, and shipping is on us. Here''s a link to add your shipping info, and I''ll get it out to you shortly:
{address link}

Their reply: Do I have to post about it?
Good answer:
I''d love for you to try it first, and share only if you love it! Here''s a link to add your shipping info, and I''ll get it out to you shortly:
{address link}

Their reply: Could you send 2? One for my husband
Good answer:
Of course, happy to send two! Here''s a link to add your shipping info, and I''ll get them out to you shortly:
{address link}

Their reply: I already use mouth tape, what makes yours different?
Good answer:
Ours are softer and stretchier than regular mouth tape, and they''re infused with aloe, collagen, vitamins E and B5, biotin and CoQ10, so they''re much gentler on skin! Here''s a link to add your shipping info, and I''ll get it out to you shortly:
{address link}

Their reply: What''s in the tape? I have really sensitive skin.
Good answer:
We made them to be gentle on sensitive skin, and they''re infused with aloe, collagen, vitamins E and B5, biotin and CoQ10! I''d suggest testing one on a small patch of skin first. Here''s a link to add your shipping info, and I''ll get it out to you shortly:
{address link}

Their reply: I have sleep apnea and use a CPAP. Is it safe for me?
Good answer:
I''d recommend checking with your doctor first. If they''re comfortable with it, here''s a link to add your shipping info:
{address link}

Their reply: I''m in Toronto, do you ship to Canada?
Good answer:
Thanks for asking! We can only ship within the US right now, but I''d love to send you one once we''re able to ship to Canada.',
  "follow_up_template" = 'Yay! Can''t wait for you to try it. Here''s a link to add your shipping info, and I''ll get it out to you shortly:
{address link}

I''ll let you know when it ships.',
  "ad_default_text" = 'Kalm mouth tape helps you breathe through your nose while you sleep, so you wake up more rested.',
  "ad_default_headline" = 'Support better sleep, naturally',
  "ad_default_link" = 'https://sleepkalm.com/products/mouth-tape'
WHERE "id" = 'c70e5d66-256e-4388-a33e-a2081c5799e0';
