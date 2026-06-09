#!/usr/bin/env python3
"""Convenience wrapper: `python scripts/run_all.py [command] [--config ...]`.
Adds src/ to the path so you don't need PYTHONPATH set."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
os.chdir(ROOT)

from mmm.cli import main

if __name__ == "__main__":
    # default to `all` when no command given
    argv = sys.argv[1:] or ["all"]
    sys.exit(main(argv))
