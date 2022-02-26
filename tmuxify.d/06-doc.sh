#!/bin/bash
while true; do
    make doc
    sleep 0.2
    make wait
done
