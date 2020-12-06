#!/bin/bash
make clean && npm run build && npm run coverage && make esdoc && npm publish
