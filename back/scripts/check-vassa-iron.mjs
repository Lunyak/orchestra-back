import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = 'vassa-iron';
  const project = await prisma.project.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!project) {
    console.log('Project not found');
    return;
  }

  const playbooks = await prisma.playbook.findMany({
    where: { projectId: project.id },
  });
  const playbookIds = playbooks.map((p) => p.id);

  const scenes = await prisma.scene.findMany({
    where: { playbookId: { in: playbookIds }, deletedAt: null },
    orderBy: [{ playbookId: 'asc' }, { order: 'asc' }],
    select: {
      id: true,
      playbookId: true,
      sourceId: true,
      title: true,
      order: true,
    },
  });

  const scriptPlaybook =
    playbooks.find((p) => p.id === `${project.id}:script`) ??
    playbooks.find((p) => p.name === 'script');

  console.log('project:', { id: project.id, slug: project.slug, name: project.name });
  console.log('playbooks:', playbooks.length, playbooks.map((p) => ({ id: p.id, name: p.name })));
  console.log('scriptPlaybookId:', scriptPlaybook?.id ?? null);
  console.log('scenes total:', scenes.length);
  console.log(
    'scenes for script playbook:',
    scenes.filter((s) => s.playbookId === scriptPlaybook?.id).length,
  );
  console.log('sample scene fields:', scenes[0] ?? null);

  // Simulate client filter (old bug)
  const playbookId = scriptPlaybook?.id ?? '';
  const oldFilter = scenes.filter(
    (s) => String(s.sceneId ?? '') === playbookId,
  );
  const newFilter = scenes.filter(
    (s) => String(s.playbookId ?? s.sceneId ?? '') === playbookId,
  );
  console.log('old client filter (sceneId):', oldFilter.length);
  console.log('new client filter (playbookId):', newFilter.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
