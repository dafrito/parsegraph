#!/bin/bash
while true; do
    make autotest
    sleep 0.2
    make wait
done
