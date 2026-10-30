"""A first kit to prove the pipeline: one window bay of an eclectic house of the 1920s.

3.2 m wide and one 3.6 m storey high, the size of a bay in the procedural `plaster` facade:
plastered wall around a tall window, a stone sill, a moulded lintel and two louvred shutters
standing open. Step 3 of the realism plan replaces this with the real kits.
"""

W, H, T = 3.2, 3.6, 0.3  # bay width, storey height, wall thickness
WIN_W, WIN_H, SILL = 1.1, 1.9, 0.9  # window opening and the height of its sill
REVEAL = 0.18  # how far the frame sits back from the face


def build(k):
    side = (W - WIN_W) / 2
    top = H - SILL - WIN_H
    wall = [
        k.box('wall_l', (side, T, H), (-(WIN_W + side) / 2, 0, 0), 'plaster'),
        k.box('wall_r', (side, T, H), ((WIN_W + side) / 2, 0, 0), 'plaster'),
        k.box('wall_b', (WIN_W, T, SILL), (0, 0, 0), 'plaster'),
        k.box('wall_t', (WIN_W, T, top), (0, 0, SILL + WIN_H), 'plaster'),
    ]
    sill = k.box('sill', (WIN_W + 0.3, 0.12, 0.07), (0, -T / 2 - 0.03, SILL - 0.07), 'stone')
    lintel = [
        k.box('lintel', (WIN_W + 0.4, 0.08, 0.22), (0, -T / 2 - 0.02, SILL + WIN_H + 0.05), 'trim'),
        k.box('cap', (WIN_W + 0.55, 0.14, 0.06), (0, -T / 2 - 0.04, SILL + WIN_H + 0.27), 'trim'),
    ]
    frame_y = -T / 2 + REVEAL
    frame = [
        k.box('frame_l', (0.07, 0.06, WIN_H), (-WIN_W / 2 + 0.035, frame_y, SILL), 'wood'),
        k.box('frame_r', (0.07, 0.06, WIN_H), (WIN_W / 2 - 0.035, frame_y, SILL), 'wood'),
        k.box('frame_t', (WIN_W, 0.06, 0.07), (0, frame_y, SILL + WIN_H - 0.07), 'wood'),
        k.box('mullion', (0.05, 0.05, WIN_H), (0, frame_y, SILL), 'wood'),
        k.box('glass', (WIN_W - 0.1, 0.01, WIN_H - 0.08), (0, frame_y + 0.02, SILL), 'glass'),
    ]
    # shutters folded back against the wall, slats as shallow steps
    shutters = []
    for s in (-1, 1):
        x = s * (WIN_W / 2 + WIN_W / 4 + 0.03)
        shutters.append(k.box(f'shutter_{s}', (WIN_W / 2, 0.035, WIN_H), (x, -T / 2 - 0.02, SILL), 'wood'))
        for i in range(14):
            z = SILL + 0.12 + i * (WIN_H - 0.24) / 14
            shutters.append(k.box(f'slat_{s}_{i}', (WIN_W / 2 - 0.08, 0.02, 0.05), (x, -T / 2 - 0.045, z), 'wood'))
    k.module('bay_window', wall + [sill] + lintel + frame + shutters)
