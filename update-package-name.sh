#!/bin/bash

sed -i "s/microproject/$1/" .git/config
git ls-files | xargs sed -i "s/TODO-PACKAGE-NAME/$1/g" && echo Now run git rm -f $0 to remove this file.



