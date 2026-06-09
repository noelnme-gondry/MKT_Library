"""Load config.yaml and expose dotted access (cfg.data.path etc.)."""
from __future__ import annotations
import os
import yaml

_DEFAULT = os.environ.get("MMM_CONFIG", "config.yaml")


class Cfg(dict):
    """dict that also supports attribute access, recursively."""
    def __getattr__(self, k):
        try:
            v = self[k]
        except KeyError as e:
            raise AttributeError(k) from e
        return Cfg(v) if isinstance(v, dict) else v


def load(path: str | None = None) -> Cfg:
    path = path or _DEFAULT
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"config not found: {path}. Run from the project root, or set MMM_CONFIG."
        )
    with open(path, "r", encoding="utf-8") as f:
        return Cfg(yaml.safe_load(f))
