#!/bin/bash
if test -e ./demo.port; then
    export SITE_PORT=`cat ./demo.port`
fi
