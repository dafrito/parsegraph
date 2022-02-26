#!/bin/bash
files=
for f in $*; do
    if test -e $f; then
        files="$files $f"
    fi
done;
inotifywait -e modify -r $files
