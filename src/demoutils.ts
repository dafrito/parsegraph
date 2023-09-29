import Color from "parsegraph-color";

interface BlockStyle {
  minWidth: number;
  minHeight: number;
  borderThickness: number;
  verticalPadding: number;
  horizontalPadding: number;
  verticalSeparation: number;
  horizontalSeparation: number;
  borderRoundedness: number;
  borderColor: Color;
  backgroundColor: Color;
}

const BLOCK_STYLE = {
  minWidth: 200,
  minHeight: 100,
  borderThickness: 16,
  verticalPadding: 2,
  horizontalPadding: 4,
  horizontalSeparation: 30,
  verticalSeparation: 30,
  borderRoundedness: 16,
  backgroundColor: new Color(0.5, 0.5, 0.5, 1),
  borderColor: new Color(1, 1, 1, 1),
};

const BUD_STYLE = {
  minWidth: 30,
  minHeight: 30,
  borderThickness: 30,
  verticalPadding: 0,
  horizontalPadding: 0,
  horizontalSeparation: 30,
  verticalSeparation: 30,
  borderRoundedness: 90,
  borderColor: new Color(0.5, 0.5, 0.5, 1),
  backgroundColor: new Color(1, 1, 1, 1),
};

const EMPTY_STYLE = {
  minWidth: 100,
  minHeight: 100,
  borderThickness: 0,
  verticalPadding: 0,
  horizontalPadding: 0,
  horizontalSeparation: 10,
  verticalSeparation: 10,
  borderRoundedness: 0,
  borderColor: new Color(0, 0, 0, 0),
  backgroundColor: new Color(0, 0, 0, 0),
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

export { readStyle, BlockStyle };
