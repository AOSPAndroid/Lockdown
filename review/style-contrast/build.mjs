import{mkdirSync,writeFileSync,readFileSync}from'node:fs';
import{fileURLToPath}from'node:url';
import{T,node,add,loft,plate,box,oval,ring,geometry,material,referenceRig,writeGlb}from'./kit.mjs';
const output=new URL('./models/',import.meta.url),atlas=new URL('./painted-atlas.png',import.meta.url);
const styles=[
 {id:'arc',name:'Arc',row:0,n:20,exp:.94,bevel:.014,line:'Broad curves, swept shells and clean glossy paint.'},
 {id:'cut',name:'Cut',row:1,n:8,exp:.55,bevel:.008,line:'Faceted planes, wide chamfers and graphic contrast.'},
 {id:'stack',name:'Stack',row:2,n:12,exp:.75,bevel:.009,line:'Overlapping bands, rolled rims and visible brushwork.'}
];
writeFileSync(new URL('./styles.json',import.meta.url),JSON.stringify(styles,null,2));
function star(r,inner,num=5){return Array.from({length:num*2},(_,i)=>{const a=Math.PI/2+i*Math.PI/num,d=i%2?inner:r;return[Math.cos(a)*d,Math.sin(a)*d]})}
function ellipse(x,y,num=20){return Array.from({length:num},(_,i)=>{const a=i*2*Math.PI/num;return[Math.cos(a)*x,Math.sin(a)*y]})}
function capHair(h,w,s){const ps=[],ix=[],n=s.n;for(let r=0;r<5;r++)for(let j=0;j<n;j++){const a=2*Math.PI*j/n,front=Math.max(0,Math.cos(a)),back=Math.max(0,-Math.cos(a)),t=r/4,base=h*(.44+.24*front-.17*back),radius=[1.04,1.04,.90,.56,.015][r],height=r===0?base:h*[0,.78,.91,.99,1.015][r];ps.push(Math.cos(a)*w*.49*radius-.012*t,height,Math.sin(a)*w*.51*radius)}for(let r=0;r<4;r++)for(let j=0;j<n;j++){const a=r*n+j,b=r*n+(j+1)%n;ix.push(a,a+n,b,b,a+n,b+n)}return geometry(ps,ix)}
for(const style of styles){
 const{roots,parts}=referenceRig(new URL('../../docs/reference/knight_rig_4_heads.glb',import.meta.url));
 const H=1.3-(parts.hips.translation[1]+parts.chest.translation[1]+parts.head.translation[1]),W=H*1.08,depth=W*.93,tall=parts.head.translation[1]-.06,leg=-parts.foot_L.translation[1],arm=-parts.hand_L.translation[1],rArm=parts.hand_R.translation[0];
 const dir=new URL(style.id+'-D/',output);mkdirSync(dir,{recursive:true});const desc=`TEMPORARY ${style.name} art direction, approved D proportions; not production assets`;
 const mat={skin:material('painted_skin',15,{rough:.7}),shirt:material('painted_cream_shirt',style.row*4+3,{rough:.82}),hair:material('painted_sculpted_hair',14,{rough:style.row===0?.3:.6}),dark:material('painted_charcoal_fabric',13,{rough:.85}),leather:material('painted_scout_leather',style.row*4+2,{rough:.7}),blue:material('painted_cobalt_steel',style.row*4,{metal:style.row===0?.30:.04,rough:[.30,.67,.83][style.row]}),silver:material('painted_silver_rims',style.row*4+1,{metal:style.row===0?.3:.04,rough:[.30,.65,.80][style.row]}),gold:material('painted_brass',12,{metal:.16,rough:.5}),team:material('team_trim',style.row*4+3,{rough:.6}),eye:material('glossy_dark_eyes',13,{rough:.10,color:[.012,.017,.025]}),white:material('eye_catchlights',1,{rough:.25,emissive:[.4,.4,.4]}),void:material('visor_shadow',13,{rough:.96,color:[.016,.023,.035]}),glow:material('blue_eye_lights',1,{rough:.35,color:[.3,.72,1],emissive:[.3,.72,1]}),red:material('pommel_glowing_red_gem',12,{rough:.30,color:[1,.1,.08],emissive:[.85,.035,.02]})};
 const b=style.bevel,n=style.n,e=style.exp,i=style.row;
 function save(name,rs){if(i===1)for(const root of rs){const walk=q=>{for(const s of q.surfaces)if(s.mat!==mat.eye&&s.mat!==mat.white&&s.mat!==mat.glow){s.geo=s.geo.toNonIndexed?s.geo.clone():s.geo;s.geo.computeVertexNormals()}q.children.forEach(walk)};walk(root)}writeGlb(fileURLToPath(new URL(name+'.glb',dir)),rs,atlas,desc+' / '+name)}
 function fp(p,poly,d,m,pos=[0,0,0],bevel=b){add(p,plate(poly,d,bevel),m,pos,[0,Math.PI/2,0],'xy')}
 function rim(p,rx,rz,y,m=mat.silver,t=.01){add(p,ring(rx,rz,t,n),m,[0,y,0])}
 function stud(p,pos,r=.013,m=mat.silver){add(p,oval([r*.65,r,r],8,5),m,pos)}
 // Same D anatomy and height in every column. Changes here are surface and shape language.
 add(parts.hips,loft([[-.055,.083,.105],[.025,.09,.12],[.059,.082,.103]],n,e),mat.dark);
 rim(parts.hips,.085,.108,.049,mat.gold,.006);
 add(parts.chest,loft([[0,.077,.102],[.035,.082,.11],[tall*.57,.103,.142],[tall*.85,.108,.151],[tall,.084,.127]],n,e),mat.shirt,[0,0,0],[0,0,0],'front');
 rim(parts.chest,.080,.108,.018,mat.team,.007);
 add(parts.chest,loft([[tall-.012,.055,.064],[tall+.045,.048,.055],[tall+.061,.05,.055]],12,.82),mat.skin);
 rim(parts.chest,.058,.068,tall+.002,mat.team,.009);
 add(parts.head,loft([[.015,depth*.27,W*.31],[H*.12,depth*.40,W*.43],[H*.43,depth*.47,W*.49],[H*.72,depth*.48,W*.49],[H*.90,depth*.40,W*.43],[H*.96,depth*.23,W*.28]],n,i===1?.48:.8),mat.skin,[0,0,0],[0,0,0],'front',.12);
 for(const sign of[-1,1]){const z=sign*W*.168,x=depth*.477;
 add(parts.head,box(.045,H*.18,.030,.006),mat.skin,[0,H*.46,sign*W*.485]);
 add(parts.head,oval([.013,H*.103,W*.060],16,10),mat.eye,[x,H*.466,z]);
 add(parts.head,oval([.006,H*.028,W*.017],10,6),mat.white,[x+.012,H*.495,z-.008]);
 fp(parts.head,[[-W*.066,0],[W*.066,.008],[W*.064,.019],[-W*.058,.016]],.007,mat.hair,[x-.002,H*.597,z],.002);
 }
 add(parts.head,loft([[H*.33,.008,.009],[H*.39,.019,.014],[H*.44,.006,.009]],8,.7),mat.skin,[depth*.473,0,0]);
 for(const side of['L','R']){const a=parts['arm_'+side],hand=parts['hand_'+side],right=side==='R',len=right?rArm:arm,pose=right?[0,0,-Math.PI/2]:[0,0,Math.PI];
 add(a,loft([[0,.046,.047],[len*.42,.040,.040],[len*.55,.037,.037],[len*.92,.029,.031],[len,.030,.032]],8,.72),mat.skin,[0,0,0],pose);
 add(a,loft([[-.012,.055,.057],[.065,.052,.052],[.092,.048,.049]],n,e),mat.shirt,[0,0,0],pose);
 add(a,ring(.050,.051,i===2?.014:.007,16),mat.team,right?[.086,0,0]:[0,-.086,0],right?[0,0,Math.PI/2]:[0,0,0]);
 add(hand,box(.075,.074,.068,.009),mat.skin,[.003,0,0]);add(hand,box(.027,.045,.027,.007),mat.skin,[.027,-.012,right?-.035:.035]);
 const l=parts['leg_'+side],foot=parts['foot_'+side];
 add(l,loft([[-leg,.032,.034],[-leg*.55,.039,.041],[-.04,.046,.049],[.015,.046,.049]],8,.72),mat.skin);
 add(l,loft([[-.105,.052,.057],[.025,.055,.058]],n,e),mat.dark);rim(l,.051,.057,-.10,mat.dark,i===2?.012:.005);
 add(foot,loft([[-.080,.080,.044,.025],[-.066,.092,.049,.031],[-.025,.091,.050,.027],[.006,.066,.041,.01]],n,.6),mat.dark);
 add(foot,box(.065,.012,.079,.004),mat.leather,[.037,-.012,0]);
 }
 save('body',roots);
 // Hair: a sweeping wave / three cut wedges / four compact curls, same brown in all three.
 const hair=node('head');add(hair,capHair(H,W,style),mat.hair);
 if(i===0){for(const [z,ang]of[[-W*.13,-.22],[W*.15,.22]])add(hair,oval([depth*.31,H*.18,W*.29],16,8),mat.hair,[depth*.29,H*.83,z],[ang,0,.18]);fp(hair,[[-W*.46,H*.76],[-W*.27,H*.89],[W*.28,H*.77],[W*.04,H*.57],[-W*.18,H*.62]],.03,mat.hair,[depth*.45,0,0],.016)}
 else if(i===1){for(const [z,yy]of[[-.25,.88],[0,.94],[.26,.84]])fp(hair,[[-W*.18,H*.16],[W*.18,H*.18],[W*.16,-H*.06],[-W*.08,-H*.18]],.065,mat.hair,[depth*.37,H*yy,z*W],.006)}
 else{for(const z of[-.30,-.10,.10,.30])add(hair,oval([depth*.24,H*.20,W*.16],10,6),mat.hair,[depth*.33,H*.80,z*W],[0,0,-.35]);for(const sign of[-1,1])add(hair,box(.10,H*.24,.045,.01),mat.hair,[0,H*.58,sign*W*.45])}
 save('hair',[hair]);
 const helm=node('head'),rx=depth*.56,rz=W*.58;
 // ARC's swept dome, CUT's broad planar bucket, STACK's cylindrical drum remain great helms.
 const helmRows=i===0?[[.0,rx*.83,rz*.87],[H*.33,rx,rz],[H*.67,rx,rz],[H*.87,rx*.88,rz*.92],[H*1.02,rx*.53,rz*.64],[H*1.07,.01,.02]]:i===1?[[.0,rx*.76,rz*.86],[H*.16,rx*.98,rz],[H*.67,rx*1.02,rz*1.06],[H*.96,rx*.98,rz*1.03],[H*1.08,rx*.72,rz*.77]]:[[.0,rx*.9,rz*.91],[H*.16,rx,rz],[H*.84,rx,rz],[H*.98,rx*.9,rz*.91],[H*1.02,rx*.63,rz*.64]];
 add(helm,loft(helmRows,n,e),mat.blue,[0,0,0],[0,0,0],'front');
 rim(helm,rx*.92,rz*.96,H*.11,mat.silver,i===0?.012:.016);
 fp(helm,[[-W*.46,H*.43],[W*.46,H*.43],[W*.46,H*.60],[-W*.46,H*.60]],.012,mat.void,[rx+.008,0,0],.005);
 fp(helm,[[-W*.052,H*.11],[W*.052,H*.11],[W*.052,H*.52],[-W*.052,H*.52]],.013,mat.void,[rx+.012,0,0],.003);
 const brow=i===0?[[-W*.48,H*.61],[-W*.28,H*.69],[W*.28,H*.69],[W*.48,H*.61],[W*.42,H*.58],[-W*.42,H*.58]]:i===1?[[-W*.53,H*.66],[0,H*.58],[W*.53,H*.66],[W*.45,H*.78],[0,H*.71],[-W*.45,H*.78]]:[[-W*.50,H*.62],[W*.50,H*.62],[W*.50,H*.73],[-W*.50,H*.73]];
 fp(helm,brow,.025,mat.silver,[rx+.016,0,0],b);
 for(const sign of[-1,1]){stud(helm,[rx+.03,H*.515,sign*W*.17],.013,mat.glow);for(const yy of[H*.25,H*.82])stud(helm,[rx*.91,yy,sign*W*.40],i===2?.017:.011)}
 if(i===0){add(helm,plate([[-.12,0],[-.18,.04],[-.14,.10],[.06,.09],[.09,.035],[.055,0]],.055,.017),mat.blue,[-.03,H*1.02,0]);}
 if(i===1){add(helm,plate([[-.14,0],[-.16,.10],[.055,.14],[.11,.05],[.035,0]],.058,.008),mat.blue,[-.015,H*1.04,0]);fp(helm,[[-W*.42,.04],[-W*.28,.02],[-W*.23,H*.41],[-W*.45,H*.42]],.02,mat.silver,[rx*.93,0,0]);fp(helm,[[W*.42,.04],[W*.28,.02],[W*.23,H*.41],[W*.45,H*.42]],.02,mat.silver,[rx*.93,0,0]);}
 if(i===2){for(const yy of[H*.34,H*.88])rim(helm,rx*1.01,rz*1.01,yy,mat.silver,.014);add(helm,plate([[-.14,0],[-.16,.08],[-.04,.11],[.07,.08],[.08,0]],.10,.01),mat.blue,[-.015,H*.99,0]);for(const z of[-.028,0,.028])add(helm,plate([[-.14,0],[-.16,.08],[-.04,.11],[.07,.08],[.08,0]],.015,.004),mat.blue,[-.015,H*1.02,z]);}
 save('cobalt-helmet',[helm]);
 // Sallet variations: smooth swept shell; broad chamfered shell; shell over three neck lames.
 const sallet=node('head');
 const salRows=i===0?[[H*.20,rx*.92,rz*.92,-.025],[H*.40,rx*1.22,rz*1.05,-.055],[H*.70,rx*1.02,rz*1.04,-.01],[H*.95,rx*.77,rz*.87,-.025],[H*1.08,.01,.02,-.05]]:i===1?[[H*.18,rx*.92,rz*.94,-.02],[H*.42,rx*1.16,rz*1.12,-.04],[H*.83,rx*.99,rz*1.08,-.01],[H*1.05,rx*.78,rz*.80,-.02]]:[[H*.18,rx*.91,rz*.92,-.02],[H*.43,rx*1.12,rz*1.02,-.04],[H*.79,rx,rz*1.04],[H*.98,rx*.76,rz*.84],[H*1.06,.01,.02]];
 add(sallet,loft(salRows,n,e),mat.silver,[0,0,0],[0,0,0],'front');
 fp(sallet,[[-W*.47,H*.42],[W*.47,H*.42],[W*.47,H*.53],[-W*.47,H*.53]],.015,mat.void,[rx+.018,0,0],.006);
 fp(sallet,[[-W*.49,H*.55],[W*.49,H*.55],[W*.48,H*.58],[-W*.48,H*.58]],.016,mat.team,[rx+.018,0,0],.004);
 for(const sign of[-1,1])stud(sallet,[rx+.034,H*.48,sign*W*.17],.012,mat.glow);
 if(i===0)add(sallet,loft([[H*.20,.12,rz*.90,-rx],[H*.30,.15,rz,-rx],[H*.43,.10,rz*.92,-rx]],16,.92),mat.silver);
 else if(i===1){add(sallet,loft([[H*.17,.13,rz*.90,-rx],[H*.32,.18,rz*1.05,-rx],[H*.43,.10,rz*.98,-rx]],8,.52),mat.silver);add(sallet,plate([[-rx*1.12,0],[-rx*.7,.075],[rx*.62,.04],[rx*.85,0]],.025,.008),mat.silver,[0,H*.97,0]);}
 else{for(let k=0;k<3;k++){add(sallet,loft([[H*(.14+k*.08),.12,rz*(.82+k*.06),-rx*(1.05-k*.04)],[H*(.23+k*.08),.13,rz*(.87+k*.06),-rx*(1.04-k*.04)]],12,.8),mat.silver);rim(sallet,rx*(1.03+k*.01),rz*(.97+k*.015),H*(.31+k*.10),mat.silver,.008)}for(const sign of[-1,1])stud(sallet,[rx*.82,H*.66,sign*W*.43],.016)}
 save('sallet',[sallet]);
 // Armour: rounded arcs, a cut breastplate, or layered bands. The waist and the star are constant.
 const chest=node('chest'),al=node('arm_L'),ar=node('arm_R'),hip=node('hips');
 add(chest,loft([[.005,.089,.110],[.045,.093,.116],[tall*.60,.120,.153],[tall*.92,.119,.161],[tall+.01,.09,.129]],n,e),mat.blue,[0,0,0],[0,0,0],'front');
 rim(chest,.094,.117,.032,mat.silver,.011);
 if(i===0){fp(chest,ellipse(.11,tall*.39),.016,mat.silver,[.12,tall*.57,0],.015);fp(chest,ellipse(.092,tall*.33),.02,mat.blue,[.14,tall*.57,0],.012)}
 else if(i===1){const poly=[[-.11,tall*.90],[0,tall*1.01],[.11,tall*.90],[.094,tall*.25],[0,tall*.10],[-.094,tall*.25]];fp(chest,poly,.02,mat.silver,[.123,0,0],.011);fp(chest,poly.map(([x,y])=>[x*.82,(y-tall*.5)*.85+tall*.5]),.02,mat.blue,[.150,0,0],.008);fp(chest,[[-.011,tall*.23],[.011,tall*.23],[.012,tall*.92],[-.012,tall*.92]],.006,mat.silver,[.173,0,0],.003)}
 else{for(let k=0;k<3;k++){const yy=tall*(.23+k*.25),width=.091+k*.009;fp(chest,[[-width,yy-.055],[width,yy-.055],[width+.014,yy+.055],[-width-.014,yy+.055]],.018,mat.silver,[.117+k*.01,0,0],.008);fp(chest,[[-width+.008,yy-.035],[width-.008,yy-.035],[width+.004,yy+.046],[-width-.004,yy+.046]],.022,mat.blue,[.137+k*.01,0,0],.005)}}
 fp(chest,star(.052,.024),.014,mat.silver,[i===1?.19:.175,tall*.66,0],.004);
 for(const[a,right]of[[al,false],[ar,true]]){const py=right?.052:0,sg=right?1:-1;
 if(i===0){add(a,loft([[-.09,.085,.102,0,sg*.02],[-.045,.12,.145,0,sg*.035],[.025,.14,.16,0,sg*.035],[.095,.11,.12,0,sg*.03],[.13,.025,.03,0,sg*.03]],20,.95),mat.silver,[0,py,0]);add(a,loft([[-.06,.086,.102,0,sg*.025],[.005,.13,.145,0,sg*.035],[.075,.11,.115,0,sg*.035],[.12,.02,.025,0,sg*.03]],20,.95),mat.blue,[0,py+.013,0]);}
 else if(i===1){add(a,loft([[-.06,.082,.09,0,sg*.015],[.015,.15,.145,0,sg*.045],[.095,.14,.14,0,sg*.045],[.145,.065,.075,0,sg*.03]],8,.48),mat.silver,[0,py,0]);add(a,loft([[.015,.13,.125,0,sg*.045],[.10,.125,.125,0,sg*.045],[.145,.055,.065,0,sg*.03]],8,.48),mat.blue,[0,py+.012,0]);}
 else{for(let k=0;k<3;k++){const y=py+.035-k*.065;add(a,loft([[-.035,.085,.10],[.02,.115,.13],[.075,.085,.10]],12,.82),mat.silver,[0,y,sg*(.025+k*.009)]);add(a,loft([[-.015,.088,.102],[.035,.104,.12],[.078,.076,.09]],12,.82),mat.blue,[.004,y+.005,sg*(.025+k*.009)]);}stud(a,[.108,py+.055,sg*.03],.015)}
 add(a,loft([[.13,.048,.046],[.24,.040,.041],[.29,.045,.046]],n,e),mat.blue,[0,0,0],right?[0,0,-Math.PI/2]:[0,0,Math.PI]);add(a,ring(.047,.048,.01,16),mat.silver,right?[rArm-.02,0,0]:[0,-arm+.02,0],right?[0,0,Math.PI/2]:[0,0,0]);
 }
 const tab=i===0?[[-.085,.06],[.085,.06],[.08,-.16],[.04,-.205],[0,-.215],[-.04,-.205],[-.08,-.16]]:i===1?[[-.085,.06],[.085,.06],[.07,-.17],[0,-.225],[-.07,-.17]]:[[-.083,.06],[.083,.06],[.083,-.20],[.014,-.20],[0,-.13],[-.014,-.20],[-.083,-.20]];
 fp(hip,tab,.018,mat.blue,[.105,0,0],.006);fp(hip,[[-.016,.04],[.016,.04],[.016,-.16],[-.016,-.16]],.005,mat.team,[.126,0,0],.003);
 save('cobalt-armor',[chest,al,ar,hip]);
 const pants=[node('hips'),node('leg_L'),node('leg_R')];add(pants[0],loft([[-.055,.092,.116],[.052,.092,.12]],n,e),mat.dark);
 for(const p of pants.slice(1)){add(p,loft([[-leg,.037,.040],[-leg*.52,.044,.047],[.03,.052,.054]],n,e),mat.dark);
 if(i===0){fp(p,ellipse(.055,.105),.025,mat.silver,[.058,-.075,0],.009);fp(p,ellipse(.044,.09),.025,mat.blue,[.079,-.075,0],.008)}
 else if(i===1){fp(p,[[-.055,.025],[.055,.025],[.055,-.14],[0,-.20],[-.055,-.14]],.024,mat.silver,[.058,0,0]);fp(p,[[-.044,.014],[.044,.014],[.044,-.13],[0,-.177],[-.044,-.13]],.024,mat.blue,[.078,0,0],.005)}
 else{for(let k=0;k<3;k++){fp(p,[[-.053,.02],[.053,.02],[.049,-.06],[-.049,-.06]],.02,mat.silver,[.058,-k*.055,0],.006);fp(p,[[-.044,.017],[.044,.017],[.041,-.045],[-.041,-.045]],.024,mat.blue,[.079,-k*.055,0],.004)}}
 for(const z of[-.034,.034])stud(p,[.105,-.015,z],.009);
 }
 save('cobalt-pants',pants);
 // Scout remains a fitted tan jerkin with small guards and a canteen in all directions.
 const sc=node('chest'),sl=node('arm_L'),sr=node('arm_R'),sh=node('hips');
 add(sc,loft([[-.015,.084,.111],[.04,.092,.12],[tall*.65,.114,.149],[tall+.007,.107,.151]],n,e),mat.leather,[0,0,0],[0,0,0],'front');rim(sc,.09,.117,.025,mat.dark,i===2?.021:.014);
 fp(sc,[[-.025,-.008],[.025,-.008],[.025,.046],[-.025,.046]],.014,mat.gold,[.104,0,0],.004);
 if(i===0){fp(sc,[[-.13,tall],[-.10,tall],[.075,.045],[.05,.025]],.01,mat.dark,[.12,0,0],.012);fp(sc,ellipse(.077,.12),.008,mat.leather,[.135,tall*.55,0],.012);}
 else if(i===1){fp(sc,[[-.145,tall],[-.09,tall*.97],[.09,.05],[.055,.02]],.013,mat.dark,[.123,0,0],.005);fp(sc,[[-.09,tall*.75],[0,tall*.93],[.10,tall*.73],[.055,tall*.34],[-.07,tall*.34]],.015,mat.leather,[.142,0,0],.005);fp(sc,[[-.014,tall*.24],[.014,tall*.24],[.014,tall*.90],[-.014,tall*.90]],.007,mat.dark,[.162,0,0],.003)}
 else{for(let k=0;k<2;k++){fp(sc,[[-.10,.02],[.10,.02],[.11,.11],[-.11,.11]],.012,mat.leather,[.13,.06+k*.13,0],.006)}for(const z of[-.055,.055]){fp(sc,[[z-.012,tall*.15],[z+.012,tall*.15],[z+.012,tall],[z-.012,tall]],.01,mat.dark,[.149,0,0],.004);for(const y of[.10,.22])stud(sc,[.16,y,z],.009,mat.gold)}}
 for(const[a,right]of[[sl,false],[sr,true]]){const py=right?.05:0;
 if(i===0){add(a,loft([[-.035,.06,.07],[.025,.092,.105],[.075,.055,.065]],16,.93),mat.dark,[0,py,0]);add(a,loft([[-.005,.062,.073],[.035,.083,.096],[.075,.045,.055]],16,.93),mat.leather,[.003,py+.008,0]);}
 else if(i===1){add(a,loft([[-.035,.06,.07],[.025,.10,.11],[.085,.071,.084]],8,.5),mat.dark,[0,py,0]);add(a,loft([[.005,.067,.077],[.04,.089,.10],[.085,.058,.069]],8,.5),mat.leather,[.004,py+.01,0]);}
 else{for(let k=0;k<2;k++){add(a,loft([[-.03,.065,.075],[.025,.090,.10],[.065,.055,.065]],12,.8),mat.dark,[0,py-k*.055,0]);add(a,loft([[-.01,.064,.075],[.03,.081,.09],[.065,.048,.058]],12,.8),mat.leather,[.004,py+.006-k*.055,0])}}
 }
 add(sh,loft([[-.13,.048,.063],[-.11,.060,.074],[.025,.055,.068],[.046,.029,.035]],n,e),mat.leather,[-.03,-.01,-.17]);add(sh,box(.05,.025,.049,.005),mat.silver,[-.03,.048,-.17]);add(sh,ring(.041,.058,.006,16),mat.dark,[-.03,-.055,-.17]);save('scout',[sc,sl,sr,sh]);
 // Guardian: same catalogue shield, expressed through arcs / bevelled planes / segmented rim.
 const shield=node('arm_L'),poly=i===0?[[-.23,.30],[-.12,.34],[.12,.34],[.23,.30],[.26,.17],[.22,-.14],[.13,-.27],[0,-.36],[-.13,-.27],[-.22,-.14],[-.26,.17]]:i===1?[[-.25,.32],[.25,.32],[.27,.20],[.21,-.18],[0,-.36],[-.21,-.18],[-.27,.20]]:[[-.24,.32],[.24,.32],[.26,.23],[.23,-.14],[.14,-.27],[0,-.36],[-.14,-.27],[-.23,-.14],[-.26,.23]];
 fp(shield,poly,.065,mat.silver,[.09,-.14,-.12],.018);fp(shield,poly.map(([x,y])=>[x*.89,y*.91]),.055,mat.team,[.133,-.14,-.12],.014);fp(shield,poly.map(([x,y])=>[x*.78,y*.80]),.052,mat.gold,[.166,-.14,-.12],.012);fp(shield,poly.map(([x,y])=>[x*.64,y*.68]),.042,mat.dark,[.197,-.14,-.12],.008);
 for(const yy of[.11,-.025])fp(shield,[[-.14,.02],[0,.10],[.14,.02],[.12,-.035],[0,.027],[-.12,-.035]],.02,mat.gold,[.228,yy-.14,-.12],.005);
 for(const[z,y]of[[-.21,.23],[.21,.23],[-.185,-.12],[.185,-.12],[0,-.30]])stud(shield,[.148,y-.14,z-.12],.016,mat.gold);
 if(i===2)for(const yy of[.0,.15])fp(shield,[[-.225,-.014],[.225,-.014],[.225,.014],[-.225,.014]],.02,mat.silver,[.21,yy-.14,-.12],.004);
 save('guardian',[shield]);
 // Straight polished broadsword, round-ended gold crossguard, fuller, red pommel gem.
 const sword=node('Knight_Brand');add(sword,loft([[-.10,.031,.032],[.105,.031,.032]],8,.7),mat.dark,[0,0,0],[0,0,-Math.PI/2]);for(const x of[-.065,0,.065])add(sword,ring(.032,.034,.006,12),mat.gold,[x,0,0],[0,0,Math.PI/2]);
 add(sword,box(.055,.065,.068,.011),mat.gold,[-.135,0,0]);add(sword,oval([.019,.030,.029],10,6),mat.red,[-.172,0,0]);
 const guard=i===0?[[-.04,-.15],[.015,-.18],[.06,-.12],[.025,0],[.06,.12],[.015,.18],[-.04,.15],[-.015,0]]:i===1?[[-.04,-.17],[.035,-.17],[.065,-.11],[.025,0],[.065,.11],[.035,.17],[-.04,.17],[-.005,0]]:[[-.035,-.17],[.035,-.17],[.035,.17],[-.035,.17]];
 add(sword,plate(guard,.065,.012),mat.gold,[.12,0,0],[Math.PI/2,0,0]);for(const z of[-.17,.17])add(sword,oval([.038,.038,.033],i===1?8:14,6),mat.gold,[.13,0,z]);
 add(sword,plate([[.175,-.105],[.79,-.105],[1.05,0],[.79,.105],[.175,.105]],.028,.011),mat.silver,[0,0,0],[Math.PI/2,0,0]);add(sword,plate([[.20,-.035],[.81,-.035],[.94,0],[.81,.035],[.20,.035]],.010,.003),mat.dark,[0,.029,0],[Math.PI/2,0,0]);add(sword,plate([[.25,-.010],[.80,-.010],[.89,0],[.80,.010],[.25,.010]],.005,.002),mat.silver,[0,.036,0],[Math.PI/2,0,0]);add(sword,oval([.024,.012,.025],10,6),mat.red,[-.135,.043,0]);save('brand',[sword]);
 console.log(style.name+' / D: review mockups written');
}
