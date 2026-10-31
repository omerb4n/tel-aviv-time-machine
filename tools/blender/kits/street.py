"""Street furniture and fences, the clutter of the years (docs/REALISM_PLAN.md step 4).

- `bench`: a boulevard bench, wooden slats on cast-iron ends (Rothschild has had them since the
  1910s; they changed little), 1.8 m;
- `ladder_guard`, `tree_stake`: what protected young street trees (Herzl in the 1910s,
  Rothschild in the 1920s);
- `pillar_cap`: the cap on a garden-wall pillar;
- `iron_railing`: a wrought-iron railing on a garden wall, 1 m, stretched along the wall;
- `picket_fence`: a wooden picket fence, 1 m, stretched along the plot front;
- `cafe_set`: a café table and two chairs, by the boulevard kiosks of today.

Origins on the ground (the railing's on top of its wall), the front facing -Y in Blender (+Z,
the street, in the game). Materials as in slice.py: `wood` (painted per placement), `metal`,
`stone`, `trim`.
"""


def bench(k):
    parts = []
    for s in (-1, 1):
        x = s * 0.75
        parts += [
            k.box(f'leg_f{s}', (0.06, 0.06, 0.42), (x, -0.2, 0), 'metal'),
            k.box(f'leg_b{s}', (0.06, 0.06, 0.8), (x, 0.2, 0), 'metal'),
            k.box(f'arm{s}', (0.06, 0.5, 0.05), (x, 0.0, 0.62), 'metal'),
            k.box(f'rail{s}', (0.06, 0.46, 0.05), (x, 0.0, 0.4), 'metal'),
        ]
    for i in range(4):
        parts.append(k.box(f'seat{i}', (1.8, 0.09, 0.035), (0, -0.2 + i * 0.115, 0.42), 'wood'))
    for i in range(3):
        parts.append(k.box(f'back{i}', (1.8, 0.03, 0.09), (0, 0.23, 0.52 + i * 0.12), 'wood'))
    k.module('bench', parts, backdrop='ground')


def ladder_guard(k):
    """Herzl Street, 1910–11 (Soskin): two wooden ladders, 2 m long, leant together over the
    sapling as an A, its feet 0.8 m apart along the kerb."""
    import math
    parts = []
    L, W, lean = 2.0, 0.38, math.radians(11)
    for s in (-1, 1):
        # each ladder in its own slanted plane: built upright, then tipped towards the other
        rails = [k.box(f'rail{s}{r}', (0.04, 0.04, L), (r * W / 2, 0, 0), 'wood') for r in (-1, 1)]
        rungs = [k.box(f'rung{s}{i}', (W, 0.03, 0.035), (0, 0, 0.25 + i * 0.32), 'wood') for i in range(6)]
        for ob in rails + rungs:
            ob.rotation_euler = (-s * lean, 0, 0)  # tops lean in, towards y = 0
            ob.location = (0, -s * 0.4, 0)
        parts += rails + rungs
    k.module('ladder_guard', parts, backdrop='ground')


def tree_stake(k):
    """A young boulevard tree's stake (Rothschild, 1920s prints): one pole 2.2 m tall, a tie."""
    k.module('tree_stake', [
        k.box('pole', (0.05, 0.05, 2.2), (0.18, 0, 0), 'wood'),
        k.box('tie', (0.22, 0.03, 0.04), (0.08, 0, 1.45), 'wood'),
    ], backdrop='ground')


def pillar_cap(k):
    """The cap of a garden-wall pillar (Herzl, 1910s): a moulded slab and a low pyramid on a
    0.5 m pillar."""
    k.module('pillar_cap', [
        k.box('slab', (0.62, 0.62, 0.07), (0, 0, 0), 'trim'),
        k.box('neck', (0.46, 0.46, 0.08), (0, 0, 0.07), 'trim'),
        k.box('top', (0.34, 0.34, 0.1), (0, 0, 0.15), 'trim'),
        k.box('finial', (0.16, 0.16, 0.12), (0, 0, 0.25), 'trim'),
    ], backdrop='ground')


def iron_railing(k):
    """1 m of railing, 0.8 m high: top and bottom rails, bars every 12.5 cm, spear tips."""
    parts = [
        k.box('top', (1.0, 0.04, 0.035), (0, 0, 0.77), 'metal'),
        k.box('bottom', (1.0, 0.035, 0.03), (0, 0, 0.06), 'metal'),
    ]
    for i in range(8):
        x = -0.4375 + i * 0.125
        parts.append(k.box(f'bar{i}', (0.018, 0.018, 0.86), (x, 0, 0), 'metal'))
    k.module('iron_railing', parts, backdrop='ground')


def picket_fence(k):
    """1 m of fence, 1.0 m high: two rails behind eight pickets."""
    parts = [
        k.box('rail_lo', (1.0, 0.03, 0.07), (0, 0.03, 0.25), 'wood'),
        k.box('rail_hi', (1.0, 0.03, 0.07), (0, 0.03, 0.75), 'wood'),
    ]
    for i in range(8):
        parts.append(k.box(f'picket{i}', (0.075, 0.02, 1.0), (-0.4375 + i * 0.125, 0, 0), 'wood'))
    k.module('picket_fence', parts, backdrop='ground')


def cafe_set(k):
    """A round bistro table (as an octagon) and two chairs facing it."""
    parts = [
        k.box('stem', (0.05, 0.05, 0.72), (0, 0, 0), 'metal'),
        k.box('foot', (0.4, 0.4, 0.02), (0, 0, 0), 'metal'),
        k.box('top', (0.6, 0.6, 0.025), (0, 0, 0.72), 'metal'),
    ]
    for s in (-1, 1):
        y = s * 0.55
        for lx in (-0.18, 0.18):
            for ly in (-0.18, 0.18):
                parts.append(k.box(f'leg{s}{lx}{ly}', (0.025, 0.025, 0.45), (lx, y + ly, 0), 'metal'))
        parts.append(k.box(f'seat{s}', (0.42, 0.42, 0.03), (0, y, 0.45), 'wood'))
        parts.append(k.box(f'back{s}', (0.42, 0.03, 0.4), (0, y + s * 0.2, 0.47), 'wood'))
    k.module('cafe_set', parts, backdrop='ground')


def build(k):
    k.GRID = 0.6
    bench(k)
    ladder_guard(k)
    tree_stake(k)
    pillar_cap(k)
    iron_railing(k)
    picket_fence(k)
    cafe_set(k)
