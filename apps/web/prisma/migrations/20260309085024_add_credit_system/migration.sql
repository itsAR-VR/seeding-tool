-- CreateTable
CREATE TABLE "brand_credit_balances" (
    "id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_credit_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "stripe_payment_intent_id" TEXT,
    "balanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_credit_balances_brandId_key" ON "brand_credit_balances"("brandId");

-- AddForeignKey
ALTER TABLE "brand_credit_balances" ADD CONSTRAINT "brand_credit_balances_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_credit_transactions" ADD CONSTRAINT "brand_credit_transactions_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "brand_credit_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
