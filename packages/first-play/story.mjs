// Local text provider for the interactive walkthrough. Actual actions and these replies
// are saved through the ordinary card service before extraction sees any text.
export const walkthrough=[
  "你走进东村的青石酒馆。你从正门望去，固定的柜台和双窗清晰可见。堂内只有掌柜、蓝衣客和赭衣客。此时是白日，日光照入堂内。",
  "你与掌柜闲谈茶价。",
  "绿衣客和紫衣客从后门走了进来。",
  "你继续听掌柜讲茶经。",
  "你走出了酒馆。",
  "你回到东村的青石酒馆，眼前景物与离开时一样。",
  "已是傍晚。三盏灯笼亮了起来。"
];
export const walkthroughModel=input=>walkthrough[input.history.length]??"你端起茶盏。";
