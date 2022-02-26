#!/bin/bash
yarn install --immutable --immutable-cache --check-cache
yarn install --no-lockfile `node -e "Object.keys(JSON.parse(require('fs').readFileSync('package.json')).peerDependencies || {}).forEach(dep=>console.log(dep))"`
