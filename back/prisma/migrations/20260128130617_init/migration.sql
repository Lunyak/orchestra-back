-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxProjects" INTEGER,
    "maxCollaboratorsPerProject" INTEGER,
    "features" JSONB NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawJson" JSONB,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "fadeMs" INTEGER NOT NULL,
    "loop" BOOLEAN NOT NULL,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sound" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "icon" TEXT,
    "volume" DOUBLE PRECISION NOT NULL,
    "fadeMs" INTEGER NOT NULL,
    "loop" BOOLEAN NOT NULL,

    CONSTRAINT "Sound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT,
    "playMarkdown" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepRequisite" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StepRequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepLightPlot" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "channel" TEXT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "angle" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,

    CONSTRAINT "StepLightPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheaterModel" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "builtin" TEXT,
    "allowOutOfBounds" BOOLEAN NOT NULL DEFAULT false,
    "position" JSONB NOT NULL,
    "rotation" JSONB NOT NULL,
    "scale" JSONB NOT NULL,

    CONSTRAINT "TheaterModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheaterSpotlight" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "target" JSONB NOT NULL,
    "angleDeg" INTEGER NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "channel" INTEGER NOT NULL,
    "isRgb" BOOLEAN NOT NULL,

    CONSTRAINT "TheaterSpotlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLightChannel" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "index" INTEGER NOT NULL,

    CONSTRAINT "GlobalLightChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLightPlot" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "angle" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,

    CONSTRAINT "GlobalLightPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheaterLayout" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "hallWidth" INTEGER NOT NULL,
    "hallDepth" INTEGER NOT NULL,
    "wallHeight" INTEGER NOT NULL,
    "stageWidth" INTEGER NOT NULL,
    "stageDepth" INTEGER NOT NULL,
    "stageHeight" INTEGER NOT NULL,
    "stageZ" INTEGER NOT NULL,
    "audienceStartZ" INTEGER NOT NULL,
    "seatRows" INTEGER NOT NULL,
    "seatsPerRow" INTEGER NOT NULL,
    "seatSpacing" DOUBLE PRECISION NOT NULL,
    "rowSpacing" DOUBLE PRECISION NOT NULL,
    "aisleWidth" DOUBLE PRECISION NOT NULL,
    "aisleCenterX" DOUBLE PRECISION NOT NULL,
    "doorWidth" DOUBLE PRECISION NOT NULL,
    "doorHeight" DOUBLE PRECISION NOT NULL,
    "doorZ" DOUBLE PRECISION NOT NULL,
    "rowRise" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TheaterLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectModelFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectModelFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TheaterLayout_sceneId_key" ON "TheaterLayout"("sceneId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sound" ADD CONSTRAINT "Sound_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepRequisite" ADD CONSTRAINT "StepRequisite_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepLightPlot" ADD CONSTRAINT "StepLightPlot_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheaterModel" ADD CONSTRAINT "TheaterModel_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheaterSpotlight" ADD CONSTRAINT "TheaterSpotlight_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "Step"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalLightChannel" ADD CONSTRAINT "GlobalLightChannel_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalLightPlot" ADD CONSTRAINT "GlobalLightPlot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheaterLayout" ADD CONSTRAINT "TheaterLayout_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModelFile" ADD CONSTRAINT "ProjectModelFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
