#!/bin/bash
if test $# -gt 0; then
    SITE_PORT=$1
    shift
fi
npm run demo $SITE_PORT
