from math import atan2, pi
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "client" / "public" / "team-figures"
SCENE_OUTPUT = ROOT / ".tools" / "blender-scenes" / "dofamin-team-samples.blend"


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


def make_material(name, color, metallic=0.0, roughness=0.55):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return result


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def add_sphere(name, location, scale, material_ref, segments=28, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material_ref)
    return smooth(obj)


def add_cylinder(name, start, end, radius, material_ref, vertices=20):
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) / 2
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material_ref)
    return smooth(obj)


def add_capsule(name, start, end, radius, material_ref):
    add_cylinder(name, start, end, radius, material_ref)
    add_sphere(f"{name}_A", start, (radius, radius, radius), material_ref, 20, 12)
    add_sphere(f"{name}_B", end, (radius, radius, radius), material_ref, 20, 12)


def add_face(head_center, skin, iris, brow, face_width=1.0):
    hx, hy, hz = head_center
    eye_z = hz + 0.045
    eye_x = 0.095 * face_width
    eye_y = hy - 0.255
    white = make_material("Eye white", (0.94, 0.93, 0.88), roughness=0.35)
    dark = make_material("Pupil", (0.015, 0.012, 0.01), roughness=0.3)
    lip = make_material("Lips", (0.42, 0.12, 0.11), roughness=0.48)

    for side in (-1, 1):
        add_sphere(
            f"Eye_{side}",
            (hx + side * eye_x, eye_y, eye_z),
            (0.056, 0.022, 0.036),
            white,
            20,
            12,
        )
        add_sphere(
            f"Iris_{side}",
            (hx + side * eye_x, eye_y - 0.021, eye_z),
            (0.024, 0.011, 0.024),
            iris,
            16,
            10,
        )
        add_sphere(
            f"Pupil_{side}",
            (hx + side * eye_x, eye_y - 0.032, eye_z),
            (0.01, 0.006, 0.01),
            dark,
            12,
            8,
        )
        add_capsule(
            f"Brow_{side}",
            (hx + side * (eye_x - 0.052), eye_y - 0.018, eye_z + 0.07),
            (hx + side * (eye_x + 0.055), eye_y - 0.012, eye_z + 0.078),
            0.012,
            brow,
        )

    add_sphere(
        "Nose",
        (hx, hy - 0.286, hz - 0.015),
        (0.038, 0.035, 0.065),
        skin,
        20,
        12,
    )
    add_capsule(
        "Mouth",
        (hx - 0.055, hy - 0.276, hz - 0.105),
        (hx + 0.055, hy - 0.276, hz - 0.105),
        0.014,
        lip,
    )


def add_hair_locks(center, material_ref, style):
    x, y, z = center
    if style == "long-wavy":
        locks = [
            (-0.25, 0.0, 0.04, 0.22, 0.18, 0.34),
            (0.25, 0.0, 0.04, 0.22, 0.18, 0.34),
            (-0.31, 0.015, -0.22, 0.17, 0.14, 0.35),
            (0.31, 0.015, -0.22, 0.17, 0.14, 0.35),
            (-0.28, 0.02, -0.47, 0.14, 0.12, 0.28),
            (0.28, 0.02, -0.47, 0.14, 0.12, 0.28),
            (0, 0.15, 0.08, 0.31, 0.2, 0.33),
        ]
    elif style == "shoulder":
        locks = [
            (-0.24, 0.015, 0.04, 0.2, 0.16, 0.3),
            (0.24, 0.015, 0.04, 0.2, 0.16, 0.3),
            (-0.27, 0.02, -0.22, 0.15, 0.13, 0.28),
            (0.27, 0.02, -0.22, 0.15, 0.13, 0.28),
            (0, 0.15, 0.09, 0.3, 0.19, 0.31),
        ]
    else:
        locks = [
            (-0.19, 0.03, 0.09, 0.16, 0.14, 0.2),
            (0.17, 0.02, 0.1, 0.17, 0.14, 0.22),
            (-0.09, -0.01, 0.19, 0.16, 0.13, 0.18),
            (0.08, 0.0, 0.2, 0.18, 0.14, 0.19),
            (0, 0.15, 0.08, 0.29, 0.17, 0.27),
        ]

    for index, (dx, dy, dz, sx, sy, sz) in enumerate(locks):
        add_sphere(
            f"Hair_{index:02d}",
            (x + dx, y + dy, z + dz),
            (sx, sy, sz),
            material_ref,
            24,
            14,
        )


def add_body(
    *,
    height,
    body_width,
    hip_width,
    skin,
    outfit,
    shoes,
    pose,
):
    scale = height / 1.75
    shoulder_z = 1.48 * scale
    hip_z = 0.92 * scale
    knee_z = 0.5 * scale
    head_z = 1.73 * scale
    neck_z = 1.47 * scale

    add_sphere(
        "Torso",
        (0, 0, 1.2 * scale),
        (body_width, 0.22 * scale, 0.43 * scale),
        outfit,
    )
    add_sphere(
        "Hips",
        (0, 0, hip_z),
        (hip_width, 0.2 * scale, 0.22 * scale),
        outfit,
    )
    add_cylinder(
        "Neck",
        (0, 0, neck_z - 0.1 * scale),
        (0, 0, neck_z + 0.12 * scale),
        0.09 * scale,
        skin,
    )

    leg_x = hip_width * 0.55
    for side in (-1, 1):
        add_capsule(
            f"UpperLeg_{side}",
            (side * leg_x, 0, hip_z),
            (side * leg_x * 0.82, 0, knee_z),
            0.105 * scale,
            outfit,
        )
        add_capsule(
            f"LowerLeg_{side}",
            (side * leg_x * 0.82, 0, knee_z),
            (side * leg_x * 0.78, 0, 0.13 * scale),
            0.085 * scale,
            outfit,
        )
        add_sphere(
            f"Shoe_{side}",
            (side * leg_x * 0.78, -0.07 * scale, 0.07 * scale),
            (0.11 * scale, 0.2 * scale, 0.07 * scale),
            shoes,
            22,
            12,
        )

    shoulder_x = body_width * 0.88
    if pose == "hands-front":
        elbows = ((-0.35 * scale, -0.02, 1.02 * scale), (0.35 * scale, -0.02, 1.02 * scale))
        hands = ((-0.1 * scale, -0.18, 0.76 * scale), (0.1 * scale, -0.18, 0.76 * scale))
    elif pose == "hands-hips":
        elbows = ((-0.48 * scale, 0, 1.08 * scale), (0.48 * scale, 0, 1.08 * scale))
        hands = ((-0.25 * scale, -0.18, 0.96 * scale), (0.25 * scale, -0.18, 0.96 * scale))
    else:
        elbows = ((-0.32 * scale, 0.08, 1.08 * scale), (0.32 * scale, 0.08, 1.08 * scale))
        hands = ((-0.22 * scale, 0.16, 0.82 * scale), (0.22 * scale, 0.16, 0.82 * scale))

    for index, side in enumerate((-1, 1)):
        shoulder = (side * shoulder_x, 0, shoulder_z)
        elbow = elbows[index]
        hand = hands[index]
        add_capsule(f"UpperArm_{side}", shoulder, elbow, 0.075 * scale, outfit)
        add_capsule(f"Forearm_{side}", elbow, hand, 0.06 * scale, skin)
        add_sphere(
            f"Hand_{side}",
            hand,
            (0.07 * scale, 0.045 * scale, 0.09 * scale),
            skin,
            20,
            12,
        )

    return (0, -0.01 * scale, head_z), scale


def add_head(name, center, scale, skin, hair, iris, hair_style, face_shape):
    face_scales = {
        "broad": (0.29, 0.25, 0.34),
        "oval": (0.265, 0.235, 0.35),
        "angular": (0.27, 0.235, 0.345),
    }
    base_scale = face_scales[face_shape]
    head_scale = tuple(value * scale for value in base_scale)
    add_sphere(name, center, head_scale, skin, 36, 24)
    add_hair_locks(center, hair, hair_style)
    add_face(center, skin, iris, hair, face_width=head_scale[0] / (0.27 * scale))


def build_anastasia():
    skin = make_material("Anastasia skin", (0.72, 0.47, 0.34), roughness=0.48)
    hair = make_material("Anastasia auburn hair", (0.18, 0.055, 0.028), roughness=0.42)
    outfit = make_material("Anastasia black outfit", (0.018, 0.02, 0.022), roughness=0.72)
    shoes = make_material("Anastasia shoes", (0.008, 0.009, 0.01), metallic=0.08, roughness=0.3)
    iris = make_material("Anastasia eyes", (0.18, 0.28, 0.22), roughness=0.3)
    center, scale = add_body(
        height=1.7,
        body_width=0.34,
        hip_width=0.31,
        skin=skin,
        outfit=outfit,
        shoes=shoes,
        pose="hands-front",
    )
    add_head("Anastasia head", center, scale, skin, hair, iris, "long-wavy", "broad")


def build_victoria():
    skin = make_material("Victoria skin", (0.78, 0.54, 0.4), roughness=0.46)
    hair = make_material("Victoria auburn hair", (0.16, 0.035, 0.024), roughness=0.4)
    outfit = make_material("Victoria black outfit", (0.015, 0.017, 0.019), roughness=0.68)
    shoes = make_material("Victoria shoes", (0.008, 0.009, 0.011), metallic=0.1, roughness=0.28)
    iris = make_material("Victoria eyes", (0.3, 0.42, 0.36), roughness=0.3)
    center, scale = add_body(
        height=1.67,
        body_width=0.285,
        hip_width=0.27,
        skin=skin,
        outfit=outfit,
        shoes=shoes,
        pose="hands-hips",
    )
    add_head("Victoria head", center, scale, skin, hair, iris, "shoulder", "oval")


def build_alexey():
    skin = make_material("Alexey skin", (0.7, 0.44, 0.31), roughness=0.5)
    hair = make_material("Alexey dark hair", (0.025, 0.018, 0.016), roughness=0.52)
    outfit = make_material("Alexey black outfit", (0.012, 0.014, 0.016), roughness=0.74)
    shoes = make_material("Alexey boots", (0.006, 0.007, 0.008), metallic=0.12, roughness=0.26)
    iris = make_material("Alexey eyes", (0.2, 0.16, 0.11), roughness=0.32)
    tattoo_blue = make_material("Alexey tattoo blue", (0.02, 0.16, 0.2), roughness=0.6)
    tattoo_red = make_material("Alexey tattoo red", (0.45, 0.07, 0.035), roughness=0.6)
    metal = make_material("Alexey jewelry", (0.4, 0.42, 0.44), metallic=0.9, roughness=0.22)
    center, scale = add_body(
        height=1.8,
        body_width=0.32,
        hip_width=0.265,
        skin=skin,
        outfit=outfit,
        shoes=shoes,
        pose="hands-back",
    )
    add_head("Alexey head", center, scale, skin, hair, iris, "messy", "angular")
    neck_z = 1.48 * scale
    add_capsule(
        "Neck tattoo blue",
        (-0.065, -0.094, neck_z - 0.02),
        (0.035, -0.1, neck_z + 0.1),
        0.022,
        tattoo_blue,
    )
    add_capsule(
        "Neck tattoo red",
        (0.055, -0.098, neck_z - 0.04),
        (0.08, -0.098, neck_z + 0.09),
        0.018,
        tattoo_red,
    )
    for side in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.035,
            minor_radius=0.008,
            major_segments=16,
            minor_segments=8,
            location=(side * 0.26 * scale, -0.015, center[2] - 0.015),
            rotation=(pi / 2, 0, 0),
        )
        bpy.context.object.data.materials.append(metal)


def export_figure(slug):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_DIR / f"{slug}.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_apply=True,
        export_yup=True,
    )


def main():
    figures = (
        ("anastasia-ryabykh", build_anastasia),
        ("victoria-yurkova", build_victoria),
        ("alexey-filatov", build_alexey),
    )
    for slug, builder in figures:
        clear_scene()
        builder()
        export_figure(slug)
        if slug == "alexey-filatov":
            bpy.ops.wm.save_as_mainfile(filepath=str(SCENE_OUTPUT))
    print(f"DOFAMIN_TEAM_SAMPLES_EXPORTED={OUTPUT_DIR}")


main()
