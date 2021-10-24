#!/bin/bash
while true; do
    make doc
    sleep 0.2
    inotifywait -e modify -r package*.json tsconfig.json .babelrc webpack* src
done
