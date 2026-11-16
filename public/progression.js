export const VAULT_STAGES=Object.freeze([
  {key:'small',label:'小型金庫',zone:'コンビニ / カウンター裏',start:1,end:10,total:10,increase:2},
  {key:'medium',label:'中型金庫',zone:'銀行 / 支店の保管庫',start:11,end:15,total:5,increase:3},
  {key:'large',label:'大型金庫',zone:'大型銀行 / 本店の大金庫',start:16,end:null,total:null,increase:1}
]);
export function vaultStage(depth){
  const d=Math.max(1,Math.floor(Number(depth)||1));
  const index=d<=10?0:d<=15?1:2;
  return {...VAULT_STAGES[index],index,step:d-VAULT_STAGES[index].start+1,deepest:index===2};
}
export function alarmChanceAtDepth(depth){
  const d=Math.max(1,Math.floor(Number(depth)||1));
  return Math.min(70,1+Math.min(d-1,9)*2+Math.min(Math.max(d-10,0),5)*3+Math.max(d-15,0));
}
