"""Helpers for kit scripts: boxes on a fine grid, pack materials by name, baked AO, export.

Units are metres. Blender is Z-up; the glTF export turns it Y-up. A module's origin is the
middle of its base on the street face, with the face looking along -Y in Blender (+Z in the
game, which is the street front of a site).

Materials are placeholders named after the pack's materials (assets/materials.json) or the
game's MatKey names; the game swaps in its own material by name.
"""
import math

import bmesh
import bpy

GRID = 0.25  # vertex spacing, so baked AO in vertex colour has something to hold


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    return m


def box(name, size, loc, mat, collection=None):
    """An axis-aligned box `size` = (x, y, z) with its base centred on `loc`, subdivided on GRID."""
    sx, sy, sz = size
    cx, cy, cz = loc[0], loc[1], loc[2] + sz / 2
    bm = bmesh.new()
    seg = lambda length: max(1, math.ceil(length / GRID))  # noqa: E731
    # each face a grid of its own size: (axis of u, axis of v, axis of the normal, side)
    for u, v, n, s in ((0, 2, 1, -1), (0, 2, 1, 1), (1, 2, 0, -1), (1, 2, 0, 1), (0, 1, 2, -1), (0, 1, 2, 1)):
        nu, nv = seg(size[u]), seg(size[v])
        verts = [[None] * (nv + 1) for _ in range(nu + 1)]
        for i in range(nu + 1):
            for j in range(nv + 1):
                p = [cx, cy, cz]
                p[u] += (i / nu - 0.5) * size[u]
                p[v] += (j / nv - 0.5) * size[v]
                p[n] += s * size[n] / 2
                verts[i][j] = bm.verts.new(p)
        for i in range(nu):
            for j in range(nv):
                quad = [verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]]
                bm.faces.new(quad if s > 0 else quad[::-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob


def module(name, parts):
    """Joins `parts` into one object named `name`: one node of the kit."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    bpy.ops.object.shade_flat()
    metre_uvs(ob.data)
    return ob


def metre_uvs(me):
    """Box-projected UVs in metres, like the game's procedural parts (materials tile by size)."""
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        u, v = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[u], co[v])


def bake_ao(samples=48, distance=1.2):
    """Bakes ambient occlusion into each mesh's colour attribute (glTF COLOR_0)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance
    for ob in [o for o in scene.objects if o.type == 'MESH']:
        attr = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
        ob.data.color_attributes.active_color = attr
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_vertex_color='ACTIVE',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
