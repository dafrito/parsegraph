#!/bin/bash
while true; do
    make build SITE_URL=$SITE_URL SITE_PORT=$SITE_PORT &
    make wait
done
