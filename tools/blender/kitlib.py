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
BACKS = True  # False: boxes have no face on +Y (against the wall the module sits on, never seen)


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


def box(name, size, loc, mat, collection=None, grid=None):
    """An axis-aligned box `size` = (x, y, z) with its base centred on `loc`, subdivided on
    `grid` (GRID by default)."""
    sx, sy, sz = size
    cx, cy, cz = loc[0], loc[1], loc[2] + sz / 2
    grid = grid or GRID
    bm = bmesh.new()
    seg = lambda length: max(1, math.ceil(length / grid))  # noqa: E731
    # each face a grid of its own size: (axis of u, axis of v, axis of the normal, side)
    for u, v, n, s in ((0, 2, 1, -1), (0, 2, 1, 1), (1, 2, 0, -1), (1, 2, 0, 1), (0, 1, 2, -1), (0, 1, 2, 1)):
        if n == 1 and s > 0 and not BACKS:
            continue
        # u × v points along +n for a cyclic (u, v, n); wind each quad to face outwards
        outward = (s > 0) == ((u, v, n) in ((0, 1, 2), (1, 2, 0), (2, 0, 1)))
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
                bm.faces.new(quad if outward else quad[::-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob


def arch(name, r_in, r_out, depth, centre, mat, segments=12, face=0.0, collection=None):
    """A half ring in the XZ plane (an archivolt): radii `r_in`…`r_out` about `centre` = (x, z),
    standing proud of the wall plane y = `face` by `depth` (towards -Y, the street)."""
    bm = bmesh.new()
    cx, cz = centre
    rings = []
    for i in range(segments + 1):
        a = math.pi * i / segments
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((cx + r * c, y, cz + r * s)) for r in (r_in, r_out) for y in (face, face - depth)])
    # per ring: 0 inner back, 1 inner front, 2 outer back, 3 outer front
    for a, b in zip(rings, rings[1:]):
        bm.faces.new((a[1], b[1], b[3], a[3]))  # front
        bm.faces.new((a[0], a[1], b[1], b[0]))  # intrados
        bm.faces.new((a[3], b[3], b[2], a[2]))  # extrados
    for r in (rings[0], rings[-1]):
        bm.faces.new((r[0], r[2], r[3], r[1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material(mat))
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob


SLOT = 24.0  # modules bake side by side, this far apart, so they don't shade one another


def drop_backdrop():
    """After the bake: removes the backdrops and moves every module back to the origin."""
    for ob in [o for o in bpy.data.objects if o.name.startswith('_')]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for m in [m for m in bpy.data.materials if m.name == 'backdrop']:
        bpy.data.materials.remove(m)
    for ob in bpy.data.objects:
        ob.location = (0, 0, 0)


def module(name, parts, uvs=True, flat=True, backdrop='wall'):
    """Joins `parts` into one object named `name`: one node of the kit.

    `uvs`: box-project metre UVs (otherwise the parts bring their own 'UVMap'); `flat`: flat
    shading; `backdrop`: what it stands against while the AO bakes, 'wall' (facade modules) or
    'ground' (trees and street furniture)."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    if flat:
        bpy.ops.object.shade_flat()
    if uvs:
        metre_uvs(ob.data)
    # its own slot for the bake, with a wall or the ground next to it, as in the game
    slot = len([o for o in bpy.data.objects if o.name.startswith('_backdrop')])
    ob.location = (slot * SLOT, 0, 0)
    if backdrop == 'wall':
        back = box('_backdrop', (SLOT - 4, 0.2, SLOT - 4), (0, 0.1, -(SLOT - 4) / 2), 'backdrop', grid=SLOT)
    else:
        back = box('_backdrop', (SLOT - 4, SLOT - 4, 0.2), (0, 0, -0.2), 'backdrop', grid=SLOT)
    back.location = (slot * SLOT, 0, 0)
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
    for ob in [o for o in scene.objects if o.type == 'MESH' and not o.name.startswith('_')]:
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
