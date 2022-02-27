#!/bin/bash
yarn install --immutable --immutable-cache --check-cache

MISSING_DEPS=`node -e "Object.keys(JSON.parse(require('fs').readFileSync('package.json')).peerDependencies || {}).forEach(dep=>console.log(dep))"`
if test -n "$MISSING_DEPS"; then
    yarn add -P --no-lockfile $MISSING_DEPS
fi
