/* 源自《置身事内》单文件版 - 区域类型定义（画笔绘制系统） */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 区域类型定义（画笔绘制系统） ==============
const ZONE_TYPES = {
  residential: {
    name: '住宅区', color: '#cfe8f5', borderColor: '#5b9bd5', costPerCell: 12,
    desc: '划定住宅区域，自动生成住宅建筑。可选择不同密度类型。',
    subTypes: {
      low:    { name: '低密度住宅', shortName: '住宅', color: '#dceffa', buildingType: 'lowRes', costPerCell: 8 },
      mid:    { name: '中密度住宅', shortName: '住宅', color: '#a8d4ef', buildingType: 'midRes', costPerCell: 15 },
      high:   { name: '高密度住宅', shortName: '住宅', color: '#5fa8d8', buildingType: 'highRes', costPerCell: 28 },
      luxury: { name: '别墅区', shortName: '别墅',     color: '#2e7bb8', buildingType: 'luxuryRes', costPerCell: 22 },
    }
  },
  commercial: {
    name: '商业区', color: '#fbe4a6', borderColor: '#d4a017', costPerCell: 20,
    desc: '划定商业区域，自动生成各类店面。贴近真实商圈氛围。',
    subTypes: {
      street:  { name: '沿街商业', color: '#fbe4a6', buildingType: 'streetCom', costPerCell: 15 },
      plaza:   { name: '广场商业', shortName: '广场', color: '#f5c842', buildingType: 'plazaCom', costPerCell: 25 },
      complex: { name: '商业综合体', color: '#e0a020', buildingType: 'comComplex', costPerCell: 40 },
    }
  },
  industrial: {
    name: '工业区', color: '#e8d5c4', borderColor: '#b07a3a', costPerCell: 18,
    desc: '划定工业区域，选定产业类型后自动生成厂房。',
    subTypes: {
      light:    { name: '轻工业', shortName: '工业', color: '#e8d5c4', buildingType: 'lightInd', costPerCell: 15 },
      heavy:    { name: '重工业', shortName: '工业', color: '#a8784a', buildingType: 'heavyInd', costPerCell: 28 },
      hightech: { name: '高新技术', shortName: '科技', color: '#9b6fb8', buildingType: 'highTechInd', costPerCell: 35, isHighTech: true },
    }
  },
  park: {
    name: '公园绿地', color: '#c4e8b4', borderColor: '#4a9c3a', costPerCell: 8,
    desc: '划定绿化区域，自动生成公园绿地。净化空气、提升幸福度。',
    subTypes: {
      park:     { name: '城市公园', shortName: '公园', color: '#c4e8b4', buildingType: 'park', costPerCell: 6 },
      wetland:  { name: '生态湿地', color: '#8ec76e', buildingType: 'ecoWetland', costPerCell: 12 },
    }
  },
};

