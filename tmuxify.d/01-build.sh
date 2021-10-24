#!/bin/bash
while true; do
    make build SITE_URL=$SITE_URL SITE_PORT=$SITE_PORT &
    serverpid=$!
    inotifywait -e modify -r package*.json tsconfig.json .babelrc webpack* src
    kill -TERM $serverpid
done
