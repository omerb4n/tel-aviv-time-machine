"""Facade dressing for the vertical slice (Herzl Street and Rothschild, 1922 and 2025).

Each module frames a window that the procedural facade texture already paints on the wall
(src/world/textures.ts): sills, lintels, frames, shutters, eyebrows and mullions stand proud of
the wall, so the painted glass reads as a real opening with depth and shadow. The facade
grammar (src/world/buildings/facadeGrammar.ts) puts one on each painted window, so the sizes
here follow the painters' windows; keep the two in step.

Origin of a module: the bottom middle of its window, on the wall plane. Blender -Y is out of
the wall (+Z, the street, in the game). Materials are named after the game's MatKey: `trim`
(painted plaster mouldings), `stone` (kurkar sills and lintels), `wood` (shutters, painted per
building) and `metal` (steel and aluminium frames).
"""

D = 0.004  # a hair off the wall, so nothing fights the painted wall for depth


def louvres(k, name, w, h, x, y, z, n, mat='wood'):
    """A louvred shutter leaf: a frame and `n` slats, `w` × `h`, front face at y."""
    parts = [
        k.box(f'{name}_l', (0.05, 0.035, h), (x - w / 2 + 0.025, y - 0.0175, z), mat),
        k.box(f'{name}_r', (0.05, 0.035, h), (x + w / 2 - 0.025, y - 0.0175, z), mat),
        k.box(f'{name}_b', (w - 0.1, 0.035, 0.06), (x, y - 0.0175, z), mat),
        k.box(f'{name}_t', (w - 0.1, 0.035, 0.06), (x, y - 0.0175, z + h - 0.06), mat),
        k.box(f'{name}_m', (w - 0.1, 0.03, 0.05), (x, y - 0.015, z + h * 0.48), mat),
        k.box(f'{name}_back', (w - 0.1, 0.01, h - 0.12), (x, y - 0.005, z + 0.06), mat),
    ]
    for i in range(n):
        zz = z + 0.09 + i * (h - 0.18) / n
        parts.append(k.box(f'{name}_s{i}', (w - 0.1, 0.025, 0.04), (x, y - 0.03, zz), mat))
    return parts


def ottoman(k, open_):
    """Ahuzat Bayit house window, 0.95 × 1.75 m: plaster frame, kurkar sill and lintel, and
    louvred shutters folded back against the wall (open) or closed across the window."""
    W, H = 0.95, 1.75
    parts = [
        k.box('jamb_l', (0.12, 0.05 + D, H + 0.12), (-W / 2 - 0.06, -(0.05 + D) / 2, 0), 'trim'),
        k.box('jamb_r', (0.12, 0.05 + D, H + 0.12), (W / 2 + 0.06, -(0.05 + D) / 2, 0), 'trim'),
        k.box('head', (W, 0.05 + D, 0.12), (0, -(0.05 + D) / 2, H), 'trim'),
        k.box('lintel', (W + 0.42, 0.1, 0.18), (0, -0.05 - D, H + 0.12), 'stone'),
        k.box('cap', (W + 0.56, 0.16, 0.05), (0, -0.08 - D, H + 0.3), 'stone'),
        k.box('sill', (W + 0.36, 0.16, 0.07), (0, -0.08 - D, -0.07), 'stone'),
        # a slim inner frame and the middle meeting stile, set back in the opening
        k.box('stile', (0.045, 0.03, H), (0, -0.015 - D, 0), 'trim'),
        k.box('transom', (W, 0.03, 0.045), (0, -0.015 - D, H * 0.72), 'trim'),
    ]
    if open_:
        for s in (-1, 1):
            parts += louvres(k, f'leaf{s}', W / 2, H, s * (W / 2 + 0.12 + W / 4 + 0.01), -D, 0, 10)
    else:
        for s in (-1, 1):
            parts += louvres(k, f'leaf{s}', W / 2, H, s * W / 4, -D - 0.03, 0, 10)
    k.module('ottoman_open' if open_ else 'ottoman_closed', parts)


def eclectic(k):
    """Eclectic window of the 1920s, 1.0 × 1.9 m with a round head: jambs, a moulded archivolt
    with a keystone, a hood moulding, and a sill on two corbels."""
    W, H = 1.0, 1.9
    spring = H - W / 2  # where the arch starts
    parts = [
        k.box('jamb_l', (0.14, 0.06 + D, spring), (-W / 2 - 0.07, -(0.06 + D) / 2, 0), 'trim'),
        k.box('jamb_r', (0.14, 0.06 + D, spring), (W / 2 + 0.07, -(0.06 + D) / 2, 0), 'trim'),
        k.box('impost_l', (0.22, 0.09, 0.07), (-W / 2 - 0.08, -0.045 - D, spring - 0.07), 'trim'),
        k.box('impost_r', (0.22, 0.09, 0.07), (W / 2 + 0.08, -0.045 - D, spring - 0.07), 'trim'),
        k.arch('archivolt', W / 2, W / 2 + 0.14, 0.06 + D, (0, spring), 'trim', segments=14),
        k.arch('hood', W / 2 + 0.16, W / 2 + 0.24, 0.1 + D, (0, spring), 'trim', segments=14),
        k.box('key', (0.18, 0.11, 0.26), (0, -0.055 - D, H - 0.04), 'trim'),
        k.box('sill', (W + 0.4, 0.18, 0.08), (0, -0.09 - D, -0.08), 'stone'),
        k.box('apron', (W + 0.1, 0.03 + D, 0.3), (0, -(0.03 + D) / 2, -0.38), 'trim'),
        # glazing bars on the painted glass: a cross under the fanlight
        k.box('stile', (0.04, 0.025, spring), (0, -0.0125 - D, 0), 'trim'),
        k.box('transom', (W, 0.025, 0.05), (0, -0.0125 - D, spring - 0.05), 'trim'),
    ]
    for s in (-1, 1):
        parts.append(k.box(f'corbel{s}', (0.12, 0.14, 0.2), (s * (W / 2 + 0.06), -0.07 - D, -0.28), 'stone'))
    k.module('eclectic_window', parts)


def bauhaus(k):
    """International Style ribbon window (1.2 m high band): a thin concrete eyebrow over it and
    a sill under it, 1 m long, stretched along the run; and the steel mullions of one 4 m tile."""
    k.module('bauhaus_ledge', [
        k.box('eyebrow', (1.0, 0.5, 0.08), (0, -0.25 - D, 1.32), 'trim', grid=0.5),
        k.box('sill', (1.0, 0.07, 0.05), (0, -0.035 - D, -0.05), 'trim', grid=0.5),
    ])
    parts = [k.box('transom', (4.0, 0.035, 0.04), (0, -0.0175 - D, 0.82), 'metal')]
    for i in range(5):
        parts.append(k.box(f'mullion{i}', (0.05, 0.045, 1.2), (-2.0 + 0.8 * i, -0.0225 - D, 0), 'metal'))
    k.module('bauhaus_mullions', parts)


def modern(k):
    """Contemporary floor-to-ceiling window, 2.6 × 2.5 m: aluminium frame, middle mullion and a
    thin sill."""
    W, H = 2.6, 2.5
    k.module('modern_frame', [
        k.box('frame_l', (0.07, 0.06 + D, H), (-W / 2 + 0.035, -(0.06 + D) / 2, 0), 'metal'),
        k.box('frame_r', (0.07, 0.06 + D, H), (W / 2 - 0.035, -(0.06 + D) / 2, 0), 'metal'),
        k.box('frame_t', (W, 0.06 + D, 0.07), (0, -(0.06 + D) / 2, H - 0.07), 'metal'),
        k.box('frame_b', (W, 0.06 + D, 0.07), (0, -(0.06 + D) / 2, 0), 'metal'),
        k.box('mullion', (0.06, 0.05, H), (0, -0.025 - D, 0), 'metal'),
        k.box('sill', (W + 0.1, 0.1, 0.04), (0, -0.05 - D, -0.04), 'metal', grid=0.5),
    ])


def gymnasium(k):
    """The Herzliya Gymnasium's portal: a moulded archivolt and jambs around the arched door
    (5 m wide, round head 2.5 m in radius on 6 m posts), so the arch the 1913 photograph's
    marks use stays exactly where it was."""
    # origin on the face of the door leaf, 0.3 m proud of the wall: the frame reaches back to it
    R, B = 2.5, 0.3
    k.module('gym_portal', [
        k.box('jamb_l', (0.5, 0.55, 6.0), (-R - 0.25, (B - 0.25) / 2, 0), 'trim'),
        k.box('jamb_r', (0.5, 0.55, 6.0), (R + 0.25, (B - 0.25) / 2, 0), 'trim'),
        k.box('impost_l', (0.7, 0.65, 0.2), (-R - 0.25, (B - 0.35) / 2, 5.8), 'trim'),
        k.box('impost_r', (0.7, 0.65, 0.2), (R + 0.25, (B - 0.35) / 2, 5.8), 'trim'),
        k.arch('archivolt', R, R + 0.5, 0.55, (0, 6.0), 'trim', segments=20, face=B),
        k.arch('roll', R + 0.5, R + 0.62, 0.65, (0, 6.0), 'trim', segments=20, face=B),
        k.box('key', (0.5, 0.7, 0.6), (0, (B - 0.4) / 2, 6.0 + R - 0.1), 'trim'),
    ])


def build(k):
    # small parts: a coarser grid still holds the AO, and no faces against the wall
    k.GRID = 0.6
    k.BACKS = False
    ottoman(k, True)
    ottoman(k, False)
    eclectic(k)
    bauhaus(k)
    modern(k)
    gymnasium(k)
