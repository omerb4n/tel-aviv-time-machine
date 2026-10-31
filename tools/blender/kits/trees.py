"""Street and garden trees of Tel Aviv, modelled from photographs (docs/REFERENCE_BOARD.md):
bark tubes and photographed leaf cards with baked AO.

- `poinciana`: royal poinciana as on Rothschild today: a short trunk that splits low into a
  few twisting limbs, spreading at a shallow angle under a wide, flat umbrella;
- `ficus`: Indian laurel fig, planted on Rothschild in the 1930s (also the dune sycamore fig,
  scaled up): heavy grey stems that part low, a dense, lumpy dome;
- `cypress`: Italian cypress, the rows along the boulevard in the 1920s: a dense column about
  10 m tall and 2 m wide, leafy down to the ground;
- `palm_trunk` (1 m tall, stretched to the palm's height in the game) and `palm_crown`:
  Washingtonia, a slim trunk and fan fronds (shape from geometry, surface from a photographed
  leaf).

Leaf cards address the quarters of the leaf atlas that tools/assets/foliage.mjs makes (Blender
UVs: v = 1 at the top of the image). Leaves grow in clumps at the branch tips, as they do;
their normals point out from the crown so it shades as a mass. Materials: `bark` and `leaves`.
Units are metres at maturity; the game scales a tree as it grows.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

# atlas quarters: (u0, v0) of each cell, cells 0.5 wide
CELL = {'ficus': (0.0, 0.5), 'poinciana': (0.5, 0.5), 'palm': (0.0, 0.0), 'cypress': (0.5, 0.0)}
INSET = 0.004


def obj(name, bm, mat, k):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(k.material(mat))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tube(k, name, path, radii, sides=6):
    """A tapering tube along `path` (points), radius per point; UVs in metres round and along."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rings = []
    along = 0.0
    lengths = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        side = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))).normalized()
        up = side.cross(d)
        if i:
            along += (p - Vector(path[i - 1])).length
        lengths.append(along)
        rings.append([bm.verts.new(p + (side * math.cos(a) + up * math.sin(a)) * radii[i]) for a in (j / sides * 2 * math.pi for j in range(sides))])
    for i in range(len(rings) - 1):
        for j in range(sides):
            q = (rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j])
            f = bm.faces.new(q)
            for loop, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                loop[uv].uv = (jj / sides * 2 * math.pi * radii[ii], lengths[ii])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, 'bark', k)


def limb(k, name, start, direction, length, r0, r1, bend=0.25, segs=4, rnd=None):
    """A branch from `start`, curving upwards as it goes."""
    pts, radii = [], []
    p = Vector(start)
    d = Vector(direction).normalized()
    for i in range(segs + 1):
        t = i / segs
        pts.append(tuple(p))
        radii.append(r0 + (r1 - r0) * t)
        d = (d + Vector((0, 0, bend)) + Vector((rnd.uniform(-0.1, 0.1), rnd.uniform(-0.1, 0.1), 0))).normalized()
        p = p + d * (length / segs)
    return tube(k, name, pts, radii, sides=5), Vector(pts[-1])


def cards(k, name, cell, placements, normal_from=None):
    """Leaf cards: each (centre, normal, up, width, height); UVs the atlas cell. With
    `normal_from`, vertex normals point away from that point (the crown's centre)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    u0, v0 = CELL[cell]
    for c, n, up, w, h in placements:
        c, n, up = Vector(c), Vector(n).normalized(), Vector(up)
        side = up.cross(n).normalized()
        up = n.cross(side).normalized()
        # the card's base (bottom of the cell: twigs, the palm's petiole) sits at `c`
        corners = [c - side * w / 2, c + side * w / 2, c + side * w / 2 + up * h, c - side * w / 2 + up * h]
        f = bm.faces.new([bm.verts.new(p) for p in corners])
        for loop, (a, b) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = (u0 + INSET + a * (0.5 - 2 * INSET), v0 + INSET + b * (0.5 - 2 * INSET))
    ob = obj(name, bm, 'leaves', k)
    if normal_from is not None:
        ob['normal_from'] = tuple(normal_from)
    return ob


def shell(rnd, centre, radii, inner=0.55):
    """A random point in the outer part of an ellipsoid crown, and its outward direction."""
    while True:
        d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
        if d.length > 1e-3:
            break
    d.normalize()
    s = rnd.uniform(inner, 1.0)
    p = Vector(centre) + Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2])) * s
    return p, d


def crown_normals(ob):
    """Leaf vertex normals from the crown's centre, blended with the card's own: a crown lit as a mass."""
    centre = ob.get('normal_from')
    axis = ob.get('normal_axis', False)
    if centre is None and not axis:
        return
    me = ob.data
    leaves = me.materials.find('leaves')
    normals = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if poly.material_index == leaves:
                # a column shades round its axis, a crown round its centre
                out = Vector((co.x, co.y, 0.25)) if axis else co - Vector(centre)
                n = out.normalized() * 0.8 + poly.normal * 0.2
                normals.append(n.normalized())
            else:
                normals.append(me.loops[li].normal.copy())
    me.normals_split_custom_set(normals)


def finish(k, name, parts, centre=None):
    ob = k.module(name, parts, uvs=False, flat=False, backdrop='ground')
    if centre is not None:
        ob['normal_from'] = tuple(centre)
        crown_normals(ob)
    return ob


def branch(k, rnd, parts, tips, name, start, d, length, r0, depth, spec):
    """A limb that wanders as it goes, then forks `spec['forks']` ways, `depth` more times.
    Collects the tips (where the leaf clumps go) in `tips`."""
    segs = 3
    pts, radii = [tuple(start)], [r0]
    p = Vector(start)
    d = Vector(d).normalized()
    r1 = r0 * spec['taper']
    for i in range(1, segs + 1):
        wob = spec['wobble']
        d = (d + Vector((rnd.uniform(-wob, wob), rnd.uniform(-wob, wob), spec['lift'] + rnd.uniform(-wob, wob) * 0.5))).normalized()
        p = p + d * (length / segs)
        pts.append(tuple(p))
        radii.append(r0 + (r1 - r0) * i / segs)
    parts.append(tube(k, name, pts, radii, sides=6 if r0 > 0.15 else 4 if r0 > 0.05 else 3))
    if depth == 0 or r1 < 0.025:
        tips.append((p, d))
        return
    for f in range(spec['forks']):
        a = rnd.uniform(0, 2 * math.pi)
        side = Vector((math.cos(a), math.sin(a), 0))
        nd = (d * spec['keep'] + side * (1 - spec['keep']) + Vector((0, 0, spec['rise']))).normalized()
        branch(k, rnd, parts, tips, f'{name}{f}', p, nd, length * spec['shrink'], r1 * 0.75, depth - 1, spec)


def clumps(rnd, tips, per, spread, size, flat=0.0, centre=None):
    """Leaf cards round each branch tip: (centre, normal, up, width, height) for `cards`.
    `flat` 0…1 turns the cards towards the sky (an umbrella crown)."""
    out = []
    for p, d in tips:
        for _ in range(per):
            off = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 0.6))) * spread
            c = p + off
            out_dir = (c - Vector(centre)).normalized() if centre is not None else d
            n = (out_dir * (1 - flat) + Vector((0, 0, 1)) * flat + Vector((rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), rnd.uniform(-0.2, 0.4)))).normalized()
            up = (d + Vector((0, 0, 0.3))).normalized()
            s = size * rnd.uniform(0.8, 1.2)
            out.append((c - up * s * 0.35, n, up, s, s))
    return out


def poinciana(k):
    """Rothschild today: trunk 1.2–1.6 m, then 4 limbs at 25–40° above level, twisting; crown
    about 8 m high and 13 m across, flat on top."""
    rnd = random.Random(2)
    parts = [tube(k, 'trunk', [(0, 0, 0), (0.12, 0.05, 0.7), (0.05, 0.12, 1.4)], [0.36, 0.3, 0.27], sides=10)]
    tips = []
    spec = {'taper': 0.62, 'wobble': 0.28, 'lift': 0.04, 'forks': 2, 'keep': 0.55, 'rise': 0.15, 'shrink': 0.7}
    for i in range(4):
        a = i / 4 * 2 * math.pi + rnd.uniform(-0.4, 0.4)
        branch(k, rnd, parts, tips, f'limb{i}', (0.05, 0.12, 1.35), (math.cos(a), math.sin(a), rnd.uniform(0.45, 0.75)), 3.6, 0.17, 2, spec)
    # the umbrella: clumps lifted to a flat top round 6.5–8 m
    tips = [(Vector((p.x, p.y, max(p.z, 5.8) + rnd.uniform(0, 1.2))), d) for p, d in tips]
    parts.append(cards(k, 'leaves', 'poinciana', clumps(rnd, tips, 9, 1.0, 2.3, flat=0.65)))
    finish(k, 'poinciana', parts, (0, 0, 5.0))


def ficus(k):
    """Rothschild today: two or three heavy grey stems that part at 1–2 m and lean outwards;
    a dense dome about 11 m high and 12 m across, its underside about 3 m up."""
    rnd = random.Random(1)
    parts = [tube(k, 'trunk', [(0, 0, 0), (0.08, 0, 0.8), (0.05, 0.08, 1.5)], [0.55, 0.45, 0.42], sides=10)]
    tips = []
    spec = {'taper': 0.6, 'wobble': 0.2, 'lift': 0.12, 'forks': 3, 'keep': 0.6, 'rise': 0.35, 'shrink': 0.66}
    for i in range(3):
        a = i / 3 * 2 * math.pi + rnd.uniform(-0.3, 0.3)
        branch(k, rnd, parts, tips, f'stem{i}', (0.05, 0.08, 1.4), (math.cos(a) * 0.5, math.sin(a) * 0.5, 1), 3.2, 0.3, 2, spec)
    centre = (0, 0, 7.0)
    parts.append(cards(k, 'leaves', 'ficus', clumps(rnd, tips, 7, 1.1, 2.2, centre=centre)))
    finish(k, 'ficus', parts, centre)


def cypress(k):
    """Italian cypress of the 1920s rows: a dense, smooth column, widest a quarter of the way up
    and tapering to a point; the sprays lie on its surface, pointing up."""
    rnd = random.Random(4)
    H, R = 10.3, 1.0
    parts = [tube(k, 'trunk', [(0, 0, 0), (0, 0, 4.0), (0, 0, 9.0)], [0.18, 0.12, 0.04], sides=6)]

    def radius(z):
        t = z / H
        return R * min(1.0, 0.75 + t * 1.6) * (1 - t) ** 0.85

    place = []
    for i in range(280):
        z = H * (i + rnd.random()) / 280
        r = radius(z)
        if r < 0.08:
            continue
        a = rnd.uniform(0, 2 * math.pi)
        d = Vector((math.cos(a), math.sin(a), 0))
        p = Vector((0, 0, z)) + d * r * rnd.uniform(0.82, 1.0)
        s = rnd.uniform(0.9, 1.3)
        place.append((p - Vector((0, 0, s * 0.45)), d + Vector((0, 0, 0.15)), Vector((0, 0, 1)), s * 0.8, s))
    parts.append(cards(k, 'sprays', 'cypress', place))
    ob = finish(k, 'cypress', parts)
    ob['normal_axis'] = True
    crown_normals(ob)


def fan(bm, uv, base, d, side, n, radius, rnd):
    """A Washingtonia fan: `n` pleated segments radiating from the petiole's tip over ~270°,
    each folded along its middle, the outer third drooping."""
    u0, v0 = CELL['palm']
    up = d.cross(side).normalized()
    if up.z < 0:
        up = -up
    for i in range(n):
        a = -2.3 + 4.6 * i / (n - 1)
        a2 = -2.3 + 4.6 * (i + 0.9) / (n - 1)
        rows = []
        for t in (0.0, 1.0):
            row = []
            for b, fold in ((a, 0.0), ((a + a2) / 2, 0.06 * t), (a2, 0.0)):
                r = radius * t
                droop = -0.14 * t * radius
                p = base + (d * math.cos(b) + side * math.sin(b)) * r * 0.9 + up * (fold * radius + droop * abs(math.cos(b)))
                row.append(bm.verts.new(p))
            rows.append(row)
        for j in range(1):
            for c in range(2):
                f = bm.faces.new((rows[j][c], rows[j][c + 1], rows[j + 1][c + 1], rows[j + 1][c]))
                for loop, (x, y) in zip(f.loops, ((c, j), (c + 1, j), (c + 1, j + 1), (c, j + 1))):
                    loop[uv].uv = (u0 + 0.05 + 0.4 * x / 2, v0 + 0.05 + 0.4 * y)


def palm(k):
    rnd = random.Random(3)
    # the trunk: 1 m, stretched in the game; old leaf bases as a slight ring pattern
    pts = [(0, 0, i / 8) for i in range(9)]
    radii = [0.34 if i == 0 else 0.25 + 0.015 * (i % 2) for i in range(9)]
    finish(k, 'palm_trunk', [tube(k, 'trunk', pts, radii, sides=8)])
    parts = [tube(k, 'boss', [(0, 0, -0.6), (0, 0, 0.1), (0, 0, 0.5)], [0.26, 0.32, 0.12], sides=8)]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    for i in range(16):
        a = i * 2.39996  # golden angle
        tier = i / 16
        rise = 1.1 - 1.6 * tier + rnd.uniform(-0.15, 0.15)  # top fronds up, the lowest droop
        d = Vector((math.cos(a), math.sin(a), rise)).normalized()
        base = Vector((0, 0, 0.3)) + d * 0.2
        tip = base + d * 1.4
        parts.append(tube(k, f'petiole{i}', [tuple(base), tuple(tip)], [0.04, 0.025], sides=3))
        side = Vector((-math.sin(a), math.cos(a), 0))
        fan(bm, uv, tip, d, side, 10, 0.9, rnd)
    parts.append(obj('fronds', bm, 'leaves', k))
    finish(k, 'palm_crown', parts, (0, 0, 0.2))


def shrub(k):
    """A low flowering shrub of the boulevard's planted bed (1920s prints): a dome of leafy cards
    about 0.9 m high and 1.3 m across."""
    rnd = random.Random(5)
    centre = Vector((0, 0, 0.45))
    place = []
    for _ in range(26):
        d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), abs(rnd.gauss(0, 0.7)))).normalized()
        p = centre + Vector((d.x * 0.55, d.y * 0.55, d.z * 0.4))
        place.append((p - Vector((0, 0, 0.25)), d, Vector((0, 0, 1)), 0.75, 0.75))
    finish(k, 'shrub', [cards(k, 'leaves', 'ficus', place)], tuple(centre))


def agave(k):
    """The agave of the bed (1920s prints): a rosette of stiff, pointed leaves, 1.4 m across."""
    rnd = random.Random(6)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    u0, v0 = CELL['palm']
    for i in range(26):
        a = i * 2.39996
        tilt = 0.25 + 0.9 * (i / 26) + rnd.uniform(-0.1, 0.1)  # inner leaves upright, outer ones spread
        d = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.07
        L = rnd.uniform(0.6, 0.8)
        base = Vector((0, 0, 0.05))
        mid = base + d * L * 0.5
        tip = base + d * L + Vector((0, 0, -0.08 * math.sin(tilt)))
        vs = [bm.verts.new(base - side), bm.verts.new(base + side), bm.verts.new(mid + side * 1.2), bm.verts.new(mid - side * 1.2), bm.verts.new(tip)]
        for f, uvs in (((vs[0], vs[1], vs[2], vs[3]), ((0, 0), (1, 0), (1, 0.5), (0, 0.5))), ((vs[3], vs[2], vs[4]), ((0, 0.5), (1, 0.5), (0.5, 1)))):
            face = bm.faces.new(f)
            for loop, (x, y) in zip(face.loops, uvs):
                loop[uv].uv = (u0 + 0.1 + 0.3 * x, v0 + 0.1 + 0.3 * y)
    finish(k, 'agave', [obj('rosette', bm, 'leaves', k)], (0, 0, 0.2))


def sapling(k):
    """A newly planted street tree (Herzl 1911, Rothschild 1920s prints): a thin stem about 2.5 m
    tall, a few short shoots and a sparse head of leaves."""
    rnd = random.Random(7)
    parts = [tube(k, 'stem', [(0, 0, 0), (0.02, 0, 1.2), (0, 0.03, 2.4)], [0.045, 0.035, 0.02], sides=5)]
    tips = []
    spec = {'taper': 0.5, 'wobble': 0.25, 'lift': 0.3, 'forks': 2, 'keep': 0.5, 'rise': 0.3, 'shrink': 0.6}
    for i in range(4):
        a = i / 4 * 2 * math.pi + rnd.uniform(-0.4, 0.4)
        branch(k, rnd, parts, tips, f'shoot{i}', (0, 0.02, 1.7 + i * 0.18), (math.cos(a), math.sin(a), 0.8), 0.6, 0.015, 1, spec)
    parts.append(cards(k, 'leaves', 'ficus', clumps(rnd, tips, 2, 0.25, 0.7, centre=(0, 0, 2.1))))
    finish(k, 'sapling', parts, (0, 0, 2.1))


def build(k):
    poinciana(k)
    ficus(k)
    palm(k)
    cypress(k)
    shrub(k)
    agave(k)
    sapling(k)
