import{node,add,loft,plate,box,oval,ring,material}from'./kit.mjs';
export function buildExtras({mat,arm,save}){
 const m={...mat,iron:material('painted_black_iron',9,{metal:.24,rough:.64,color:[.12,.15,.21]}),lens:material('lens',9,{metal:.05,rough:.22,color:[.6,.14,1],emissive:[.36,.055,.7]}),cell:material('blue_energy_cell',8,{metal:.02,rough:.26,color:[.6,.85,1],emissive:[.06,.24,.65]}),spark:material('fuse_spark',12,{rough:.45,color:[1,.42,.06],emissive:[1,.24,.025]})};
 const tube=(part,rows,material,pos=[0,0,0],n=12)=>add(part,loft(rows,n,.92),material,pos,[0,0,-Math.PI/2]);
 const disc=(part,r,thick,material,pos,n=12)=>tube(part,[[-thick/2,r*.9,r*.9],[0,r,r],[thick/2,r*.9,r*.9]],material,pos,n);
 const bolt=(part,pos,material=m.silver,r=.012)=>add(part,oval([r,r,r],6,4),material,pos);
 // 0.22-diameter steel buckler, mounted at the left forearm. The game finds the exact material name "lens".
 const recon=node('arm_L'),cy=-arm*.68,cz=-.025;
 disc(recon,.110,.034,m.silver,[.045,cy,cz],16);
 disc(recon,.095,.038,m.gold,[.065,cy,cz],16);
 disc(recon,.078,.041,m.iron,[.086,cy,cz],16);
 disc(recon,.048,.043,m.silver,[.11,cy,cz],12);
 add(recon,oval([.022,.037,.037],12,7),m.lens,[.142,cy,cz]);
 for(const [y,z]of[[.07,0],[-.07,0],[0,.07],[0,-.07]])bolt(recon,[.112,cy+y,cz+z],m.silver,.008);
 add(recon,box(.04,.13,.025,.005),m.dark,[.015,cy,cz-.01]);
 save('recon',[recon]);
 // Chunky brass pistol with stacked barrel collars, a blue cell above the receiver and a rounded grip.
 const gun=node('Pulse_Blaster');
 add(gun,loft([[-.09,.027,.041],[-.065,.037,.048],[.035,.037,.047],[.08,.043,.05]],10,.78),m.leather,[.015,-.005,0],[0,0,-.17]);
 add(gun,box(.074,.023,.105,.007),m.gold,[.029,-.079,0]);
 tube(gun,[[-.02,.065,.066],[.035,.095,.095],[.09,.108,.102],[.245,.100,.099],[.305,.073,.079]],m.gold,[0,.105,0],12);
 tube(gun,[[.26,.065,.065],[.29,.078,.078],[.43,.078,.078],[.48,.067,.067],[.50,.058,.058]],m.iron,[0,.11,0],12);
 for(const x of[.29,.38,.455])disc(gun,.084,.027,m.gold,[x,.11,0],12);
 disc(gun,.058,.013,m.silver,[.499,.11,0],12);disc(gun,.042,.014,m.void,[.508,.11,0],12);
 tube(gun,[[.07,.042,.042],[.10,.053,.053],[.235,.053,.053],[.26,.042,.042]],m.cell,[0,.228,0],12);
 for(const x of[.075,.25])disc(gun,.057,.022,m.gold,[x,.228,0],12);
 add(gun,box(.21,.025,.085,.006),m.silver,[.16,.192,0]);
 for(const z of[-.098,.098]){add(gun,plate([[-.04,-.032],[.06,-.032],[.075,.025],[-.06,.025]],.014,.005),m.iron,[.15,.10,z]);for(const x of[.105,.205])bolt(gun,[x,.11,z],m.silver,.01)}
 add(gun,plate([[-.01,0],[.07,0],[.095,-.05],[.055,-.07],[.015,-.045]],.025,.006),m.gold,[.065,.035,0]);
 save('blaster',[gun]);
 // Same painted iron construction at two sizes. Held origin is the grip; planted origin is the floor.
 for(const planted of[false,true]){
 const bomb=node(planted?'Cannonball_Bomb_Planted':'Cannonball_Bomb_Held'),r=planted?.17:.14,cx=planted?0:.085,cy=planted?r:.015;
 add(bomb,oval([r,r,r],16,10),m.iron,[cx,cy,0]);
 add(bomb,ring(r+.002,r+.002,.011,16),m.gold,[cx,cy,0]);
 for(const z of[-1,1])bolt(bomb,[cx+r*.70,cy+.013,z*r*.70],m.silver,.009);
 add(bomb,loft([[-.01,.032,.032],[.01,.041,.041],[.027,.029,.029]],10,.88),m.gold,[cx,cy+r-.01,0]);
 add(bomb,loft([[0,.012,.012],[.028,.011,.011]],8,1),m.leather,[cx,cy+r+.011,0],[0,0,-.30]);
 add(bomb,loft([[0,.011,.011],[.018,.008,.008]],8,1),m.leather,[cx+.008,cy+r+.036,0],[0,0,-.65]);
 add(bomb,oval([.017,.016,.014],8,5),m.spark,[cx+.019,cy+r+.052,0]);
 for(const z of[-.013,.013])add(bomb,box(.008,.028,.006,.001),m.spark,[cx+.026,cy+r+.058,z],[.5,0,-.7]);
 save(planted?'blast-planted':'blast-held',[bomb]);
 }
}
