export function perceptualGain(value){
 const level=Math.max(0,Math.min(1,Number(value)||0));
 return level*level;
}
