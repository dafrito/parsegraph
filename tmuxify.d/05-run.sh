#!/bin/bash
if test $# -gt 0; then
    SITE_PORT=$1
    shift
fi
make demo SITE_PORT=$SITE_PORT
