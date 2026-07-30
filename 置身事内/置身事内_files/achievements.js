/* 源自《置身事内》单文件版 - 成就系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 成就系统 ==============
const ACH_ICONS = {
  scales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0L19 7z"/></svg>',
  brokenHeart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9-9c-1.5-3.5 0-7 3.5-7 2 0 3.5 1.5 3.5 1.5M12 21s7-4.5 9-9c1.5-3.5 0-7-3.5-7-2 0-3.5 1.5-3.5 1.5"/><path d="M12 8l-2 3 2 2-2 3"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18M3 18l1.5-10L9 12l3-6 3 6 4.5-4L19 18"/><circle cx="4.5" cy="8" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="19.5" cy="8" r="1"/></svg>',
  landing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h20M9 18v-5l-4-7a2 2 0 0 1 4 0l3 4h2l3-4a2 2 0 0 1 4 0l-4 7v5"/><circle cx="6" cy="6" r="1"/><circle cx="18" cy="6" r="1"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.7-.7.7-2 0-2.7s-2.3-.7-3 .7z"/><path d="M12 15l-3-3c2-6 6-9 9-9 0 3-3 7-9 9z"/><path d="M9 12H6s.5-3 3-5M15 15v3s3-.5 5-3"/></svg>',
  moneyFly: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 3l2 3M18 3l-2 3M6 21l2-3M18 21l-2-3"/></svg>',
  city: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="6" height="13"/><rect x="9" y="3" width="6" height="18"/><rect x="15" y="10" width="6" height="11"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="12" y1="7" x2="12" y2="7"/><line x1="18" y1="14" x2="18" y2="14"/></svg>',
  citySun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="6" r="3"/><path d="M17 1v1M22 6h1M17 11v0M21 2l-1 1M21 10l-1-1"/><rect x="3" y="12" width="6" height="9"/><rect x="9" y="14" width="6" height="7"/><rect x="15" y="11" width="6" height="10"/></svg>',
  mountain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21l6-12 4 7 3-5 7 10z"/><circle cx="6" cy="5" r="2"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="3" y1="16" x2="17" y2="16"/><line x1="7" y1="20" x2="21" y2="20"/></svg>',
  swords: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2.5L21 9l-3 3-6.5-6.5z"/><path d="M9.5 2.5L3 9l3 3 6.5-6.5z"/><path d="M14.5 21.5L21 15l-3-3-6.5 6.5z"/><path d="M9.5 21.5L3 15l3-3 6.5 6.5z"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20H6z"/><path d="M6 2c-2 0-3 1-3 3s1 3 3 3M6 22c-2 0-3-1-3-3s1-3 3-3"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M12 5a3 3 0 1 1 0-6M12 5a3 3 0 1 0 0-6M15 8a3 3 0 1 1 0-6M9 8a3 3 0 1 0 0-6M12 11v10M9 18l3 3 3-3"/></svg>',
  handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l2 2a1 1 0 0 0 3-3M3 12l3-3 5 5M16 9l-3 3a1 1 0 0 0 3 3l5-5-3-3"/><path d="M6 9L3 6M18 9l3-3M9 17l-3 3M15 17l3 3"/></svg>',
  skull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C7 2 3 6 3 11c0 3 2 5 2 5v3a2 2 0 0 0 2 2h1v2h8v-2h1a2 2 0 0 0 2-2v-3s2-2 2-5c0-5-4-9-9-9z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M10 15h4"/></svg>',
  police: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-6h14l2 6v3H3z"/><rect x="3" y="15" width="18" height="5" rx="1"/><circle cx="7" cy="17.5" r="1"/><circle cx="17" cy="17.5" r="1"/><path d="M8 6l4 2 4-2"/></svg>',
  columns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="7" x2="21" y2="7"/><path d="M5 7v14M9 7v14M15 7v14M19 7v14"/><line x1="3" y1="3" x2="21" y2="3"/><path d="M3 3v4M21 3v4"/></svg>',
  tornado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18M5 8h14M7 12h10M9 16h6M10 20h4"/></svg>',
  moneyBag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M9 3c0 2-3 3-3 7 0 5 3 11 6 11s6-6 6-11c0-4-3-5-3-7"/><circle cx="12" cy="14" r="2"/><path d="M12 12v4M10 14h4"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 14H7L6 7z"/><path d="M9 7V4a3 3 0 0 1 6 0v3"/><line x1="9" y1="11" x2="9" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="15" y1="11" x2="15" y2="17"/></svg>',
  hiddenWealth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><circle cx="12" cy="14" r="2" fill="currentColor"/><path d="M3 11h2M19 11h2"/></svg>',
  stockMaster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/><line x1="3" y1="21" x2="21" y2="21"/></svg>',
  landTycoon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
  villaOwner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-7 9 7v9H3z"/><path d="M9 21v-6h6v6"/><rect x="11" y="9" width="2" height="3"/></svg>',
  coverUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 7v6c0 5 3 8 8 9 5-1 8-4 8-9V7l-8-5z"/><path d="M9 12l2 2 4-4"/></svg>',
  transfer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>',
  crimeLord: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/><path d="M9 22v-4M15 22v-4M7 14a8 8 0 0 0 10 0"/><circle cx="9" cy="8" r="1"/><circle cx="15" cy="8" r="1"/><path d="M10 11h4"/></svg>',
  justice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v6c0 5 3 8 9 9 6-1 9-4 9-9V7l-9-5z"/><path d="M12 7v6M9 10h6"/></svg>',
  ironFist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V8a2 2 0 0 1 4 0v3M11 11V7a2 2 0 0 1 4 0v4M15 11V8a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0"/><path d="M12 15v4"/></svg>',
  debtFree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>',
  petition: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  bridge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h20M4 17V8a8 8 0 0 1 16 0v9M8 17v-5M16 17v-5M12 17v-7"/></svg>',
  hospital: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="16" rx="2"/><path d="M12 10v6M9 13h6"/><path d="M6 6V3h12v3"/></svg>',
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></svg>',
  subway: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M5 17l-2 4M19 17l2 4M9 7h6"/></svg>',
  powerPlant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  waterDrop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1 0-4h2M18 9h2a2 2 0 0 0 0-4h-2M6 5v6a6 6 0 0 0 12 0V5M8 21h8M12 17v4"/></svg>',
  newspaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h6M7 12h10M7 16h10"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8.5 22 9.5 17 14.5 18 21.5 12 18 6 21.5 7 14.5 2 9.5 9 8.5"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  lightning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="6"/><path d="M7 9L4 2M17 9l3-7M12 15l-1-2M12 15l1-2M12 13v4"/></svg>',
  noSmoking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><path d="M3 14h14M3 17h10"/></svg>',
  bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/><path d="M3 11h18M8 8h8"/></svg>',
  scales2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0L19 7z"/><path d="M9 12v3a3 3 0 0 0 6 0v-3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6z"/></svg>',
  fist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><path d="M8 8V6M10 8V5M12 8V5M14 8V6"/></svg>',
  // v2.2.0 农业系统成就图标
  wheat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8M12 8c0-2 1-3 3-3M12 8c0-2-1-3-3-3M12 12c0-2 1-3 3-3M12 12c0-2-1-3-3-3M12 16c0-2 1-3 3-3M12 16c0-2-1-3-3-3M9 5l1.5 1.5M15 5l-1.5 1.5"/></svg>',
  barn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V11l9-6 9 6v10M7 21v-6h10v6M9 11h0M15 11h0M10 15h4v6h-4z"/></svg>',
  redline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  urbanization: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l5-3v16M14 21V11l5-3v13M8 11h0M8 14h0M8 17h0M17 14h0M17 17h0"/></svg>',
  fish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c3-4 7-6 11-6s8 2 9 6c-1 4-5 6-9 6s-8-2-11-6z"/><path d="M18 9c1 1 1 5 0 6M2 12l3-2v4z"/></svg>',
  // v2.4.1b: 常委会成就图标
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>',
  gavel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2l8 8-4 4-8-8zM10 6L2 14l4 4 8-8M6 18l-2 4M18 6l4 4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  balance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0L19 7zM7 21h10"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
};

const ACHIEVEMENTS = [
  { id: 'baoQingTian', name: '包青天', icon: ACH_ICONS.scales, desc: '全程腐败指数低于10，清廉如水', rarity: 'legendary',
    check: (s, st) => s.corruption < 10 && s.turn >= 24 },
  { id: 'lostWife', name: '赔了夫人又折兵', icon: ACH_ICONS.brokenHeart, desc: '单次事件中损失超过¥2000万且人口减少500+', rarity: 'rare',
    check: (s, st) => st.lostWifeTriggered },
  { id: 'tyrant', name: '你是纣王还是夏桀？', icon: ACH_ICONS.crown, desc: '市民满意度降至5以下，暴政统治', rarity: 'epic',
    check: (s, st) => s.happiness < 5 },
  { id: 'safeLanding', name: '平稳着陆', icon: ACH_ICONS.landing, desc: '在直辖市安全完成至少一届任期', rarity: 'legendary',
    check: (s, st) => s.cityLevelId >= 4 && st.promotions >= 4 && s.termTurn >= s.termEnd },
  { id: 'rocketPromo', name: '火箭提拔', icon: ACH_ICONS.rocket, desc: '连续三届任期考核均获晋升', rarity: 'epic',
    check: (s, st) => st.consecutivePromotions >= 3 },
  { id: 'debtTower', name: '债台高筑', icon: ACH_ICONS.moneyFly, desc: '财政负债超过¥1亿', rarity: 'rare',
    check: (s, st) => s.treasury < -10000 },
  { id: 'tenThousand', name: '万家灯火', icon: ACH_ICONS.city, desc: '人口突破10万', rarity: 'uncommon',
    check: (s, st) => s.population >= 100000 },
  { id: 'millionCity', name: '百万人口大城', icon: ACH_ICONS.citySun, desc: '人口突破100万', rarity: 'rare',
    check: (s, st) => s.population >= 1000000 },
  { id: 'greenMountain', name: '绿水青山就是金山银山', icon: ACH_ICONS.mountain, desc: '绿化覆盖率达到90%以上', rarity: 'rare',
    check: (s, st) => s.greenCoverage >= 90 },
  { id: 'smogCity', name: '雾都孤儿', icon: ACH_ICONS.fog, desc: '空气质量持续3个月超过200', rarity: 'uncommon',
    check: (s, st) => st.monthsLowAir >= 3 },
  { id: 'ironAnti', name: '铁腕反腐', icon: ACH_ICONS.swords, desc: '腐败指数从50以上降至10以下', rarity: 'rare',
    check: (s, st) => st.corruptionWasHigh && s.corruption < 10 },
  { id: 'paperGeneral', name: '纸上谈兵', icon: ACH_ICONS.scroll, desc: '建造50栋以上建筑但人口不足1000', rarity: 'uncommon',
    check: (s, st) => s.buildings.length >= 50 && s.population < 1000 },
  { id: 'allFlowers', name: '遍地开花', icon: ACH_ICONS.flower, desc: '同时拥有住宅、商业、工业、基建、电力、供水全部6类建筑', rarity: 'rare',
    check: (s, st) => {
      const cats = new Set();
      for (const b of s.buildings) { const d = BUILDING_TYPES[b.type]; if (d) cats.add(d.cat); }
      return cats.size >= 5;
    } },
  { id: 'peopleServant', name: '人民公仆', icon: ACH_ICONS.handshake, desc: '市民满意度持续12个月超过80', rarity: 'epic',
    check: (s, st) => st.monthsHappy80 >= 12 },
  { id: 'fallenKing', name: '亡国之君', icon: ACH_ICONS.skull, desc: '以城市崩溃结局结束游戏', rarity: 'epic',
    check: (s, st) => s.gameOver && s.endReason === 'collapse' },
  { id: 'caught', name: '东窗事发', icon: ACH_ICONS.police, desc: '因严重腐败被纪委查处下台', rarity: 'epic',
    check: (s, st) => s.gameOver && s.endReason === 'corruption_caught' },
  { id: 'topLeader', name: '一人之下', icon: ACH_ICONS.columns, desc: '晋升为直辖市委书记', rarity: 'legendary',
    check: (s, st) => s.cityLevelId >= 4 },
  { id: 'emptyCity', name: '空城计', icon: ACH_ICONS.tornado, desc: '人口从10万以上降至1万以下', rarity: 'rare',
    check: (s, st) => st.popWasHigh && s.population < 10000 },
  { id: 'goldMine', name: '日进斗金', icon: ACH_ICONS.moneyBag, desc: '月GDP超过¥1亿', rarity: 'uncommon',
    check: (s, st) => s.gdp >= 10000 },
  { id: 'bigSpender', name: '挥金如土', icon: ACH_ICONS.shopping, desc: '累计花费超过¥10亿', rarity: 'rare',
    check: (s, st) => st.totalMoneySpent >= 100000 },
  { id: 'hiddenWealth', name: '富可敌国', icon: ACH_ICONS.hiddenWealth, desc: '私人账户总资产超过¥5亿', rarity: 'epic',
    check: (s, st) => {
      const stockVal = s.privateAssets.stocks.reduce((a, x) => a + x.shares * x.currentPrice, 0);
      const landVal = s.privateAssets.land.reduce((a, x) => a + x.currentValue, 0);
      const projVal = s.privateAssets.projects.reduce((a, x) => a + x.investment, 0);
      const villaVal = s.privateAssets.villas.reduce((a, x) => a + x.value, 0);
      const total = s.privateAccount + stockVal + landVal + projVal + villaVal;
      return total >= 50000;
    } },
  { id: 'stockMaster', name: '股神附体', icon: ACH_ICONS.stockMaster, desc: '完成10笔以上股票交易且累计盈利', rarity: 'rare',
    check: (s, st) => st.stockTrades >= 10 && st.maxStockProfit > 0 },
  { id: 'landTycoon', name: '地产大亨', icon: ACH_ICONS.landTycoon, desc: '同时持有3块以上城市土地', rarity: 'rare',
    check: (s, st) => s.privateAssets.land.length >= 3 },
  { id: 'villaOwner', name: '豪宅收藏家', icon: ACH_ICONS.villaOwner, desc: '拥有2栋以上别墅', rarity: 'epic',
    check: (s, st) => s.privateAssets.villas.length >= 2 },
  { id: 'coverUp', name: '瞒天过海', icon: ACH_ICONS.coverUp, desc: '成功用钱摆平纪委调查3次以上', rarity: 'epic',
    check: (s, st) => st.inspectionsDodged >= 3 },
  { id: 'embezzler', name: '中饱私囊', icon: ACH_ICONS.transfer, desc: '从财政划拨超过¥1亿到私人账户', rarity: 'epic',
    check: (s, st) => st.transfersDone >= 10000 },
  // v3.3 新增成就
  { id: 'crimeLord', name: '黑白通吃', icon: ACH_ICONS.crimeLord, desc: '同时拥有20名以上打手', rarity: 'epic',
    check: (s, st) => s.underworld && s.underworld.thugs >= 20 },
  { id: 'ironFist', name: '铁腕扫黑', icon: ACH_ICONS.ironFist, desc: '累计执行5次扫黑除恶行动', rarity: 'rare',
    check: (s, st) => s.underworld && s.underworld.crackdownsDone >= 5 },
  { id: 'thugMaster', name: '以暴制暴', icon: ACH_ICONS.fist, desc: '使用打手处理群众事件5次以上', rarity: 'rare',
    check: (s, st) => s.underworld && s.underworld.thugActionsUsed >= 5 },
  { id: 'debtFree', name: '清正廉洁', icon: ACH_ICONS.debtFree, desc: '游戏全程不拖欠任何工程款（达到50回合以上）', rarity: 'rare',
    check: (s, st) => s.turn >= 50 && (s.constructionProjects || []).every(p => (p.accruedDebt || 0) === 0) },
  { id: 'petition', name: '倾听民意', icon: ACH_ICONS.petition, desc: '亲自接访10次以上群众上访', rarity: 'common',
    check: (s, st) => (st.petitionsResolved || 0) >= 10 },
  // === v1.2.0.9 新增成就 ===
  { id: 'bridgeMaster', name: '逢山开路，遇水架桥', icon: ACH_ICONS.bridge, desc: '修建道路总长度超过100格', rarity: 'uncommon',
    check: (s, st) => (s.roads || []).reduce((sum, r) => sum + (r.cells ? r.cells.length : 0), 0) >= 100 },
  { id: 'waterCity', name: '水城', icon: ACH_ICONS.waterDrop, desc: '水质指数达到100（I类水质）', rarity: 'rare',
    check: (s, st) => s.waterQuality >= 100 },
  { id: 'blueSky', name: '蓝天保卫战', icon: ACH_ICONS.noSmoking, desc: '空气质量AQI低于30持续12个月以上', rarity: 'rare',
    check: (s, st) => (st.monthsAirGood || 0) >= 12 },
  { id: 'quietCity', name: '寂静之城', icon: ACH_ICONS.clock, desc: '噪音水平控制在40dB以下', rarity: 'uncommon',
    check: (s, st) => s.noiseLevel <= 40 },
  { id: 'medCare', name: '医者仁心', icon: ACH_ICONS.hospital, desc: '医疗指数达到90以上', rarity: 'rare',
    check: (s, st) => s.healthcareIndex >= 90 },
  { id: 'eduCity', name: '教育强市', icon: ACH_ICONS.education, desc: '教育指数达到90以上', rarity: 'rare',
    check: (s, st) => s.educationIndex >= 90 },
  { id: 'safeCity', name: '平安城市', icon: ACH_ICONS.shield, desc: '治安指数达到90以上', rarity: 'rare',
    check: (s, st) => s.publicSafety >= 90 },
  { id: 'selfSufficient', name: '自给自足', icon: ACH_ICONS.powerPlant, desc: '电力和供水均自给自足（无购电费和抽水费且供需满足）', rarity: 'epic',
    check: (s, st) => (s.substationCost || 0) === 0 && (s.waterPumpCost || 0) === 0 && (s.powerBalance || -1) >= 0 && (s.waterBalance || -1) >= 0 && s.turn >= 12 },
  { id: 'eventMaster', name: '处变不惊', icon: ACH_ICONS.lightning, desc: '处理50次以上随机事件', rarity: 'epic',
    check: (s, st) => (st.eventsResolved || 0) >= 50 },
  { id: 'noCorruption', name: '一身正气', icon: ACH_ICONS.medal, desc: '全程未使用打手，腐败始终低于20', rarity: 'epic',
    check: (s, st) => s.turn >= 36 && s.corruption < 20 && (!s.underworld || (s.underworld.thugActionsUsed || 0) === 0) },
  { id: 'gdpTiger', name: '经济猛虎', icon: ACH_ICONS.trophy, desc: 'GDP达到¥50000万', rarity: 'epic',
    check: (s, st) => s.gdp >= 50000 },
  { id: 'newspaperReader', name: '报友', icon: ACH_ICONS.newspaper, desc: '阅读5期以上晚报', rarity: 'common',
    check: (s, st) => (st.newspapersRead || 0) >= 5 },
  { id: 'affairsMaster', name: '人情练达', icon: ACH_ICONS.handshake, desc: '完成10次以上个人事务', rarity: 'uncommon',
    check: (s, st) => (st.personalEventsResolved || 0) >= 10 },
  { id: 'longReign', name: '基业长青', icon: ACH_ICONS.globe, desc: '游戏回合达到100个月', rarity: 'legendary',
    check: (s, st) => s.turn >= 100 },
  { id: 'perfectTransfer', name: '全身而退', icon: ACH_ICONS.scales2, desc: '调离时财产审查通过（私人资产低于500万）', rarity: 'rare',
    check: (s, st) => (st.auditPassed || 0) >= 1 },
  { id: 'heartOfGold', name: '仁心仁术', icon: ACH_ICONS.heart, desc: '累计捐款超过¥200万', rarity: 'rare',
    check: (s, st) => (st.totalDonated || 0) >= 200 },
  { id: 'busNetwork', name: '四通八达', icon: ACH_ICONS.bus, desc: '修建4条以上高速公路', rarity: 'epic',
    check: (s, st) => (s.roads || []).filter(r => r.grade === 'highway').length >= 4 },
  { id: 'survivor', name: '绝处逢生', icon: ACH_ICONS.star, desc: '财政赤字超过¥20000万后扭亏为盈', rarity: 'epic',
    check: (s, st) => st.everDeepBankrupt && s.treasury > 0 },
  { id: 'streak', name: '政通人和', icon: ACH_ICONS.lightning, desc: '连续5届任期考核均未降级', rarity: 'epic',
    check: (s, st) => (st.consecutiveNonDemotions || 0) >= 5 },
  { id: 'meritAccumulator', name: '功勋卓著', icon: ACH_ICONS.briefcase, desc: '累计政绩达到1000', rarity: 'legendary',
    check: (s, st) => (s.merit || 0) >= 1000 },
  // ===== v2.2.0 农业系统成就 =====
  { id: 'firstFarmer', name: '春耕秋收', icon: ACH_ICONS.wheat, desc: '建造首个农田地块', rarity: 'common',
    check: (s, st) => (st.farmlandCellsBuilt || 0) >= 1 },
  { id: 'granary', name: '鱼米之乡', icon: ACH_ICONS.wheat, desc: '累计建造50个农田地块', rarity: 'uncommon',
    check: (s, st) => (st.farmlandCellsBuilt || 0) >= 50 },
  { id: 'agriMaster', name: '农林牧渔', icon: ACH_ICONS.barn, desc: '累计建造100个农业地块（含林牧渔）', rarity: 'rare',
    check: (s, st) => (st.agriCellsBuilt || 0) >= 100 },
  { id: 'redlineGuard', name: '守土有责', icon: ACH_ICONS.redline, desc: '连续24个月耕地面积高于红线', rarity: 'rare',
    check: (s, st) => s.agriStats && s.agriStats.belowRedlineMonths === 0 && (st.redlineGuardMonths || 0) >= 24 },
  { id: 'redlineViolator', name: '越线之祸', icon: ACH_ICONS.redline, desc: '累计触发6次耕地红线违规处分', rarity: 'epic',
    check: (s, st) => (st.redlineViolations || 0) >= 6 },
  { id: 'urbanPioneer', name: '城镇化先锋', icon: ACH_ICONS.urbanization, desc: '城镇化率达到80%', rarity: 'epic',
    check: (s, st) => (st.maxUrbanizationRatio || 0) >= 0.80 },
  { id: 'fullUrbanization', name: '都市新篇', icon: ACH_ICONS.urbanization, desc: '城镇化率达到95%（基本无农业就业）', rarity: 'legendary',
    check: (s, st) => (st.maxUrbanizationRatio || 0) >= 0.95 },
  { id: 'fishKing', name: '渔获满仓', icon: ACH_ICONS.fish, desc: '同时拥有20个鱼塘地块', rarity: 'uncommon',
    check: (s) => s.buildings.filter(b => b.type === 'fishpond' && !b.underConstruction).length >= 20 },
  // ===== v2.4.1a 常务委员会成就 =====
  { id: 'committeeMaster', name: '班子核心', icon: ACH_ICONS.users, desc: '常委会团结程度达到"团结融洽"并维持12个月', rarity: 'rare',
    check: (s, st) => (st.committeeUnityHighMonths || 0) >= 12 },
  { id: 'committeeCrackdown', name: '常委整肃', icon: ACH_ICONS.gavel, desc: '通过调查查处3名常委成员', rarity: 'epic',
    check: (s, st) => (st.committeeMembersInvestigated || 0) >= 3 },
  { id: 'committeeCourt', name: '知人善任', icon: ACH_ICONS.handshake, desc: '成功拉拢2名常委成员', rarity: 'rare',
    check: (s, st) => (st.committeeMembersCourted || 0) >= 2 },
  { id: 'forceAppoint', name: '独断专行', icon: ACH_ICONS.warning, desc: '累计3次强制排板任命', rarity: 'uncommon',
    check: (s, st) => (st.forceAppointCount || 0) >= 3 },
  { id: 'coverUpExposed', name: '包庇败露', icon: ACH_ICONS.eye, desc: '纪委书记包庇事件被上级发现', rarity: 'epic',
    check: (s, st) => (st.coverUpExposed || 0) >= 1 },
  { id: 'cleanCommittee', name: '风清气正', icon: ACH_ICONS.balance, desc: '全部常委成员贪腐倾向均为清廉', rarity: 'legendary',
    check: (s) => s.committee && s.committee.filter(m => !m.isPlayer && !m.isVacant).length > 0 && s.committee.filter(m => !m.isPlayer && !m.isVacant).every(m => (m.corruptionTendency || 1) <= 2) },
  { id: 'democracyChampion', name: '民主集中', icon: ACH_ICONS.star, desc: '召开5次民主生活会', rarity: 'uncommon',
    check: (s, st) => (st.democraticMeetings || 0) >= 5 },
];

function checkAchievements() {
  const s = gameState;
  const st = s.achievementStats;
  // Update stats
  if (s.treasury > st.maxTreasury) st.maxTreasury = s.treasury;
  if (s.happiness < st.minHappiness) st.minHappiness = s.happiness;
  if (s.happiness >= 80) st.monthsHappy80++; else st.monthsHappy80 = 0;
  if (s.corruption === 0) st.monthsCorrupt0++;
  if (s.corruption >= 50) st.corruptionWasHigh = true;
  if (s.airQuality > 200) st.monthsLowAir++; else st.monthsLowAir = 0;
  if (s.airQuality <= 30) st.monthsAirGood = (st.monthsAirGood || 0) + 1; else st.monthsAirGood = 0;
  if (s.treasury < st.maxDebt) st.maxDebt = s.treasury;
  if (s.treasury < -20000) st.everDeepBankrupt = true;
  if (s.population >= 100000) st.popWasHigh = true;
  // v2.2.0 农业统计：累计农田/农业地块数 + 耕地红线守护月数
  const agriBuildings = s.buildings.filter(b => !b.underConstruction && isPrimarySector && isPrimarySector(b.type));
  const farmlandNow = s.buildings.filter(b => !b.underConstruction && b.type === 'farmland').length;
  const agriNow = agriBuildings.length;
  if (farmlandNow > (st.farmlandCellsBuilt || 0)) st.farmlandCellsBuilt = farmlandNow;
  if (agriNow > (st.agriCellsBuilt || 0)) st.agriCellsBuilt = agriNow;
  if (s.agriStats) {
    if (s.agriStats.belowRedlineMonths === 0) st.redlineGuardMonths = (st.redlineGuardMonths || 0) + 1;
    else st.redlineGuardMonths = 0;
  }
  // Track personal events count
  st.personalEventsResolved = (s.personalEvents || []).length;
  // Track private account stats
  const sv = s.privateAssets.stocks.reduce((a, x) => a + x.shares * x.currentPrice, 0);
  const lv = s.privateAssets.land.reduce((a, x) => a + x.currentValue, 0);
  const pv = s.privateAssets.projects.reduce((a, x) => a + x.investment, 0);
  const vv = s.privateAssets.villas.reduce((a, x) => a + x.value, 0);
  const totalPriv = s.privateAccount + sv + lv + pv + vv;
  if (totalPriv > st.maxPrivateAssets) st.maxPrivateAssets = totalPriv;
  // v2.4.1a: 常务委员会成就统计
  if ((s.committeeUnity || 50) >= 75) st.committeeUnityHighMonths = (st.committeeUnityHighMonths || 0) + 1;
  st.forceAppointCount = s._forceAppointCount || st.forceAppointCount || 0;

  // Load global achievements (cross-save shared)
  let globalAch = [];
  try { globalAch = JSON.parse(localStorage.getItem('cityPlanner_globalAchievements') || '[]'); } catch(e) {}
  let globalStats = {};
  try { globalStats = JSON.parse(localStorage.getItem('cityPlanner_globalStats') || '{}'); } catch(e) {}
  // Merge current save stats into global stats
  globalStats.totalMonthsPlayed = (globalStats.totalMonthsPlayed || 0) + 1;
  // 只记录建筑增量，避免每月重复累加
  const currentBuildings = s.achievementStats?.totalBuildingsBuilt || 0;
  const lastRecordedBuildings = s._lastRecordedBuildings || 0;
  const buildingsDelta = Math.max(0, currentBuildings - lastRecordedBuildings);
  globalStats.totalBuildingsBuilt = (globalStats.totalBuildingsBuilt || 0) + buildingsDelta;
  s._lastRecordedBuildings = currentBuildings;
  // 晋升数也只记录增量
  const currentPromotions = s.achievementStats?.promotions || 0;
  const lastRecordedPromotions = s._lastRecordedPromotions || 0;
  const promotionsDelta = Math.max(0, currentPromotions - lastRecordedPromotions);
  globalStats.promotions = (globalStats.promotions || 0) + promotionsDelta;
  s._lastRecordedPromotions = currentPromotions;
  s.totalMonthsPlayed = globalStats.totalMonthsPlayed;

  // Check each achievement
  for (const ach of ACHIEVEMENTS) {
    if (globalAch.includes(ach.id)) {
      // Already unlocked globally — add to current save's list
      if (!s.achievements.includes(ach.id)) s.achievements.push(ach.id);
      continue;
    }
    try {
      if (ach.check(s, st)) {
        s.achievements.push(ach.id);
        globalAch.push(ach.id);
        showAchievementNotification(ach);
        logEvent(`解锁成就：${ach.name}`, 'success');
      }
    } catch(e) {}
  }
  // Save global achievements
  try {
    localStorage.setItem('cityPlanner_globalAchievements', JSON.stringify(globalAch));
    localStorage.setItem('cityPlanner_globalStats', JSON.stringify(globalStats));
  } catch(e) {}
}

function showAchievementNotification(ach) {
  const rarityColors = { common: 'var(--text-2)', uncommon: 'var(--green)', rare: 'var(--accent)', epic: 'var(--purple)', legendary: 'var(--orange)' };
  const rarityLabels = { common: '常见', uncommon: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };
  const color = rarityColors[ach.rarity] || 'var(--accent)';
  const container = document.getElementById('notif-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'notif success';
  el.style.cssText = `border-left:4px solid ${color};padding:10px 14px;display:flex;align-items:center;gap:8px;`;
  el.innerHTML = `<span style="width:22px;height:22px;color:${color};display:flex;align-items:center;flex-shrink:0;">${ach.icon}</span><div><div style="font-size:11px;color:${color};font-weight:600;">${rarityLabels[ach.rarity]}成就已解锁</div><div style="font-size:14px;font-weight:700;">${ach.name}</div></div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function renderAchievementsTab() {
  const s = gameState;
  // Load global achievements (cross-save shared)
  let globalAch = [];
  try { globalAch = JSON.parse(localStorage.getItem('cityPlanner_globalAchievements') || '[]'); } catch(e) {}
  let globalStats = {};
  try { globalStats = JSON.parse(localStorage.getItem('cityPlanner_globalStats') || '{}'); } catch(e) {}
  // Merge current save achievements with global
  const allUnlocked = new Set([...globalAch, ...(s.achievements || [])]);
  let unlocked = 0;
  let html = `<div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:24px;font-weight:700;color:var(--accent);">${allUnlocked.size}<span style="font-size:14px;color:var(--text-3);">/${ACHIEVEMENTS.length}</span></div>
    <div style="font-size:12px;color:var(--text-3);">已解锁成就</div>
  </div>`;
  // Show global stats
  html += `<div style="background:var(--separator-light);border-radius:10px;padding:10px 14px;margin-bottom:12px;">
    <div style="font-size:12px;color:var(--text-3);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <span>累计游戏月数：${globalStats.totalMonthsPlayed || 0}</span>
      <span>累计修建：${globalStats.totalBuildingsBuilt || 0}栋</span>
      <span>累计晋升：${globalStats.promotions || 0}次</span>
    </div>
  </div>`;
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9));
  for (const ach of sorted) {
    const isUnlocked = allUnlocked.has(ach.id);
    const rarityColors = { common: 'var(--text-2)', uncommon: 'var(--green)', rare: 'var(--accent)', epic: 'var(--purple)', legendary: 'var(--orange)' };
    const color = rarityColors[ach.rarity] || 'var(--accent)';
    if (isUnlocked) {
      unlocked++;
      html += `<div style="background:var(--bg-card);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid ${color};box-shadow:var(--shadow-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ach.icon}</div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:700;color:var(--text-1);">${ach.name}</span>
              <span style="font-size:10px;font-weight:600;color:${color};text-transform:uppercase;">${ach.rarity}</span>
            </div>
            <div style="font-size:12px;color:var(--text-3);">${ach.desc}</div>
          </div>
        </div>
      </div>`;
    } else {
      html += `<div style="background:var(--bg-card);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid var(--separator);opacity:0.5;box-shadow:var(--shadow-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;color:var(--text-3);display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:0.3;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:700;color:var(--text-3);">??? </span>
              <span style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">${ach.rarity}</span>
            </div>
            <div style="font-size:12px;color:var(--text-3);">${ach.desc}</div>
          </div>
        </div>
      </div>`;
    }
  }

  return html;
}

function getOfficialTitle() {
  const lv = getCityLevel();
  // v2.3.6: 显示兼任副职
  if (gameState.deputyPosition !== null && gameState.deputyPosition !== undefined) {
    const deputyTitles = ['副镇长', '副县长', '副市长', '副省长', '副市长'];
    const deputyTitle = deputyTitles[gameState.deputyPosition] || '副职';
    return `${lv.title}（兼${deputyTitle}）`;
  }
  return lv.title;
}
function getCityLevelName() { return getCityLevel().name; }

