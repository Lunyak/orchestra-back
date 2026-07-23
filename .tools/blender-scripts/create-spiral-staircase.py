from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "web" / "public" / "theater" / "library"
SCENE_OUTPUT = ROOT / ".tools" / "blender-scenes" / "spiral-staircase.blend"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def material(name, color, metallic, roughness):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return result


def add_cylinder(name, radius, depth, location, material_ref, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material_ref)
    return obj


def add_wedge_step(name, angle, z, step_angle, material_ref):
    inner_radius = 0.17
    outer_radius = 1.02
    thickness = 0.085
    half_angle = step_angle * 0.64
    angles = (angle - half_angle, angle + half_angle)
    top_z = z + thickness
    vertices = []
    for height in (z, top_z):
        for radius in (inner_radius, outer_radius):
            for current_angle in angles:
                vertices.append(
                    (
                        radius * cos(current_angle),
                        radius * sin(current_angle),
                        height,
                    )
                )
    faces = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material_ref)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bevel = obj.modifiers.new("Soft step edges", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    return obj


def add_rail_curve(name, points, material_ref, detail):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2 if detail else 1
    curve.bevel_depth = 0.035
    curve.bevel_resolution = 3 if detail else 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    curve.materials.append(material_ref)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_staircase(detail):
    step_count = 18 if detail else 14
    stair_height = 3.0
    rail_height = 0.92
    step_angle = 2 * pi / step_count
    rise = stair_height / step_count
    metal = material("Blackened steel", (0.025, 0.03, 0.035), 0.82, 0.22)
    wood = material("Dark oak treads", (0.17, 0.075, 0.028), 0.05, 0.36)

    add_cylinder(
        "Central mast",
        0.115,
        stair_height + rail_height + 0.12,
        (0, 0, (stair_height + rail_height) / 2),
        metal,
        32 if detail else 16,
    )
    add_cylinder("Base plate", 0.29, 0.055, (0, 0, 0.0275), metal, 32 if detail else 16)

    rail_points = []
    for index in range(step_count + 1):
        angle = index * step_angle
        step_z = index * rise
        if index < step_count:
            add_wedge_step(
                f"Step_{index + 1:02d}",
                angle,
                step_z,
                step_angle,
                wood,
            )
        outer_x = 0.98 * cos(angle)
        outer_y = 0.98 * sin(angle)
        post_height = rail_height
        add_cylinder(
            f"Railing post_{index + 1:02d}",
            0.027,
            post_height,
            (outer_x, outer_y, step_z + post_height / 2 + 0.06),
            metal,
            12 if detail else 8,
        )
        rail_points.append((outer_x, outer_y, step_z + rail_height + 0.06))

        if detail and index < step_count:
            middle_radius = 0.98
            middle_angle = angle + step_angle * 0.5
            middle_z = step_z + rise * 0.5
            add_cylinder(
                f"Railing spindle_{index + 1:02d}",
                0.012,
                rail_height * 0.78,
                (
                    middle_radius * cos(middle_angle),
                    middle_radius * sin(middle_angle),
                    middle_z + rail_height * 0.39 + 0.06,
                ),
                metal,
                8,
            )

    add_rail_curve("Spiral handrail", rail_points, metal, detail)

    landing_angle = step_count * step_angle
    add_wedge_step(
        "Top landing",
        landing_angle,
        stair_height,
        step_angle * 1.35,
        wood,
    )

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = obj.name not in {"Top landing"} and not obj.name.startswith("Step_")


def export_asset(filename):
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(ASSET_DIR / filename),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_apply=True,
        export_yup=True,
    )


def main():
    clear_scene()
    build_staircase(detail=True)
    export_asset("spiral-staircase.glb")
    bpy.ops.wm.save_as_mainfile(filepath=str(SCENE_OUTPUT))

    clear_scene()
    build_staircase(detail=False)
    export_asset("spiral-staircase-low.glb")
    print(f"SPIRAL_STAIRCASE_EXPORTED={ASSET_DIR}")


main()
