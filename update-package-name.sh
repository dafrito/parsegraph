#!/bin/bash

git ls-files | xargs sed -i "s/TODO-PACKAGE-NAME/$1/"
