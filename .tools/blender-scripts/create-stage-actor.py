from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "web" / "public" / "theater" / "humans" / "theater-actor-black.glb"
OUTPUT = ROOT / "web" / "public" / "theater" / "humans" / "stage-blocking-actor.glb"
SCENE_OUTPUT = ROOT / ".tools" / "blender-scenes" / "stage-blocking-actor.blend"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def set_stand_pose():
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    stand_action = next(
        (action for action in bpy.data.actions if action.name.lower() == "stand"),
        None,
    )
    for armature in armatures:
        if stand_action is not None:
            if armature.animation_data is None:
                armature.animation_data_create()
            armature.animation_data.action = stand_action
            frame = round(stand_action.frame_range[1])
            bpy.context.scene.frame_set(frame)
        armature.data.pose_position = "POSE"
    bpy.context.view_layer.update()


def bake_static_meshes():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    def belongs_to_actor(obj):
        parent = obj.parent
        while parent is not None:
            if parent.type == "ARMATURE":
                return True
            parent = parent.parent
        return any(modifier.type == "ARMATURE" for modifier in obj.modifiers)

    source_meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and belongs_to_actor(obj)
    ]
    baked_objects = []
    target_collection = bpy.context.scene.collection

    for index, source in enumerate(source_meshes):
        evaluated = source.evaluated_get(depsgraph)
        baked_mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        baked = bpy.data.objects.new(f"StageActor_{index:02d}", baked_mesh)
        baked.matrix_world = source.matrix_world.copy()
        target_collection.objects.link(baked)
        baked_objects.append(baked)

    for source in list(bpy.context.scene.objects):
        if source not in baked_objects:
            bpy.data.objects.remove(source, do_unlink=True)

    return baked_objects


def normalize_actor(objects):
    world_points = []
    for obj in objects:
        world_points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)

    min_x = min(point.x for point in world_points)
    max_x = max(point.x for point in world_points)
    min_y = min(point.y for point in world_points)
    max_y = max(point.y for point in world_points)
    min_z = min(point.z for point in world_points)
    max_z = max(point.z for point in world_points)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    actor_height = max_z - min_z
    target_height = 1.8
    uniform_scale = target_height / actor_height
    correction = Matrix.Scale(uniform_scale, 4) @ Matrix.Translation(
        (-center_x, -center_y, -min_z)
    )

    for obj in objects:
        obj.matrix_world = correction @ obj.matrix_world
        obj.select_set(True)

    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for obj in objects:
        obj.name = obj.name.replace("StageActor_", "MiseActor_")
        obj.data.name = f"{obj.name}_Mesh"
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def clean_animation_data():
    for obj in bpy.context.scene.objects:
        obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def export_actor(objects):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    SCENE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_apply=True,
        export_yup=True,
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(SCENE_OUTPUT))


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    set_stand_pose()
    objects = bake_static_meshes()
    if not objects:
        raise RuntimeError("Actor source contains no meshes")
    normalize_actor(objects)
    clean_animation_data()
    export_actor(objects)
    print(f"STAGE_ACTOR_EXPORTED={OUTPUT}")


main()
