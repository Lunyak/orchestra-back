"""Build two theater stage doors and export GLB assets.

Outputs:
  .tools/blender-scenes/stage-doors.blend
  web/public/theater/models/stage-door-wood.glb
  web/public/theater/models/stage-door-metal.glb

Sizes match layout defaults: ~1.2 x 2.2 m.
"""

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SCENE_OUTPUT = ROOT / ".tools" / "blender-scenes" / "stage-doors.blend"
ASSET_DIR = ROOT / "web" / "public" / "theater" / "models"

DOOR_W = 1.2
DOOR_H = 2.2


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def material(name, color, metallic=0.0, roughness=0.55, alpha=1.0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if alpha < 1.0 and "Alpha" in shader.inputs:
        shader.inputs["Alpha"].default_value = alpha
        result.blend_method = "BLEND"
    return result


def box(name, size, location, material_ref, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material_ref)
    if parent:
        obj.parent = parent
    return obj


def empty(name, location=(0.0, 0.0, 0.0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.object
    obj.name = name
    return obj


def build_wood_door(root_name, origin):
    width, height, thickness = DOOR_W, DOOR_H, 0.045
    root = empty(root_name, origin)
    wood = material("DoorWood", (0.42, 0.27, 0.14), 0.0, 0.72)
    wood_dark = material("DoorWoodDark", (0.28, 0.17, 0.09), 0.0, 0.78)
    frame = material("DoorFrame", (0.34, 0.22, 0.12), 0.0, 0.7)
    handle = material("DoorHandleWood", (0.72, 0.62, 0.28), 0.9, 0.28)

    frame_w = 0.07
    box(f"{root_name}_Leaf", (width, thickness, height), (0, 0, height / 2), wood, root)

    inset = 0.012
    panel_w = width - frame_w * 2
    gap = 0.06
    upper_h = 0.95
    lower_h = 0.72
    upper_z = frame_w + lower_h + gap + upper_h / 2 + 0.08
    lower_z = frame_w + lower_h / 2 + 0.08
    box(
        f"{root_name}_PanelUpper",
        (panel_w, thickness + inset, upper_h),
        (0, thickness * 0.15, upper_z),
        wood_dark,
        root,
    )
    box(
        f"{root_name}_PanelLower",
        (panel_w, thickness + inset, lower_h),
        (0, thickness * 0.15, lower_z),
        wood_dark,
        root,
    )
    mid_z = lower_z + lower_h / 2 + gap / 2
    box(
        f"{root_name}_MidRail",
        (panel_w, thickness * 1.05, gap * 0.85),
        (0, 0, mid_z),
        frame,
        root,
    )

    casing_t, casing_d = 0.06, 0.09
    box(
        f"{root_name}_CasingTop",
        (width + casing_t * 2, casing_d, casing_t),
        (0, -0.02, height + casing_t / 2),
        frame,
        root,
    )
    box(
        f"{root_name}_CasingLeft",
        (casing_t, casing_d, height),
        (-(width / 2 + casing_t / 2), -0.02, height / 2),
        frame,
        root,
    )
    box(
        f"{root_name}_CasingRight",
        (casing_t, casing_d, height),
        ((width / 2 + casing_t / 2), -0.02, height / 2),
        frame,
        root,
    )

    hx, hz = width * 0.38, 1.05
    box(
        f"{root_name}_HandlePlate",
        (0.08, 0.01, 0.16),
        (hx, thickness / 2 + 0.008, hz),
        handle,
        root,
    )
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.012,
        depth=0.09,
        location=(hx, thickness / 2 + 0.05, hz),
    )
    grip = bpy.context.object
    grip.name = f"{root_name}_Handle"
    grip.rotation_euler[0] = 1.5708
    grip.data.materials.append(handle)
    grip.parent = root
    return root


def build_metal_door(root_name, origin):
    width, height, thickness = DOOR_W, DOOR_H, 0.04
    root = empty(root_name, origin)
    metal = material("DoorMetal", (0.35, 0.38, 0.42), 0.65, 0.38)
    metal_dark = material("DoorMetalDark", (0.18, 0.2, 0.23), 0.75, 0.42)
    glass = material("DoorGlass", (0.55, 0.7, 0.82), 0.0, 0.08, alpha=0.35)
    handle = material("DoorHandleMetal", (0.72, 0.62, 0.28), 0.9, 0.28)

    box(f"{root_name}_Leaf", (width, thickness, height), (0, 0, height / 2), metal, root)
    for index, z in enumerate((0.45, 0.85, 1.35, 1.75)):
        box(
            f"{root_name}_Rib{index}",
            (width * 0.92, thickness + 0.008, 0.035),
            (0, thickness * 0.2, z),
            metal_dark,
            root,
        )

    win_w, win_h, win_z = 0.28, 0.42, 1.55
    box(
        f"{root_name}_WinFrame",
        (win_w + 0.04, thickness + 0.01, win_h + 0.04),
        (0, thickness * 0.15, win_z),
        metal_dark,
        root,
    )
    box(
        f"{root_name}_Glass",
        (win_w, thickness * 0.4, win_h),
        (0, thickness * 0.35, win_z),
        glass,
        root,
    )

    casing_t, casing_d = 0.055, 0.085
    box(
        f"{root_name}_CasingTop",
        (width + casing_t * 2, casing_d, casing_t),
        (0, -0.02, height + casing_t / 2),
        metal_dark,
        root,
    )
    box(
        f"{root_name}_CasingLeft",
        (casing_t, casing_d, height),
        (-(width / 2 + casing_t / 2), -0.02, height / 2),
        metal_dark,
        root,
    )
    box(
        f"{root_name}_CasingRight",
        (casing_t, casing_d, height),
        ((width / 2 + casing_t / 2), -0.02, height / 2),
        metal_dark,
        root,
    )

    bar_z = 1.05
    box(
        f"{root_name}_PushBar",
        (width * 0.62, 0.025, 0.03),
        (0, thickness / 2 + 0.02, bar_z),
        handle,
        root,
    )
    box(
        f"{root_name}_PushLeft",
        (0.03, 0.04, 0.08),
        (-width * 0.28, thickness / 2 + 0.02, bar_z),
        handle,
        root,
    )
    box(
        f"{root_name}_PushRight",
        (0.03, 0.04, 0.08),
        (width * 0.28, thickness / 2 + 0.02, bar_z),
        handle,
        root,
    )
    box(
        f"{root_name}_Kick",
        (width * 0.96, thickness + 0.006, 0.22),
        (0, thickness * 0.15, 0.14),
        metal_dark,
        root,
    )
    return root


def join_under_root(root_name, export_name, x_pos):
    root = bpy.data.objects[root_name]
    meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.parent == root
    ]
    for obj in meshes:
        matrix_world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = matrix_world

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = export_name

    corners = [joined.matrix_world @ Vector(corner) for corner in joined.bound_box]
    min_x = min(corner.x for corner in corners)
    max_x = max(corner.x for corner in corners)
    min_y = min(corner.y for corner in corners)
    max_y = max(corner.y for corner in corners)
    min_z = min(corner.z for corner in corners)
    bpy.context.scene.cursor.location = (
        (min_x + max_x) / 2,
        (min_y + max_y) / 2,
        min_z,
    )
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    joined.location = (x_pos, 0.0, 0.0)

    bpy.data.objects.remove(root, do_unlink=True)
    return joined


def export_glb(obj, filename):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    old_location = obj.location.copy()
    obj.location = (0.0, 0.0, 0.0)
    path = ASSET_DIR / filename
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    obj.location = old_location
    print("exported", path)


def main():
    clear_scene()
    build_wood_door("StageDoorWood", (-1.1, 0.0, 0.0))
    build_metal_door("StageDoorMetal", (1.1, 0.0, 0.0))
    wood = join_under_root("StageDoorWood", "StageDoorWood", -1.1)
    metal = join_under_root("StageDoorMetal", "StageDoorMetal", 1.1)

    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "PreviewFloor"
    floor_mat = material("PreviewFloorMat", (0.18, 0.18, 0.2), 0.0, 0.9)
    floor.data.materials.append(floor_mat)

    bpy.ops.object.light_add(type="AREA", location=(0, -2.5, 2.8))
    light = bpy.context.object
    light.data.energy = 400
    light.data.size = 3
    light.rotation_euler = (1.1, 0, 0)

    bpy.ops.object.camera_add(location=(3.8, -4.2, 1.8), rotation=(1.2, 0, 0.75))
    camera = bpy.context.object
    camera.name = "DoorCam"
    bpy.context.scene.camera = camera

    SCENE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SCENE_OUTPUT))
    export_glb(wood, "stage-door-wood.glb")
    export_glb(metal, "stage-door-metal.glb")
    print("saved", SCENE_OUTPUT)


if __name__ == "__main__":
    main()
