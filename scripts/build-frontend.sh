#!/bin/bash

# Build the Svelte frontend
echo "Building Svelte frontend..."

cd "$(dirname "$0")/.."

# Install dependencies if needed
npm install

# Build the application
npm run build

echo "Frontend build complete. Output in build/ directory."