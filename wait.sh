#!/bin/bash
files=
for f in $*; do
    if test -e $f; then
        files="$files $f"
    fi
done;

linked=
if test -d node_modules; then
    for mod in node_modules/*; do
        if test -h $mod; then
            linked="$linked $mod/dist"
        fi
    done
fi
echo $files $linked
fswatch --event=Updated -1 -r src demo
