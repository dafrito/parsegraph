import DirectionCaret from "./direction/DirectionCaret";
import AxisOverlap from "./direction/AxisOverlap";

const buildGraph = () => {
  const car = new DirectionCaret("b");

  const choices = ["f", "b", "d", "u"];
  for (let i = 0; i < 1000; ++i) {
    let choice: string;
    do {
      choice = choices[Math.floor(Math.random() * choices.length)];
    } while (car.has(choice));
    car.spawnMove(choice, "u");
    if (i % 10 === 0) {
      car.crease();
    }
    // car.node().state().setNodeFit(Fit.EXACT)
    /*car.node().setAxisOverlap(AxisOverlap.ALLOWED);
    car.node().setValue({
      minHeight: 100,
      minWidth: 100,
      borderThickness: 16,
      verticalPadding: 3,
      horizontalPadding: 3,
      verticalSeparation: 4,
      horizontalSeparation: 4,
    });*/
  }

  return car.root();
};

export default buildGraph;
