"""Builds one kit in a fresh Blender scene and exports it as glTF.

    blender -b --factory-startup -P tools/blender/build_kit.py -- tools/blender/kits/<kit>.py out.glb

Run by `npm run assets:build` (tools/assets/pack.mjs), which then compresses the result with
gltf-transform (meshopt). A kit script defines `build(k)`, where `k` is the kitlib module.
"""
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kitlib  # noqa: E402

kit_path, out = sys.argv[sys.argv.index('--') + 1:][:2]
spec = importlib.util.spec_from_file_location('kit', kit_path)
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)

kitlib.reset()
kit.build(kitlib)
kitlib.bake_ao()
kitlib.drop_backdrop()
kitlib.export(out)
