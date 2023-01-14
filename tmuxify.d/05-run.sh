#!/bin/bash
if test $# -gt 0; then
    SITE_PORT=$1
    shift
fi
while true; do
    make demo SITE_PORT=$SITE_PORT &
    serverpid=$!
    trap 'kill -TERM $serverpid' TERM
    trap 'kill -TERM $serverpid; exit' INT
    sleep 0.2
    inotifywait -e modify -r demo/package.json demo/yarn.lock demo/src
    kill -TERM $serverpid
    sleep 0.2
done
