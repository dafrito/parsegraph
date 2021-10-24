#!/bin/bash
while true; do
    make coverage
    sleep 0.2
    inotifywait -e modify -r package*.json tsconfig.json .babelrc webpack* src test
done
