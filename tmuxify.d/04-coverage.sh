#!/bin/bash
while true; do
    make coverage
    sleep 0.2
    make wait
done
