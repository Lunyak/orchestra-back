-- CreateTable
CREATE TABLE "ChatConversationReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversationReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversationReadState_userId_conversationId_key" ON "ChatConversationReadState"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "ChatConversationReadState_userId_idx" ON "ChatConversationReadState"("userId");

-- CreateIndex
CREATE INDEX "ChatConversationReadState_conversationId_idx" ON "ChatConversationReadState"("conversationId");

-- AddForeignKey
ALTER TABLE "ChatConversationReadState" ADD CONSTRAINT "ChatConversationReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversationReadState" ADD CONSTRAINT "ChatConversationReadState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
