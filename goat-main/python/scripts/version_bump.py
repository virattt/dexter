#!/usr/bin/env python3
"""
Script to help with versioning Python packages.
This script allows bumping versions of Python packages in the monorepo.
"""

import argparse
import os
import re
import sys
import tomli
import tomli_w
from pathlib import Path
from enum import Enum
from typing import List, Dict, Optional, Tuple


class BumpType(str, Enum):
    PATCH = "patch"
    MINOR = "minor"
    MAJOR = "major"


def find_packages() -> List[Path]:
    """Find all Python packages in the monorepo."""
    base_dir = Path(__file__).parent.parent
    packages = []
    
    # Core package
    core_pkg = base_dir / "src" / "goat-sdk"
    if (core_pkg / "pyproject.toml").exists():
        packages.append(core_pkg)
    
    # Plugin packages
    plugin_dir = base_dir / "src" / "plugins"
    if plugin_dir.exists():
        for pkg in plugin_dir.iterdir():
            if (pkg / "pyproject.toml").exists():
                packages.append(pkg)
    
    # Wallet packages
    wallet_dir = base_dir / "src" / "wallets"
    if wallet_dir.exists():
        for pkg in wallet_dir.iterdir():
            if (pkg / "pyproject.toml").exists():
                packages.append(pkg)
    
    # Adapter packages
    adapter_dir = base_dir / "src" / "adapters"
    if adapter_dir.exists():
        for pkg in adapter_dir.iterdir():
            if (pkg / "pyproject.toml").exists():
                packages.append(pkg)
    
    return packages


def get_package_info(pkg_path: Path) -> Tuple[str, str]:
    """Get package name and version from pyproject.toml."""
    with open(pkg_path / "pyproject.toml", "rb") as f:
        pyproject = tomli.load(f)
    
    name = pyproject["tool"]["poetry"]["name"]
    version = pyproject["tool"]["poetry"]["version"]
    
    return name, version


def bump_version(version: str, bump_type: BumpType) -> str:
    """Bump a version according to semver rules."""
    major, minor, patch = map(int, version.split("."))
    
    if bump_type == BumpType.PATCH:
        patch += 1
    elif bump_type == BumpType.MINOR:
        minor += 1
        patch = 0
    elif bump_type == BumpType.MAJOR:
        major += 1
        minor = 0
        patch = 0
    
    return f"{major}.{minor}.{patch}"


def update_package_version(pkg_path: Path, new_version: str) -> None:
    """Update the version in pyproject.toml."""
    pyproject_path = pkg_path / "pyproject.toml"
    
    with open(pyproject_path, "rb") as f:
        pyproject = tomli.load(f)
    
    pyproject["tool"]["poetry"]["version"] = new_version
    
    with open(pyproject_path, "wb") as f:
        tomli_w.dump(pyproject, f)


def update_monorepo_dependencies(packages: List[Path]) -> None:
    """Update dependencies in the monorepo pyproject.toml."""
    base_dir = Path(__file__).parent.parent
    monorepo_pyproject_path = base_dir / "pyproject.toml"
    
    with open(monorepo_pyproject_path, "rb") as f:
        monorepo_pyproject = tomli.load(f)
    
    for pkg_path in packages:
        name, version = get_package_info(pkg_path)
        if name in monorepo_pyproject["tool"]["poetry"]["dependencies"]:
            # Keep the path reference, just update the version if needed
            pass
    
    with open(monorepo_pyproject_path, "wb") as f:
        tomli_w.dump(monorepo_pyproject, f)


def main():
    parser = argparse.ArgumentParser(description="Bump versions of Python packages")
    parser.add_argument("--package", help="Package name to bump (or 'all' for all packages, defaults to all packages)")
    parser.add_argument("--type", type=BumpType, choices=list(BumpType), default=BumpType.PATCH,
                        help="Type of version bump (patch, minor, major, defaults to patch)")
    
    args = parser.parse_args()
    
    packages = find_packages()
    packages_to_bump = []
    
    if args.package and args.package.lower() != "all":
        # Find the specific package
        target_pkg = args.package
        found = False
        for pkg_path in packages:
            name, _ = get_package_info(pkg_path)
            if name == target_pkg:
                packages_to_bump.append(pkg_path)
                found = True
                break
        
        if not found:
            print(f"Package '{target_pkg}' not found")
            sys.exit(1)
    else:
        # Bump all packages
        packages_to_bump = packages
    
    # Bump versions
    for pkg_path in packages_to_bump:
        name, version = get_package_info(pkg_path)
        new_version = bump_version(version, args.type)
        update_package_version(pkg_path, new_version)
        print(f"Bumped {name} from {version} to {new_version}")
    
    # Update monorepo dependencies
    update_monorepo_dependencies(packages_to_bump)
    
    print("\nDon't forget to commit these changes!")


if __name__ == "__main__":
    main() 