#!/bin/bash
make clean && npm run build && npm run coverage && npm publish
