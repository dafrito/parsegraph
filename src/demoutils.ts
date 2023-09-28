interface BlockStyle {
  minWidth: number;
  minHeight: number;
  borderThickness: number;
  verticalPadding: number;
  horizontalPadding: number;
  verticalSeparation: number;
  horizontalSeparation: number;
}

const BLOCK_STYLE = {
  minWidth: 200,
  minHeight: 100,
  borderThickness: 4,
  verticalPadding: 2,
  horizontalPadding: 4,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const BUD_STYLE = {
  minWidth: 30,
  minHeight: 30,
  borderThickness: 4,
  verticalPadding: 4,
  horizontalPadding: 4,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const EMPTY_STYLE = {
  minWidth: 100,
  minHeight: 100,
  borderThickness: 0,
  verticalPadding: 0,
  horizontalPadding: 0,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const readStyle = (given?: any): BlockStyle => {
  if (given && typeof given === "object") {
    // Assume it is already a style.
    return given;
  }
  if (given && !given.toUpperCase) {
    throw new Error("Not a string" + given + " " + JSON.stringify(given));
  }
  switch (given?.toUpperCase()) {
    case "B":
    case "BLOCK":
      return BLOCK_STYLE;
    case "BU":
    case "U":
    case "BUD":
      return BUD_STYLE;
    default:
      return EMPTY_STYLE;
  }
};

export {
  readStyle,
  BlockStyle
}
