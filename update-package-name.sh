#!/bin/bash

sed -i "s/microproject/$1/" .git/config
git ls-files | xargs sed -i "s/TODO-PACKAGE-NAME/$1/" && echo You may now remove $0.



