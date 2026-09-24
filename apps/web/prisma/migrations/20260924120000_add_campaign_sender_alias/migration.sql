-- AlterTable
ALTER TABLE "email_aliases" ADD COLUMN "encrypted_refresh_token" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "sender_alias_id" TEXT;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sender_alias_id_fkey" FOREIGN KEY ("sender_alias_id") REFERENCES "email_aliases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
