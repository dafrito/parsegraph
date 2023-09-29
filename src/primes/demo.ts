import PrimesWidget from "./PrimesWidget";
import Navport, { render } from "parsegraph-viewport";
import TimingBelt from "parsegraph-timingbelt";
import { elapsed } from "parsegraph-timing";
import { BasicProjector } from "parsegraph-projector";

document.addEventListener("DOMContentLoaded", () => {
  const viewport = new Navport(null);

  const primes = new PrimesWidget();

  const belt = new TimingBelt();

  const totalStart = new Date();
  const MAX_PRIME = 1000;
  belt.setGovernor(false);
  belt.setBurstIdle(true);
  belt.queueJob(() => {
    console.log("Processing primes: " + primes.position + " of " + MAX_PRIME);
    if (!primes.isPaused() && primes.position <= MAX_PRIME) {
      primes.step();
    }
    primes.node().value().scheduleRepaint();
    belt.scheduleUpdate();
    if (primes.position > MAX_PRIME) {
      console.log("Done in " + elapsed(totalStart) + "ms");
    }
    return primes.position <= MAX_PRIME;
  });

  primes.step();

  const topElem = document.getElementById("demo");
  topElem.style.position = "relative";

  const root = primes.node();
  viewport.setRoot(root);
  viewport.showInCamera(root);
  render(topElem, viewport, new BasicProjector(), belt);
});
