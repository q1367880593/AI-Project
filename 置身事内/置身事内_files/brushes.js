/* 源自《置身事内》单文件版 - 画笔工具定义 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 画笔工具定义 ==============
const BRUSH_TOOLS = {
  free:  { name: '自由', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>' },
  rect:  { name: '矩形', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' },
  line:  { name: '直线', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>' },
  fill:  { name: '填充', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11h-8V3a1 1 0 0 0-2 0v8H1v2h8v8a1 1 0 0 0 2 0v-8h8z"/></svg>' },
};

const INFRA_CATEGORIES = [
  { name: '公共设施', items: ['elementarySchool', 'middleSchool', 'highSchool', 'university', 'hospital', 'fireStation', 'police', 'govBuilding'] },
  { name: '电力设施', items: ['powerPlant', 'gasPower', 'cleanEnergy', 'solarPlant', 'windFarm', 'hydroDam', 'nuclearPlant', 'substation', 'wasteIncinerator'] },
  { name: '供水设施', items: ['waterTower', 'waterPump', 'waterPlant', 'reservoir', 'desalination'] },
  { name: '环保设施', items: ['airFilter', 'sewagePlant', 'ecoWetland', 'noiseBarrier', 'wastePlant'] },
  { name: '地下层', items: ['parking'] },
  // v2.2.7: 公共交通整合板块（线路通过transit画笔绘制，站点建筑在此展示）
  // v2.4.8: 移除火车站/高铁站（不可建设），添加跑道
  { name: '公共交通', items: ['subwayStation', 'lightRailStation', 'busStop', 'busTerminal', 'runway', 'port'] },
];

