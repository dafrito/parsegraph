const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
require('ts-node').register({project:path.resolve(__dirname,'../../examples/tsconfig.json'),transpileOnly:true});
const {DirectionNode,DirectionCaret,Direction:D,Fit,CommitLayout}=require('../../src');
const result=spawnSync(process.argv[2],['--json'],{encoding:'utf8',timeout:30000});
assert.equal(result.status,0,result.stderr);
const actual=result.stdout.trim().split('\n').map(JSON.parse);let row=0;
for(let inward=0;inward<2;++inward) for(let creased=0;creased<2;++creased)
for(let opposing=0;opposing<2;++opposing) for(let pull=0;pull<2;++pull) {
 const n=[[10,10],[10,100],[100,10],[10,10],[10,20],[100,10],[10,10],[10,50],[80,10]].slice(0,opposing?9:6).map(v=>{const n=new DirectionNode(v);n.setNodeFit(Fit.EXACT);return n;});
 n[0].connect(D.DOWNWARD,n[1]);n[1].connect(D.FORWARD,n[2]);n[0].connect(D.FORWARD,n[3]);n[3].connect(D.DOWNWARD,n[4]);n[4].connect(D.FORWARD,n[5]);
 if(opposing){n[0].connect(D.BACKWARD,n[6]);n[6].connect(D.DOWNWARD,n[7]);n[7].connect(D.BACKWARD,n[8]);n[6].setScale(.5);}
 const host=inward?new DirectionNode([400,400]):null;
 if(creased)n[0].paintGroups().crease();
 if(host)host.connect(D.INWARD,n[0]);
 const c=new DirectionCaret(n[0]);c.pull(pull?D.FORWARD:D.DOWNWARD);
 for(let mode=0;mode<4;++mode){
  if(mode===1)n[0].setSeparationFit(D.FORWARD,Fit.LOOSE);
  if(mode===2)c.loosen();
  if(mode===3){n[0].setSeparationFit(D.FORWARD,Fit.EXACT);c.tighten();}
  const l=new CommitLayout(host||n[0],{size:(n,out)=>{out[0]=n.value()[0];out[1]=n.value()[1];}});
  let steps=0;while(l.crank())assert.ok(++steps<10000);
  n.forEach((node,i)=>{const r=actual[row++];assert.deepEqual([r.inward,r.creased,r.opposing,r.pull,r.mode,r.node],[inward,creased,opposing,pull,mode,i]);assert.ok(Math.abs(r.x-node.layout().absoluteX())<1e-6,JSON.stringify(r));assert.ok(Math.abs(r.y-node.layout().absoluteY())<1e-6,JSON.stringify(r));});
 }
}
assert.equal(row,actual.length);console.log(`${row} separation positions agree between C and TypeScript`);
