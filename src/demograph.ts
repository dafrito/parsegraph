import DirectionCaret from './direction/DirectionCaret';
import AxisOverlap from './direction/AxisOverlap';

const buildGraph = () => {
  const car = new DirectionCaret("b");

  const choices = ["f", "b", "d", "u"];
  for (let i = 0; i < 10; ++i) {
    let choice: string;
    do {
      choice = choices[Math.floor(Math.random() * choices.length)];
    } while (car.has(choice));
    car.spawnMove(choice);
    // car.node().state().setNodeFit(Fit.EXACT)
    car.node().setAxisOverlap(AxisOverlap.ALLOWED);
    car.node().setValue({
      minHeight: 10,
      minWidth: 10,
      borderThickness: 2,
      verticalPadding: 3,
      horizontalPadding: 3,
      verticalSeparation: 4,
      horizontalSeparation: 4,
    });
  }

  return car.root();
};

export default buildGraph;
