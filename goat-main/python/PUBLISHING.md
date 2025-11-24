# Publishing Python Packages

This document describes the process for publishing Python packages in the Goat SDK monorepo.

## Package Structure

All Python packages in this monorepo follow a standard structure:

- Each package has its own `pyproject.toml` file
- Packages are located in the following directories:
  - Core SDK: `python/src/goat-sdk/`
  - Plugins: `python/src/plugins/*/`
  - Wallets: `python/src/wallets/*/`
  - Adapters: `python/src/adapters/*/`

**Please make sure to add all sub-packages as dependencies in the main monorepo pyproject.toml file.** This step is
essential to guarantee that all dependencies are compatible with each other.

## Versioning

We use semantic versioning (SemVer) for all packages. To bump versions, you can use the provided script:

```bash
# Bump patch version for a specific package
python scripts/version_bump.py --package goat-sdk --type patch

# Bump minor version for a specific package
python scripts/version_bump.py --package goat-sdk --type minor

# Bump major version for a specific package
python scripts/version_bump.py --package goat-sdk --type major

# Bump patch version for all packages
python scripts/version_bump.py --type patch
```

## Publishing Process

The publishing process is automated through GitHub Actions:

1. When changes are pushed to the `main` branch that affect Python files, the CI/CD workflow is triggered
2. The workflow builds and tests all Python packages
3. If tests pass, the workflow checks for packages with version changes
4. Packages with new versions that don't exist on PyPI are automatically published

## Manual Publishing

If you need to publish packages manually, you can use Poetry:

```bash
# Navigate to the package directory
cd python/src/goat-sdk

# Build the package
poetry build

# Publish the package
poetry publish
```

## Requirements for Publishing

To publish packages, you need:

1. A PyPI account with publishing permissions for the Goat SDK packages
2. The PyPI API token configured in the GitHub repository secrets as `PYPI_TOKEN`

## Troubleshooting

If you encounter issues with the automated publishing process:

1. Check the GitHub Actions logs for error messages
2. Verify that the package version has been properly incremented
3. Ensure the PyPI token is correctly configured in the repository secrets 