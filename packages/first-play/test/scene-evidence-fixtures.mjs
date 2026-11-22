// Hand-labelled synthetic narratives. The extractor does not import this file.
export const east = [
  "你走进东村的青石酒馆","你站在正门，向北望去","环顾屋内，在场的只有掌柜、蓝衣客、赭衣客",
  "眼前固定的柜台和双窗清晰可见","此刻已是正午","日光照亮屋内"
];
export const tower = [
  "你走进北城的观星楼","你站在石阶上，向西望去","环顾屋内，在场的只有值守人、学徒",
  "眼前固定的石阶和星盘座清晰可见","此刻已是傍晚","灯光照亮屋内"
];
export const prose = clauses => clauses.join("。")+"。";
export const partial = prose(["屋内可见掌柜、蓝衣客、赭衣客",east[3],east[5]]);
export const rejected = {
  actionOnly:prose(east.slice(1)), partial, nonexclusive:prose(east.with(2,"屋内可见掌柜、蓝衣客、赭衣客")),
  noPosition:prose(east.filter((_,i)=>i!==1)),noStructures:prose(east.filter((_,i)=>i!==3)),
  noTime:prose(east.filter((_,i)=>i!==4)),noLight:prose(east.slice(0,-1)),
  dream:"你梦见"+prose(east), plan:"你计划明天抵达北城。"+prose(tower), memory:"你记得上次来过。"+prose(tower),
  hearsay:"听说"+prose(east), mixedQuote:prose(east)+"掌柜说：“那边还有两个人。”",
  unrevealed:prose(tower)+"暗门后有未揭示的密室。", ambiguous:prose(east)+"红衣客下落不明。",
  negated:prose(tower)+"学徒不在屋内。",question:prose(tower).replace("此刻已是傍晚。","此刻已是傍晚？"),
  duplicatePlace:prose([east[0],"你走进西村的青石酒馆",...east.slice(1)]),
  unqualified:prose(east.with(0,"你走进青石酒馆")), staleAlias:prose(east.with(0,"你走进东村的老周的店")),
  lateArrival:prose([east[3],east[0],...east.slice(1,3),...east.slice(4)]),
  conflictingTime:prose([...tower,"此刻已是清晨"]),hiddenJson:prose(tower)+'{"ready":true}',
  oldImage:"旧图里的灯还亮着。"+prose(tower.slice(0,-1))
};
