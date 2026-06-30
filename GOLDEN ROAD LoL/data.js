/* =============================================================================
   GOLDEN ROAD LoL — Dataset
   -----------------------------------------------------------------------------
   League of Legends esports history, organised by Team -> Year -> Role.

   Each roster role maps to an array of [PlayerName, hiddenRating] entries.
   - hiddenRating is a 1..99 value representing how good that player was in
     that specific year. It is NEVER shown to the player.
   - A player's identity (for the "use once per run" rule) is the slug of their
     name, so the SAME human always spelled the SAME way = the same id.

   Regions follow the historical-accuracy rule from the brief:
     - Top European teams (pre-LEC included) -> "LEC"
     - Top North American teams (pre-LCS included) -> "LCS"
     - Top Korean teams -> "LCK"
     - Top Chinese teams -> "LPL"

   Rating tiers used while authoring:
     96-98 generational peak | 92-95 legendary peak | 88-91 star season
     84-87 strong starter    | 80-83 solid pro       | 75-79 role player
   ============================================================================= */

const GAME_TEAMS = [

  /* ===========================================================================
     LCK  (Korea)
     =========================================================================== */
  {
    id: "t1", name: "T1", region: "LCK",
    rosters: {
      2013: { TOP: [["Impact", 91]], JNG: [["Bengi", 90]], MID: [["Faker", 97]], ADC: [["Piglet", 89]], SUP: [["PoohManDu", 84]] },
      2015: { TOP: [["MaRin", 94]], JNG: [["Bengi", 88]], MID: [["Faker", 98]], ADC: [["Bang", 90]], SUP: [["Wolf", 88]] },
      2016: { TOP: [["Duke", 86]], JNG: [["Bengi", 82], ["Blank", 83]], MID: [["Faker", 96]], ADC: [["Bang", 89]], SUP: [["Wolf", 87]] },
      2017: { TOP: [["Huni", 84]], JNG: [["Peanut", 86], ["Blank", 80]], MID: [["Faker", 94]], ADC: [["Bang", 86]], SUP: [["Wolf", 85]] },
      2019: { TOP: [["Khan", 89]], JNG: [["Clid", 88]], MID: [["Faker", 92]], ADC: [["Teddy", 88]], SUP: [["Effort", 83]] },
      2022: { TOP: [["Zeus", 88]], JNG: [["Oner", 88]], MID: [["Faker", 89]], ADC: [["Gumayusi", 89]], SUP: [["Keria", 92]] },
      2023: { TOP: [["Zeus", 90]], JNG: [["Oner", 89]], MID: [["Faker", 88]], ADC: [["Gumayusi", 90]], SUP: [["Keria", 94]] },
      2024: { TOP: [["Zeus", 89]], JNG: [["Oner", 90]], MID: [["Faker", 90]], ADC: [["Gumayusi", 89]], SUP: [["Keria", 92]] },
      2025: { TOP: [["Doran", 86]], JNG: [["Oner", 91]], MID: [["Faker", 88]], ADC: [["Gumayusi", 87]], SUP: [["Keria", 92]] }
    }
  },
  {
    id: "samsung-white", name: "Samsung White", region: "LCK",
    rosters: {
      2014: { TOP: [["Looper", 89]], JNG: [["DanDy", 96]], MID: [["PawN", 92]], ADC: [["imp", 93]], SUP: [["Mata", 96]] }
    }
  },
  {
    id: "samsung-blue", name: "Samsung Blue", region: "LCK",
    rosters: {
      2014: { TOP: [["Acorn", 84]], JNG: [["Spirit", 88]], MID: [["Dade", 92]], ADC: [["Deft", 90]], SUP: [["Heart", 85]] }
    }
  },
  {
    id: "samsung-galaxy", name: "Samsung Galaxy", region: "LCK",
    rosters: {
      2016: { TOP: [["CuVee", 86]], JNG: [["Ambition", 87]], MID: [["Crown", 86]], ADC: [["Ruler", 87]], SUP: [["CoreJJ", 86]] },
      2017: { TOP: [["CuVee", 88]], JNG: [["Ambition", 90]], MID: [["Crown", 87]], ADC: [["Ruler", 91]], SUP: [["CoreJJ", 90]] }
    }
  },
  {
    id: "geng", name: "Gen.G", region: "LCK",
    rosters: {
      2022: { TOP: [["Doran", 85]], JNG: [["Peanut", 87]], MID: [["Chovy", 92]], ADC: [["Ruler", 92]], SUP: [["Lehends", 86]] },
      2023: { TOP: [["Doran", 86]], JNG: [["Peanut", 88]], MID: [["Chovy", 93]], ADC: [["Peyz", 86]], SUP: [["Delight", 86]] },
      2024: { TOP: [["Kiin", 90]], JNG: [["Canyon", 91]], MID: [["Chovy", 94]], ADC: [["Peyz", 88]], SUP: [["Lehends", 88]] },
      2025: { TOP: [["Kiin", 91]], JNG: [["Canyon", 89]], MID: [["Chovy", 94]], ADC: [["Ruler", 90]], SUP: [["Duro", 84]] }
    }
  },
  {
    id: "koo-tigers", name: "KOO Tigers", region: "LCK",
    rosters: {
      2015: { TOP: [["Smeb", 91]], JNG: [["Hojin", 82]], MID: [["Kuro", 84]], ADC: [["PraY", 89]], SUP: [["GorillA", 89]] }
    }
  },
  {
    id: "rox-tigers", name: "ROX Tigers", region: "LCK",
    rosters: {
      2016: { TOP: [["Smeb", 92]], JNG: [["Peanut", 90]], MID: [["Kuro", 86]], ADC: [["PraY", 91]], SUP: [["GorillA", 90]] }
    }
  },
  {
    id: "kt-rolster", name: "KT Rolster", region: "LCK",
    rosters: {
      2014: { TOP: [["Ssumday", 89]], JNG: [["KaKAO", 87]], MID: [["Rookie", 90]], ADC: [["Arrow", 85]], SUP: [["Hachani", 80]] },
      2018: { TOP: [["Smeb", 91]], JNG: [["Score", 88]], MID: [["Ucal", 84]], ADC: [["Deft", 89]], SUP: [["Mata", 88]] }
    }
  },
  {
    id: "kingzone", name: "Kingzone DragonX", region: "LCK",
    rosters: {
      2018: { TOP: [["Khan", 89]], JNG: [["Peanut", 85], ["Cuzz", 82]], MID: [["Bdd", 88]], ADC: [["PraY", 86]], SUP: [["GorillA", 85]] }
    }
  },
  {
    id: "griffin", name: "Griffin", region: "LCK",
    rosters: {
      2019: { TOP: [["Sword", 79]], JNG: [["Tarzan", 91]], MID: [["Chovy", 89]], ADC: [["Viper", 88]], SUP: [["Lehends", 85]] }
    }
  },
  {
    id: "dwg-kia", name: "DWG KIA", region: "LCK",
    rosters: {
      2020: { TOP: [["Nuguri", 93]], JNG: [["Canyon", 95]], MID: [["ShowMaker", 93]], ADC: [["Ghost", 86]], SUP: [["BeryL", 88]] },
      2021: { TOP: [["Khan", 89]], JNG: [["Canyon", 96]], MID: [["ShowMaker", 92]], ADC: [["Ghost", 87]], SUP: [["BeryL", 87]] },
      2022: { TOP: [["Nuguri", 87]], JNG: [["Canyon", 90]], MID: [["ShowMaker", 90]], ADC: [["deokdam", 84]], SUP: [["Kellin", 83]] }
    }
  },
  {
    id: "drx", name: "DRX", region: "LCK",
    rosters: {
      2022: { TOP: [["Kingen", 86]], JNG: [["Pyosik", 84]], MID: [["Zeka", 89]], ADC: [["Deft", 88]], SUP: [["BeryL", 88]] }
    }
  },
  {
    id: "hanwha-life", name: "Hanwha Life Esports", region: "LCK",
    rosters: {
      2024: { TOP: [["Doran", 86]], JNG: [["Peanut", 87]], MID: [["Zeka", 89]], ADC: [["Viper", 91]], SUP: [["Delight", 86]] },
      2025: { TOP: [["Zeus", 89]], JNG: [["Peanut", 86]], MID: [["Zeka", 89]], ADC: [["Viper", 91]], SUP: [["Delight", 87]] }
    }
  },
  {
    id: "longzhu", name: "Longzhu Gaming", region: "LCK",
    rosters: {
      2017: { TOP: [["Khan", 90]], JNG: [["Cuzz", 85]], MID: [["Bdd", 88]], ADC: [["PraY", 88]], SUP: [["GorillA", 87]] }
    }
  },

  /* ===========================================================================
     LPL  (China)
     =========================================================================== */
  {
    id: "ig", name: "Invictus Gaming", region: "LPL",
    rosters: {
      2018: { TOP: [["TheShy", 96]], JNG: [["Ning", 88]], MID: [["Rookie", 92]], ADC: [["JackeyLove", 91]], SUP: [["Baolan", 82]] },
      2019: { TOP: [["TheShy", 92]], JNG: [["Ning", 84]], MID: [["Rookie", 90]], ADC: [["JackeyLove", 88]], SUP: [["Baolan", 80]] }
    }
  },
  {
    id: "royal-club", name: "Royal Club", region: "LPL",
    rosters: {
      2013: { TOP: [["Globe", 82]], JNG: [["Lucas", 80]], MID: [["Wh1t3zZ", 83]], ADC: [["Uzi", 92]], SUP: [["Tabe", 82]] },
      2014: { TOP: [["Cola", 82]], JNG: [["InSec", 86]], MID: [["corn", 83]], ADC: [["Uzi", 89]], SUP: [["Zero", 81]] }
    }
  },
  {
    id: "rng", name: "Royal Never Give Up", region: "LPL",
    rosters: {
      2018: { TOP: [["Letme", 84]], JNG: [["Mlxg", 86]], MID: [["Xiaohu", 87]], ADC: [["Uzi", 95]], SUP: [["Ming", 87]] },
      2021: { TOP: [["Xiaohu", 88]], JNG: [["Wei", 86]], MID: [["Cryin", 85]], ADC: [["GALA", 88]], SUP: [["Ming", 87]] },
      2022: { TOP: [["Bin", 89]], JNG: [["Wei", 87]], MID: [["Xiaohu", 87]], ADC: [["GALA", 89]], SUP: [["Ming", 87]] }
    }
  },
  {
    id: "edg", name: "EDward Gaming", region: "LPL",
    rosters: {
      2015: { TOP: [["Koro1", 85]], JNG: [["Clearlove", 88]], MID: [["PawN", 89]], ADC: [["Deft", 90]], SUP: [["Meiko", 86]] },
      2016: { TOP: [["Mouse", 80]], JNG: [["Clearlove", 86]], MID: [["Scout", 85]], ADC: [["Deft", 87]], SUP: [["Meiko", 86]] },
      2021: { TOP: [["Flandre", 86]], JNG: [["Jiejie", 88]], MID: [["Scout", 91]], ADC: [["Viper", 92]], SUP: [["Meiko", 89]] }
    }
  },
  {
    id: "fpx", name: "FunPlus Phoenix", region: "LPL",
    rosters: {
      2019: { TOP: [["GimGoon", 82]], JNG: [["Tian", 91]], MID: [["Doinb", 91]], ADC: [["Lwx", 88]], SUP: [["Crisp", 88]] }
    }
  },
  {
    id: "jdg", name: "JD Gaming", region: "LPL",
    rosters: {
      2020: { TOP: [["Zoom", 84]], JNG: [["Kanavi", 89]], MID: [["Yagao", 86]], ADC: [["LokeN", 83]], SUP: [["LvMao", 83]] },
      2023: { TOP: [["369", 90]], JNG: [["Kanavi", 90]], MID: [["knight", 93]], ADC: [["Ruler", 94]], SUP: [["Missing", 87]] }
    }
  },
  {
    id: "tes", name: "Top Esports", region: "LPL",
    rosters: {
      2020: { TOP: [["369", 87]], JNG: [["Karsa", 86]], MID: [["knight", 92]], ADC: [["JackeyLove", 90]], SUP: [["yuyanjia", 82]] }
    }
  },
  {
    id: "suning", name: "Suning", region: "LPL",
    rosters: {
      2020: { TOP: [["Bin", 89]], JNG: [["SofM", 87]], MID: [["Angel", 83]], ADC: [["huanfeng", 86]], SUP: [["SwordArT", 87]] }
    }
  },
  {
    id: "blg", name: "Bilibili Gaming", region: "LPL",
    rosters: {
      2023: { TOP: [["Bin", 89]], JNG: [["Xun", 85]], MID: [["Yagao", 84]], ADC: [["Elk", 87]], SUP: [["ON", 82]] },
      2024: { TOP: [["Bin", 92]], JNG: [["Xun", 88]], MID: [["knight", 91]], ADC: [["Elk", 89]], SUP: [["ON", 87]] }
    }
  },
  {
    id: "wbg", name: "Weibo Gaming", region: "LPL",
    rosters: {
      2023: { TOP: [["TheShy", 88]], JNG: [["Weiwei", 84]], MID: [["Xiaohu", 88]], ADC: [["Light", 87]], SUP: [["Crisp", 87]] }
    }
  },
  {
    id: "world-elite", name: "World Elite", region: "LPL",
    rosters: {
      2012: { TOP: [["CaoMei", 84]], JNG: [["Clearlove", 87]], MID: [["Misaya", 87]], ADC: [["WeiXiao", 87]], SUP: [["Fzzf", 82]] },
      2017: { TOP: [["957", 82]], JNG: [["Condi", 86]], MID: [["xiye", 84]], ADC: [["Mystic", 86]], SUP: [["Ben", 81]] }
    }
  },
  {
    id: "omg", name: "OMG", region: "LPL",
    rosters: {
      2014: { TOP: [["Gogoing", 84]], JNG: [["LoveLing", 85]], MID: [["Cool", 86]], ADC: [["San", 83]], SUP: [["Cloud", 80]] }
    }
  },

  /* ===========================================================================
     LEC  (Europe — includes pre-LEC "EU LCS" era)
     =========================================================================== */
  {
    id: "fnatic", name: "Fnatic", region: "LEC",
    rosters: {
      2011: { TOP: [["xPeke", 84]], JNG: [["CyanideFI", 83]], MID: [["Shushei", 88]], ADC: [["LaMiaFinlandese", 80]], SUP: [["Mellisan", 78]] },
      2013: { TOP: [["sOAZ", 84]], JNG: [["Cyanide", 84]], MID: [["xPeke", 87]], ADC: [["puszu", 82]], SUP: [["YellOwStaR", 85]] },
      2014: { TOP: [["sOAZ", 83]], JNG: [["Cyanide", 82]], MID: [["xPeke", 86]], ADC: [["Rekkles", 85]], SUP: [["YellOwStaR", 84]] },
      2015: { TOP: [["Huni", 90]], JNG: [["Reignover", 88]], MID: [["Febiven", 87]], ADC: [["Rekkles", 88]], SUP: [["YellOwStaR", 86]] },
      2018: { TOP: [["Bwipo", 83]], JNG: [["Broxah", 82]], MID: [["Caps", 89]], ADC: [["Rekkles", 88]], SUP: [["Hylissang", 85]] },
      2022: { TOP: [["Wunder", 81]], JNG: [["Razork", 84]], MID: [["Humanoid", 83]], ADC: [["Upset", 86]], SUP: [["Hylissang", 82]] }
    }
  },
  {
    id: "g2", name: "G2 Esports", region: "LEC",
    rosters: {
      2016: { TOP: [["Kikis", 81]], JNG: [["Trick", 84]], MID: [["Perkz", 86]], ADC: [["Emperor", 82]], SUP: [["Hybrid", 80]] },
      2017: { TOP: [["Expect", 82]], JNG: [["Trick", 84]], MID: [["Perkz", 87]], ADC: [["Zven", 85]], SUP: [["Mithy", 83]] },
      2018: { TOP: [["Wunder", 84]], JNG: [["Jankos", 86]], MID: [["Perkz", 87]], ADC: [["Hjarnan", 81]], SUP: [["Wadid", 80]] },
      2019: { TOP: [["Wunder", 88]], JNG: [["Jankos", 89]], MID: [["Caps", 93]], ADC: [["Perkz", 89]], SUP: [["Mikyx", 89]] },
      2020: { TOP: [["Wunder", 85]], JNG: [["Jankos", 86]], MID: [["Caps", 90]], ADC: [["Perkz", 87]], SUP: [["Mikyx", 85]] },
      2022: { TOP: [["BrokenBlade", 84]], JNG: [["Jankos", 84]], MID: [["Caps", 89]], ADC: [["Flakked", 82]], SUP: [["Targamas", 80]] },
      2024: { TOP: [["BrokenBlade", 86]], JNG: [["Yike", 84]], MID: [["Caps", 90]], ADC: [["Hans Sama", 85]], SUP: [["Mikyx", 84]] }
    }
  },
  {
    id: "origen", name: "Origen", region: "LEC",
    rosters: {
      2015: { TOP: [["sOAZ", 84]], JNG: [["Amazing", 82]], MID: [["xPeke", 86]], ADC: [["Niels", 87]], SUP: [["Mithy", 84]] },
      2019: { TOP: [["Alphari", 87]], JNG: [["Kold", 80]], MID: [["Nukeduck", 83]], ADC: [["Patrik", 83]], SUP: [["Mithy", 82]] }
    }
  },
  {
    id: "mad-lions", name: "MAD Lions", region: "LEC",
    rosters: {
      2021: { TOP: [["Armut", 81]], JNG: [["Elyoya", 86]], MID: [["Humanoid", 84]], ADC: [["Carzzy", 83]], SUP: [["Kaiser", 82]] },
      2022: { TOP: [["Armut", 82]], JNG: [["Elyoya", 87]], MID: [["Nisqy", 83]], ADC: [["UNFORGIVEN", 83]], SUP: [["Kaiser", 83]] }
    }
  },
  {
    id: "rogue", name: "Rogue", region: "LEC",
    rosters: {
      2020: { TOP: [["Finn", 81]], JNG: [["Inspired", 86]], MID: [["Larssen", 85]], ADC: [["Hans Sama", 86]], SUP: [["Vander", 82]] },
      2022: { TOP: [["Odoamne", 84]], JNG: [["Malrang", 82]], MID: [["Larssen", 84]], ADC: [["Comp", 84]], SUP: [["Trymbi", 82]] }
    }
  },
  {
    id: "misfits", name: "Misfits Gaming", region: "LEC",
    rosters: {
      2017: { TOP: [["Alphari", 85]], JNG: [["Maxlore", 81]], MID: [["PowerOfEvil", 85]], ADC: [["Hans Sama", 85]], SUP: [["IgNar", 83]] }
    }
  },

  /* ===========================================================================
     LCS  (North America — includes pre-LCS era)
     =========================================================================== */
  {
    id: "tsm", name: "Team SoloMid", region: "LCS",
    rosters: {
      2011: { TOP: [["Dyrus", 80]], JNG: [["TheOddOne", 80]], MID: [["Reginald", 84]], ADC: [["Chaox", 80]], SUP: [["Xpecial", 80]] },
      2014: { TOP: [["Dyrus", 82]], JNG: [["Amazing", 80]], MID: [["Bjergsen", 88]], ADC: [["WildTurtle", 82]], SUP: [["Lustboy", 84]] },
      2016: { TOP: [["Hauntzer", 83]], JNG: [["Svenskeren", 84]], MID: [["Bjergsen", 89]], ADC: [["Doublelift", 88]], SUP: [["Biofrost", 83]] },
      2017: { TOP: [["Hauntzer", 84]], JNG: [["Svenskeren", 83]], MID: [["Bjergsen", 89]], ADC: [["Doublelift", 88]], SUP: [["Biofrost", 83]] },
      2020: { TOP: [["BrokenBlade", 82]], JNG: [["Spica", 81]], MID: [["Bjergsen", 85]], ADC: [["Doublelift", 83]], SUP: [["Biofrost", 80]] }
    }
  },
  {
    id: "cloud9", name: "Cloud9", region: "LCS",
    rosters: {
      2013: { TOP: [["Balls", 82]], JNG: [["Meteos", 85]], MID: [["Hai", 84]], ADC: [["Sneaky", 84]], SUP: [["LemonNation", 81]] },
      2018: { TOP: [["Licorice", 82]], JNG: [["Svenskeren", 83]], MID: [["Jensen", 85]], ADC: [["Sneaky", 83]], SUP: [["Zeyzal", 82]] },
      2020: { TOP: [["Licorice", 82]], JNG: [["Blaber", 85]], MID: [["Nisqy", 82]], ADC: [["Zven", 85]], SUP: [["Vulcan", 84]] },
      2022: { TOP: [["Fudge", 81]], JNG: [["Blaber", 85]], MID: [["Jensen", 83]], ADC: [["Berserker", 86]], SUP: [["Zven", 81]] }
    }
  },
  {
    id: "clg", name: "Counter Logic Gaming", region: "LCS",
    rosters: {
      2015: { TOP: [["ZionSpartan", 80]], JNG: [["Xmithie", 83]], MID: [["Pobelter", 82]], ADC: [["Doublelift", 86]], SUP: [["aphromoo", 84]] },
      2016: { TOP: [["Darshan", 82]], JNG: [["Xmithie", 84]], MID: [["Huhi", 81]], ADC: [["Stixxay", 83]], SUP: [["aphromoo", 84]] }
    }
  },
  {
    id: "team-liquid", name: "Team Liquid", region: "LCS",
    rosters: {
      2018: { TOP: [["Impact", 83]], JNG: [["Xmithie", 84]], MID: [["Pobelter", 81]], ADC: [["Doublelift", 86]], SUP: [["Olleh", 81]] },
      2019: { TOP: [["Impact", 84]], JNG: [["Xmithie", 85]], MID: [["Jensen", 84]], ADC: [["Doublelift", 86]], SUP: [["CoreJJ", 88]] }
    }
  },
  {
    id: "evil-geniuses", name: "Evil Geniuses", region: "LCS",
    rosters: {
      2022: { TOP: [["Impact", 83]], JNG: [["Inspired", 86]], MID: [["jojopyun", 84]], ADC: [["Danny", 84]], SUP: [["Vulcan", 82]] }
    }
  },
  {
    id: "100-thieves", name: "100 Thieves", region: "LCS",
    rosters: {
      2021: { TOP: [["Ssumday", 85]], JNG: [["Closer", 83]], MID: [["Abbedagge", 81]], ADC: [["FBI", 83]], SUP: [["Huhi", 82]] },
      2023: { TOP: [["Tenacity", 81]], JNG: [["Closer", 83]], MID: [["Quid", 83]], ADC: [["Doublelift", 84]], SUP: [["Busio", 82]] }
    }
  },

  /* ---- More LCS (North America) teams, past & present ---------------------- */
  {
    id: "team-dignitas", name: "Team Dignitas", region: "LCS",
    rosters: {
      2013: { TOP: [["Cruzer", 77]], JNG: [["Crumbz", 79]], MID: [["Scarra", 81]], ADC: [["Imaqtpie", 83]], SUP: [["KiWiKiD", 76]] }
    }
  },
  {
    id: "team-curse", name: "Team Curse", region: "LCS",
    rosters: {
      2014: { TOP: [["Quas", 81]], JNG: [["IWillDominate", 84]], MID: [["Voyboy", 85]], ADC: [["Cop", 81]], SUP: [["Bunny FuFuu", 80]] }
    }
  },
  {
    id: "team-impulse", name: "Team Impulse", region: "LCS",
    rosters: {
      2015: { TOP: [["Impact", 86]], JNG: [["Rush", 87]], MID: [["XiaoWeiXiao", 83]], ADC: [["Apollo", 81]], SUP: [["Adrian", 82]] }
    }
  },
  {
    id: "gravity-gaming", name: "Gravity Gaming", region: "LCS",
    rosters: {
      2015: { TOP: [["Hauntzer", 82]], JNG: [["Move", 80]], MID: [["Keane", 82]], ADC: [["Cop", 80]], SUP: [["Bunny FuFuu", 81]] }
    }
  },
  {
    id: "immortals", name: "Immortals", region: "LCS",
    rosters: {
      2016: { TOP: [["Huni", 86]], JNG: [["Reignover", 85]], MID: [["Pobelter", 83]], ADC: [["WildTurtle", 82]], SUP: [["Adrian", 83]] },
      2017: { TOP: [["Flame", 84]], JNG: [["Dardoch", 83]], MID: [["Pobelter", 82]], ADC: [["Cody Sun", 81]], SUP: [["Olleh", 81]] }
    }
  },
  {
    id: "nrg", name: "NRG Esports", region: "LCS",
    rosters: {
      2016: { TOP: [["Impact", 84]], JNG: [["Santorin", 82]], MID: [["GBM", 83]], ADC: [["Altec", 81]], SUP: [["KonKwon", 79]] },
      2023: { TOP: [["Dhokla", 82]], JNG: [["Contractz", 83]], MID: [["Palafox", 82]], ADC: [["FBI", 84]], SUP: [["IgNar", 83]] }
    }
  },
  {
    id: "phoenix1", name: "Phoenix1", region: "LCS",
    rosters: {
      2017: { TOP: [["zig", 79]], JNG: [["MikeYeung", 83]], MID: [["Ryu", 84]], ADC: [["Arrow", 85]], SUP: [["Xpecial", 80]] }
    }
  },
  {
    id: "flyquest", name: "FlyQuest", region: "LCS",
    rosters: {
      2017: { TOP: [["Balls", 80]], JNG: [["Moon", 80]], MID: [["Hai", 82]], ADC: [["Altec", 81]], SUP: [["LemonNation", 80]] },
      2020: { TOP: [["Solo", 81]], JNG: [["Santorin", 84]], MID: [["PowerOfEvil", 84]], ADC: [["WildTurtle", 82]], SUP: [["IgNar", 82]] }
    }
  },
  {
    id: "echo-fox", name: "Echo Fox", region: "LCS",
    rosters: {
      2018: { TOP: [["Huni", 85]], JNG: [["Dardoch", 84]], MID: [["Fenix", 84]], ADC: [["Altec", 81]], SUP: [["Adrian", 81]] }
    }
  },
  {
    id: "clutch-gaming", name: "Clutch Gaming", region: "LCS",
    rosters: {
      2019: { TOP: [["Huni", 85]], JNG: [["Lira", 82]], MID: [["Damonte", 82]], ADC: [["Cody Sun", 82]], SUP: [["Vulcan", 83]] }
    }
  },
  {
    id: "optic-gaming", name: "OpTic Gaming", region: "LCS",
    rosters: {
      2018: { TOP: [["Ssumday", 85]], JNG: [["Akaadian", 81]], MID: [["PowerOfEvil", 84]], ADC: [["Arrow", 84]], SUP: [["Big", 79]] }
    }
  },
  {
    id: "golden-guardians", name: "Golden Guardians", region: "LCS",
    rosters: {
      2023: { TOP: [["Licorice", 82]], JNG: [["River", 84]], MID: [["Gori", 83]], ADC: [["Stixxay", 82]], SUP: [["Huhi", 83]] }
    }
  },

  /* ---- More LEC (Europe) teams, past & present ----------------------------- */
  {
    id: "moscow-five", name: "Moscow Five", region: "LEC",
    rosters: {
      2012: { TOP: [["Darien", 85]], JNG: [["Diamondprox", 91]], MID: [["Alex Ich", 90]], ADC: [["Genja", 86]], SUP: [["GoSu Pepper", 84]] }
    }
  },
  {
    id: "gambit", name: "Gambit Gaming", region: "LEC",
    rosters: {
      2013: { TOP: [["Darien", 84]], JNG: [["Diamondprox", 88]], MID: [["Alex Ich", 87]], ADC: [["Genja", 85]], SUP: [["Edward", 84]] }
    }
  },
  {
    id: "alliance", name: "Alliance", region: "LEC",
    rosters: {
      2014: { TOP: [["Wickd", 84]], JNG: [["Shook", 83]], MID: [["Froggen", 87]], ADC: [["Tabzz", 83]], SUP: [["Nyph", 82]] }
    }
  },
  {
    id: "sk-gaming", name: "SK Gaming", region: "LEC",
    rosters: {
      2014: { TOP: [["fredy122", 82]], JNG: [["Svenskeren", 83]], MID: [["Jesiz", 82]], ADC: [["CandyPanda", 82]], SUP: [["nRated", 81]] },
      2019: { TOP: [["Werlyb", 79]], JNG: [["Selfmade", 84]], MID: [["Pirean", 81]], ADC: [["Crownshot", 82]], SUP: [["Dreams", 80]] }
    }
  },
  {
    id: "roccat", name: "Team ROCCAT", region: "LEC",
    rosters: {
      2014: { TOP: [["Xaxus", 81]], JNG: [["Jankos", 85]], MID: [["Overpow", 82]], ADC: [["Woolite", 82]], SUP: [["Vander", 83]] }
    }
  },
  {
    id: "uol", name: "Unicorns of Love", region: "LEC",
    rosters: {
      2015: { TOP: [["Vizicsacsi", 82]], JNG: [["Kikis", 81]], MID: [["PowerOfEvil", 84]], ADC: [["Vardags", 80]], SUP: [["Hylissang", 83]] },
      2016: { TOP: [["Vizicsacsi", 83]], JNG: [["Move", 81]], MID: [["Exileh", 82]], ADC: [["Pilot", 81]], SUP: [["Hylissang", 84]] }
    }
  },
  {
    id: "h2k", name: "H2k-Gaming", region: "LEC",
    rosters: {
      2016: { TOP: [["Odoamne", 84]], JNG: [["Jankos", 86]], MID: [["Ryu", 84]], ADC: [["FORG1VEN", 88]], SUP: [["Vander", 83]] }
    }
  },
  {
    id: "splyce", name: "Splyce", region: "LEC",
    rosters: {
      2016: { TOP: [["Wunder", 83]], JNG: [["Trashy", 80]], MID: [["Sencux", 81]], ADC: [["Kobbe", 82]], SUP: [["Mikyx", 83]] },
      2019: { TOP: [["Vizicsacsi", 83]], JNG: [["Xerxe", 82]], MID: [["Humanoid", 84]], ADC: [["Kobbe", 82]], SUP: [["Norskeren", 81]] }
    }
  },
  {
    id: "vitality", name: "Team Vitality", region: "LEC",
    rosters: {
      2018: { TOP: [["Cabochard", 82]], JNG: [["Kikis", 81], ["Gilius", 82]], MID: [["Jiizuke", 83]], ADC: [["Attila", 81]], SUP: [["Jactroll", 81]] },
      2022: { TOP: [["Alphari", 84]], JNG: [["Selfmade", 83]], MID: [["Perkz", 86]], ADC: [["Carzzy", 83]], SUP: [["Labrov", 83]] }
    }
  },
  {
    id: "schalke-04", name: "FC Schalke 04", region: "LEC",
    rosters: {
      2020: { TOP: [["Odoamne", 82]], JNG: [["Gilius", 80]], MID: [["Abbedagge", 82]], ADC: [["Neon", 81]], SUP: [["Dreams", 80]] }
    }
  },

  /* ===========================================================================
     Minor / emerging regions — the most iconic international teams
     =========================================================================== */

  /* ---- LMS · Taiwan — the only minor region to win Worlds (TPA, 2012) ------- */
  {
    id: "tpa", name: "Taipei Assassins", region: "LMS",
    rosters: {
      2012: { TOP: [["Stanley", 81]], JNG: [["Lilballz", 80]], MID: [["Toyz", 85]], ADC: [["bebe", 82]], SUP: [["MiSTakE", 80]] }
    }
  },
  {
    id: "flash-wolves", name: "Flash Wolves", region: "LMS",
    rosters: {
      2016: { TOP: [["MMD", 80]], JNG: [["Karsa", 85]], MID: [["Maple", 84]], ADC: [["NL", 80]], SUP: [["SwordArT", 83]] }
    }
  },
  {
    id: "ahq", name: "ahq e-Sports Club", region: "LMS",
    rosters: {
      2015: { TOP: [["Ziv", 82]], JNG: [["Mountain", 80]], MID: [["Westdoor", 84]], ADC: [["AN", 79]], SUP: [["Albis", 79]] }
    }
  },

  /* ---- PCS · Pacific -------------------------------------------------------- */
  {
    id: "psg-talon", name: "PSG Talon", region: "PCS",
    rosters: {
      2021: { TOP: [["Hanabi", 80]], JNG: [["River", 83]], MID: [["Maple", 85]], ADC: [["Unified", 80]], SUP: [["Kaiwing", 80]] }
    }
  },

  /* ---- VCS · Vietnam -------------------------------------------------------- */
  {
    id: "gam-esports", name: "GAM Esports", region: "VCS",
    rosters: {
      2017: { TOP: [["Archie", 77]], JNG: [["Levi", 86]], MID: [["Optimus", 79]], ADC: [["Slay", 78]], SUP: [["Palette", 77]] }
    }
  },

  /* ---- CBLOL · Brazil ------------------------------------------------------- */
  {
    id: "pain-gaming", name: "paiN Gaming", region: "CBLOL",
    rosters: {
      2015: { TOP: [["Mylon", 79]], JNG: [["SirT", 78]], MID: [["Kami", 81]], ADC: [["brTT", 83]], SUP: [["Dioud", 78]] }
    }
  },
  {
    id: "intz", name: "INTZ e-Sports", region: "CBLOL",
    rosters: {
      2016: { TOP: [["Yang", 79]], JNG: [["Revolta", 81]], MID: [["Tockers", 79]], ADC: [["micaO", 80]], SUP: [["Jockster", 78]] }
    }
  },
  {
    id: "loud", name: "LOUD", region: "CBLOL",
    rosters: {
      2022: { TOP: [["Robo", 80]], JNG: [["Croc", 81]], MID: [["tinowns", 81]], ADC: [["Brance", 81]], SUP: [["Ceos", 79]] }
    }
  },

  /* ---- LJL · Japan ---------------------------------------------------------- */
  {
    id: "dfm", name: "DetonatioN FocusMe", region: "LJL",
    rosters: {
      2021: { TOP: [["Evi", 82]], JNG: [["Steal", 80]], MID: [["Aria", 82]], ADC: [["Yutapon", 80]], SUP: [["Gaeng", 80]] }
    }
  },

  /* ---- TCL · Türkiye -------------------------------------------------------- */
  {
    id: "supermassive", name: "SuperMassive", region: "TCL",
    rosters: {
      2018: { TOP: [["fabFabulous", 78]], JNG: [["Stomaged", 78]], MID: [["GBM", 82]], ADC: [["Zeitnot", 80]], SUP: [["SnowFlower", 79]] }
    }
  },
  {
    id: "fenerbahce", name: "1907 Fenerbahçe", region: "TCL",
    rosters: {
      2018: { TOP: [["Thaldrin", 78]], JNG: [["Bolulu", 78]], MID: [["Frozen", 82]], ADC: [["Padden", 80]], SUP: [["Japone", 78]] }
    }
  },

  /* ---- LLA · Latin America -------------------------------------------------- */
  {
    id: "rainbow7", name: "Rainbow7", region: "LLA",
    rosters: {
      2020: { TOP: [["Acce", 78]], JNG: [["Josedeodo", 82]], MID: [["Mireu", 80]], ADC: [["WhiteLotus", 79]], SUP: [["Shadow", 78]] }
    }
  },

  /* ---- LCL · CIS ------------------------------------------------------------ */
  {
    id: "uol-se", name: "Unicorns of Love SE", region: "LCL",
    rosters: {
      2021: { TOP: [["BOSS", 79]], JNG: [["AHaHaCiK", 80]], MID: [["Nomanz", 81]], ADC: [["Gadget", 79]], SUP: [["SaNTaS", 79]] }
    }
  }

];

/* Make available to game.js (classic script, global scope). */
if (typeof window !== "undefined") { window.GAME_TEAMS = GAME_TEAMS; }
if (typeof module !== "undefined") { module.exports = { GAME_TEAMS }; }
