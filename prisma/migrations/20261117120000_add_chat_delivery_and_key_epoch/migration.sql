-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "keyEpoch" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "lastDeliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "keyEpoch" INTEGER NOT NULL DEFAULT 1;
