import {walkthrough} from "../story.mjs";

const initial=walkthrough[0];
const fullFive=initial.replace("蓝衣客和赭衣客","蓝衣客、赭衣客、绿衣客和紫衣客");
const west=initial.replace("东村","西村").replace("掌柜、蓝衣客和赭衣客","掌柜和白衣客");
const back=name=>"你回到东村的"+name+"，眼前景物与离开时一样。";

// Each expected row = saved narrative, stable place, visual version, visible people, panel state, original index.
export const route=[
 [initial,"east",1,3,"display",0],
 [walkthrough[1],"east",1,3,"display",0],
 [walkthrough[2],"east",2,5,"display",1],
 ["这家酒馆正式改名为“老周的店”。","east",2,5,"display",1],
 [west,"west",1,2,"skip"],
 [back("老周的店"),"east",2,5,"display",1],
 ["刚还在柜台边的紫衣客推门出去了，厅里又安静下来。","east",3,4,"skip"],
 ["紫衣客走进大堂。","east",4,5,"display",1],
 ["紫衣客走进大堂。","east",4,5,"display",1],
 ["他出去了。","east",null,null,"verify-scene"],
 ["你端起茶盏。","east",null,null,"verify-scene"],
 [walkthrough[4],null,null,null,"not-ready"],
 [back("青石酒馆"),"east",null,null,"verify-scene"],
 [fullFive.replace("青石酒馆","老周的店"),"east",4,5,"display",1],
 ["窗纸上的日色已经褪尽，掌柜将三盏灯笼一一点亮。","east",5,5,"display",2],
 ["这家酒馆改名为“春风客栈”。","east",5,5,"display",2],
 [walkthrough[4],null,null,null,"not-ready"],
 [back("老周的店"),"east",5,5,"display",2],
 ["堂里的人纷纷起身告辞。门一合，只剩掌柜独自守店。","east",6,1,"skip"],
 ["你回到西村的青石酒馆，眼前景物与离开时一样。","west",1,2,"skip"],
 [back("春风客栈"),"east",6,1,"skip"],
 ["你回到青石酒馆。",null,null,null,"not-ready"],
 [back("春风客栈"),"east",null,null,"verify-scene"],
 [fullFive,"east",7,5,"unknown"],
 [walkthrough[1],"east",7,5,"unknown"]
];
