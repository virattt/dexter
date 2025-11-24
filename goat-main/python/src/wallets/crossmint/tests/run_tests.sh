#!/bin/bash

# Set Python path to include source directory
export PYTHONPATH=./python/src

# Run tests with verbose output
pytest python/src/wallets/crossmint/tests/ -v

# Exit with pytest's exit code
exit $?
