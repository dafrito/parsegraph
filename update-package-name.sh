#!/bin/bash
set -e

PACKAGE_NAME=$1
if test z"$PACKAGE_NAME" = z; then
  DEFAULT_NAME=`basename $(pwd)`
  echo -n "Enter the package name (blank for $DEFAULT_NAME):"
  read PACKAGE_NAME

  if test z"$PACKAGE_NAME" = z; then
    PACKAGE_NAME=$DEFAULT_NAME
  fi
fi
echo package name is $PACKAGE_NAME

sed -i "s/microproject/$PACKAGE_NAME/g" .git/config
git mv src/index.ts src/$PACKAGE_NAME.ts
git ls-files | xargs sed -i "s/TODO-PACKAGE-NAME/$PACKAGE_NAME/g"
git rm -f $0
git add .
git commit -m"Rename to $PACKAGE_NAME"
echo Rename to $PACKAGE_NAME complete.
cat ./README.md
npm i
