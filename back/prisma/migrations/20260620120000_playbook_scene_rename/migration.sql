-- Playbook / Scene domain rename: Scene→Playbook, Step→Scene

ALTER TABLE "Scene" RENAME TO "Playbook";
ALTER TABLE "Step" RENAME TO "Scene";
ALTER TABLE "Scene" RENAME COLUMN "sceneId" TO "playbookId";

ALTER TABLE "StepRequisite" RENAME TO "SceneRequisite";
ALTER TABLE "SceneRequisite" RENAME COLUMN "stepId" TO "sceneId";

ALTER TABLE "StepLightPlot" RENAME TO "SceneLightPlot";
ALTER TABLE "SceneLightPlot" RENAME COLUMN "stepId" TO "sceneId";

ALTER TABLE "TheaterModel" RENAME COLUMN "stepId" TO "sceneId";
ALTER TABLE "TheaterSpotlight" RENAME COLUMN "stepId" TO "sceneId";

ALTER TABLE "PlaylistItem" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "Sound" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "GlobalLightChannel" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "GlobalLightPlot" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "TheaterLayout" RENAME COLUMN "sceneId" TO "playbookId";

ALTER TABLE "ActorNote" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "ActorNote" RENAME COLUMN "stepSourceId" TO "sceneSourceId";

ALTER TABLE "ActorAnnotation" RENAME COLUMN "sceneId" TO "playbookId";
ALTER TABLE "ActorAnnotation" RENAME COLUMN "stepSourceId" TO "sceneSourceId";

ALTER TABLE "Rehearsal" RENAME COLUMN "selectedSceneIds" TO "selectedPlaybookIds";
ALTER TABLE "Rehearsal" RENAME COLUMN "selectedSteps" TO "selectedScenes";

ALTER TABLE "ProjectTask" RENAME COLUMN "refStepId" TO "refSceneId";
