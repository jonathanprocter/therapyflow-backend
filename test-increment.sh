#!/bin/bash
set -e
COMPONENTS_CREATED=0
echo "Starting with: $COMPONENTS_CREATED"
((COMPONENTS_CREATED++)) || true
echo "After increment: $COMPONENTS_CREATED"
((COMPONENTS_CREATED++)) || true
echo "After second increment: $COMPONENTS_CREATED"
