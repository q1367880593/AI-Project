/* =============================================================================
   GOLDEN ROAD LoL - MSI Challenge historical dataset
   -----------------------------------------------------------------------------
   Curated team-year rosters for memorable Mid-Season Invitational participants
   from 2015 through 2026, excluding cancelled MSI 2020. Historical completed
   years use Oracle's Elixir player-stat rows from MSI games (players who
   actually played at that role); the 2026 field uses Leaguepedia's pre-event
   roster table because MSI 2026 has not started yet.

   Each role maps to [PlayerName, hiddenRating]. Ratings are subjective gameplay
   values and are not shown directly to players.
   ============================================================================= */

const MSI_TEAMS = [
  {
    id: "furia", name: "FURIA", region: "CBLOL",
    rosters: {
      2025: { TOP: [["Guigo", 82]], JNG: [["Tatu", 83]], MID: [["Tutsz", 82]], ADC: [["Ayu", 81]], SUP: [["JoJo", 80]] },
      2026: { TOP: [["Guigo", 82]], JNG: [["Tatu", 83]], MID: [["Tutsz", 83]], ADC: [["Ayu", 82]], SUP: [["JoJo", 81]] }
    }
  },
  {
    id: "intz", name: "INTZ", region: "CBLOL",
    rosters: {
      2019: { TOP: [["Tay", 80]], JNG: [["Shini", 80]], MID: [["Envy", 82]], ADC: [["Mills", 81]], SUP: [["RedBert", 79]] }
    }
  },
  {
    id: "kabum-esports", name: "KaBuM! Esports", region: "CBLOL",
    rosters: {
      2018: { TOP: [["Zantins", 81]], JNG: [["Ranger", 82]], MID: [["dyNquedo", 83]], ADC: [["TitaN", 85]], SUP: [["Riyev", 82]] }
    }
  },
  {
    id: "loud", name: "LOUD", region: "CBLOL",
    rosters: {
      2023: { TOP: [["Robo", 83]], JNG: [["Croc", 83]], MID: [["tinowns", 83]], ADC: [["Route", 83]], SUP: [["Ceos", 83]] },
      2024: { TOP: [["Robo", 82]], JNG: [["Croc", 82]], MID: [["tinowns", 82]], ADC: [["Route", 82]], SUP: [["RedBert", 82]] }
    }
  },
  {
    id: "pain-gaming", name: "paiN Gaming", region: "CBLOL",
    rosters: {
      2021: { TOP: [["Robo", 83]], JNG: [["CarioK", 83]], MID: [["tinowns", 83]], ADC: [["brTT", 83]], SUP: [["Luci", 83]] }
    }
  },
  {
    id: "red-canids", name: "RED Canids", region: "CBLOL",
    rosters: {
      2017: { TOP: [["Robo", 83]], JNG: [["Nappon", 82]], MID: [["tockers", 82], ["YoDa", 82]], ADC: [["brTT", 84]], SUP: [["Dioud", 83]] },
      2022: { TOP: [["Guigo", 83]], JNG: [["Aegis", 83]], MID: [["Grevthar", 83]], ADC: [["TitaN", 83]], SUP: [["JoJo", 83]] }
    }
  },
  {
    id: "dplus-kia", name: "Dplus KIA", region: "LCK",
    rosters: {
      2021: { TOP: [["Khan", 90]], JNG: [["Canyon", 96]], MID: [["ShowMaker", 92]], ADC: [["Ghost", 88]], SUP: [["BeryL", 89]] }
    }
  },
  {
    id: "gen-g", name: "Gen.G", region: "LCK",
    rosters: {
      2023: { TOP: [["Doran", 86]], JNG: [["Peanut", 88]], MID: [["Chovy", 93]], ADC: [["Peyz", 88]], SUP: [["Delight", 86]] },
      2024: { TOP: [["Kiin", 90]], JNG: [["Canyon", 91]], MID: [["Chovy", 94]], ADC: [["Peyz", 90]], SUP: [["Lehends", 91]] },
      2025: { TOP: [["Kiin", 91]], JNG: [["Canyon", 89]], MID: [["Chovy", 94]], ADC: [["Ruler", 93]], SUP: [["Duro", 89]] }
    }
  },
  {
    id: "hanwha-life-esports", name: "Hanwha Life Esports", region: "LCK",
    rosters: {
      2026: { TOP: [["Zeus", 91]], JNG: [["Kanavi", 90]], MID: [["Zeka", 90]], ADC: [["Gumayusi", 90]], SUP: [["Delight", 88]] }
    }
  },
  {
    id: "kingzone-dragonx", name: "Kingzone DragonX", region: "LCK",
    rosters: {
      2018: { TOP: [["Khan", 89]], JNG: [["Cuzz", 84], ["Peanut", 85]], MID: [["Bdd", 89]], ADC: [["PraY", 87]], SUP: [["GorillA", 86]] }
    }
  },
  {
    id: "t1", name: "T1", region: "LCK",
    rosters: {
      2015: { TOP: [["MaRin", 94]], JNG: [["Bengi", 88]], MID: [["Easyhoon", 88], ["Faker", 98]], ADC: [["Bang", 90]], SUP: [["Wolf", 88]] },
      2016: { TOP: [["Duke", 87]], JNG: [["Blank", 85]], MID: [["Faker", 96]], ADC: [["Bang", 89]], SUP: [["Wolf", 87]] },
      2017: { TOP: [["Huni", 88]], JNG: [["Peanut", 86]], MID: [["Faker", 96]], ADC: [["Bang", 88]], SUP: [["Wolf", 85]] },
      2019: { TOP: [["Khan", 89]], JNG: [["Clid", 87]], MID: [["Faker", 93]], ADC: [["Teddy", 89]], SUP: [["Mata", 90]] },
      2022: { TOP: [["Zeus", 88]], JNG: [["Oner", 88]], MID: [["Faker", 89]], ADC: [["Gumayusi", 89]], SUP: [["Keria", 92]] },
      2023: { TOP: [["Zeus", 90]], JNG: [["Oner", 89]], MID: [["Faker", 88]], ADC: [["Gumayusi", 90]], SUP: [["Keria", 94]] },
      2024: { TOP: [["Zeus", 89]], JNG: [["Oner", 90]], MID: [["Faker", 89]], ADC: [["Gumayusi", 89]], SUP: [["Keria", 93]] },
      2025: { TOP: [["Doran", 86]], JNG: [["Oner", 91]], MID: [["Faker", 88]], ADC: [["Gumayusi", 88]], SUP: [["Keria", 93]] },
      2026: { TOP: [["Doran", 87]], JNG: [["Oner", 92]], MID: [["Faker", 90]], ADC: [["Peyz", 91]], SUP: [["Keria", 94]] }
    }
  },
  {
    id: "gambit-esports", name: "Gambit Esports", region: "LCL",
    rosters: {
      2018: { TOP: [["PvPStejos", 82]], JNG: [["Diamondprox", 85]], MID: [["Kira", 83]], ADC: [["Lodik", 83]], SUP: [["Edward", 84]] }
    }
  },
  {
    id: "unicorns-of-love-cis", name: "Unicorns of Love.CIS", region: "LCL",
    rosters: {
      2021: { TOP: [["BOSS", 79]], JNG: [["AHaHaCiK", 80]], MID: [["Nomanz", 81]], ADC: [["Lodik", 83]], SUP: [["SaNTaS", 79]] }
    }
  },
  {
    id: "vega-squadron", name: "Vega Squadron", region: "LCL",
    rosters: {
      2019: { TOP: [["BOSS", 82]], JNG: [["AHaHaCiK", 82]], MID: [["Nomanz", 82]], ADC: [["Gadget", 82]], SUP: [["SaNTaS", 81]] }
    }
  },
  {
    id: "cloud9", name: "Cloud9", region: "LCS",
    rosters: {
      2021: { TOP: [["Fudge", 88]], JNG: [["Blaber", 88]], MID: [["Perkz", 88]], ADC: [["Zven", 88]], SUP: [["Vulcan", 88]] },
      2023: { TOP: [["Fudge", 86]], JNG: [["Blaber", 87]], MID: [["EMENES", 87]], ADC: [["Berserker", 88]], SUP: [["Zven", 87]] }
    }
  },
  {
    id: "counter-logic-gaming", name: "Counter Logic Gaming", region: "LCS",
    rosters: {
      2016: { TOP: [["Darshan", 82]], JNG: [["Xmithie", 84]], MID: [["huhi", 81]], ADC: [["Stixxay", 83]], SUP: [["aphromoo", 84]] }
    }
  },
  {
    id: "evil-geniuses", name: "Evil Geniuses", region: "LCS",
    rosters: {
      2022: { TOP: [["Impact", 83]], JNG: [["Inspired", 86]], MID: [["Jojopyun", 84]], ADC: [["Danny", 84]], SUP: [["Vulcan", 82]] }
    }
  },
  {
    id: "flyquest", name: "FlyQuest", region: "LCS",
    rosters: {
      2024: { TOP: [["Bwipo", 82]], JNG: [["Inspired", 89]], MID: [["Jensen", 84]], ADC: [["Massu", 83]], SUP: [["Busio", 83]] },
      2025: { TOP: [["Bwipo", 84]], JNG: [["Inspired", 90]], MID: [["Quad", 86]], ADC: [["Massu", 85]], SUP: [["Busio", 83]] }
    }
  },
  {
    id: "team-liquid", name: "Team Liquid", region: "LCS",
    rosters: {
      2018: { TOP: [["Impact", 83]], JNG: [["Xmithie", 84]], MID: [["Pobelter", 82]], ADC: [["Doublelift", 86]], SUP: [["Joey", 79], ["Olleh", 81]] },
      2019: { TOP: [["Impact", 86]], JNG: [["Xmithie", 87]], MID: [["Jensen", 85]], ADC: [["Doublelift", 88]], SUP: [["CoreJJ", 88]] },
      2024: { TOP: [["Impact", 84]], JNG: [["UmTi", 86]], MID: [["APA", 85]], ADC: [["Yeon", 87]], SUP: [["CoreJJ", 87]] },
      2026: { TOP: [["Morgan", 85]], JNG: [["Josedeodo", 83]], MID: [["Quid", 85]], ADC: [["Yeon", 84]], SUP: [["CoreJJ", 85]] }
    }
  },
  {
    id: "tsm", name: "TSM", region: "LCS",
    rosters: {
      2015: { TOP: [["Dyrus", 82]], JNG: [["Santorin", 83]], MID: [["Bjergsen", 88]], ADC: [["WildTurtle", 83]], SUP: [["Lustboy", 85]] },
      2017: { TOP: [["Hauntzer", 84]], JNG: [["Svenskeren", 84]], MID: [["Bjergsen", 88]], ADC: [["WildTurtle", 85]], SUP: [["Biofrost", 83]] }
    }
  },
  {
    id: "fnatic", name: "Fnatic", region: "LEC",
    rosters: {
      2015: { TOP: [["Huni", 89]], JNG: [["Reignover", 88]], MID: [["FEBIVEN", 87]], ADC: [["Steeelback", 84]], SUP: [["YellOwStaR", 85]] },
      2018: { TOP: [["Bwipo", 83], ["sOAZ", 85]], JNG: [["Broxah", 82]], MID: [["Caps", 89]], ADC: [["Rekkles", 87]], SUP: [["Hylissang", 85]] },
      2024: { TOP: [["Oscarinin", 81]], JNG: [["Razork", 86]], MID: [["Humanoid", 86]], ADC: [["Noah", 85]], SUP: [["Jun", 86]] }
    }
  },
  {
    id: "g2-esports", name: "G2 Esports", region: "LEC",
    rosters: {
      2016: { TOP: [["Kikis", 81]], JNG: [["Trick", 85]], MID: [["Perkz", 86]], ADC: [["Emperor", 82]], SUP: [["Hybrid", 80]] },
      2017: { TOP: [["Expect", 82]], JNG: [["Trick", 85]], MID: [["Perkz", 87]], ADC: [["Zven", 85]], SUP: [["Mithy", 83]] },
      2019: { TOP: [["Wunder", 88]], JNG: [["Jankos", 89]], MID: [["Caps", 92]], ADC: [["Perkz", 90]], SUP: [["Mikyx", 89]] },
      2022: { TOP: [["BrokenBlade", 84]], JNG: [["Jankos", 85]], MID: [["Caps", 89]], ADC: [["Flakked", 82]], SUP: [["Targamas", 80]] },
      2023: { TOP: [["BrokenBlade", 86]], JNG: [["Yike", 85]], MID: [["Caps", 90]], ADC: [["Hans Sama", 86]], SUP: [["Mikyx", 86]] },
      2024: { TOP: [["BrokenBlade", 86]], JNG: [["Yike", 84]], MID: [["Caps", 90]], ADC: [["Hans Sama", 85]], SUP: [["Mikyx", 84]] },
      2025: { TOP: [["BrokenBlade", 87]], JNG: [["SkewMond", 86]], MID: [["Caps", 88]], ADC: [["Hans Sama", 87]], SUP: [["Labrov", 87]] },
      2026: { TOP: [["BrokenBlade", 86]], JNG: [["SkewMond", 88]], MID: [["Caps", 89]], ADC: [["Hans Sama", 87]], SUP: [["Labrov", 88]] }
    }
  },
  {
    id: "karmine-corp", name: "Karmine Corp", region: "LEC",
    rosters: {
      2026: { TOP: [["Canna", 86]], JNG: [["Yike", 85]], MID: [["kyeahoo", 85]], ADC: [["Caliste", 85]], SUP: [["Busio", 86]] }
    }
  },
  {
    id: "mad-lions-koi", name: "MAD Lions KOI", region: "LEC",
    rosters: {
      2021: { TOP: [["Armut", 81]], JNG: [["Elyoya", 85]], MID: [["Humanoid", 84]], ADC: [["Carzzy", 83]], SUP: [["Kaiser", 82]] },
      2023: { TOP: [["Chasy", 81]], JNG: [["Elyoya", 86]], MID: [["Nisqy", 82]], ADC: [["Carzzy", 82]], SUP: [["Hylissang", 84]] }
    }
  },
  {
    id: "movistar-koi", name: "Movistar KOI", region: "LEC",
    rosters: {
      2025: { TOP: [["Myrwn", 83]], JNG: [["Elyoya", 85]], MID: [["Jojopyun", 86]], ADC: [["Supa", 83]], SUP: [["Alvaro", 83]] }
    }
  },
  {
    id: "detonation-focusme", name: "DetonatioN FocusMe", region: "LJL",
    rosters: {
      2019: { TOP: [["Evi", 83]], JNG: [["Steal", 82]], MID: [["Ceros", 83]], ADC: [["Yutapon", 83]], SUP: [["Gaeng", 83]] },
      2021: { TOP: [["Evi", 82]], JNG: [["Steal", 80]], MID: [["Aria", 83]], ADC: [["Yutapon", 80]], SUP: [["Kazu", 83]] },
      2022: { TOP: [["Evi", 82]], JNG: [["Steal", 82]], MID: [["Yaharong", 82]], ADC: [["Yutapon", 82]], SUP: [["Harp", 82]] },
      2023: { TOP: [["tol2", 79]], JNG: [["Steal", 79]], MID: [["Aria", 79]], ADC: [["Yutapon", 79]], SUP: [["Harp", 79]] }
    }
  },
  {
    id: "infinity", name: "INFINITY", region: "LLA",
    rosters: {
      2021: { TOP: [["Buggax", 82]], JNG: [["SolidSnake", 82]], MID: [["cody", 82]], ADC: [["WhiteLotus", 82]], SUP: [["Ackerman", 82]] }
    }
  },
  {
    id: "isurus", name: "Isurus", region: "LLA",
    rosters: {
      2017: { TOP: [["Pride", 82]], JNG: [["QQMore", 82]], MID: [["Emp", 82]], ADC: [["Kindless", 82]], SUP: [["Newbie", 82]] },
      2019: { TOP: [["Buggax", 83]], JNG: [["Oddie", 83]], MID: [["Seiya", 83]], ADC: [["Warangelus", 83]], SUP: [["Slow", 83]] }
    }
  },
  {
    id: "kaos-latin-gamers", name: "Kaos Latin Gamers", region: "LLA",
    rosters: {
      2018: { TOP: [["Nate", 83]], JNG: [["Tierwulf", 83]], MID: [["Plugo", 83]], ADC: [["Fix", 83]], SUP: [["Slow", 83]] }
    }
  },
  {
    id: "lyon-gaming", name: "Lyon Gaming", region: "LLA",
    rosters: {
      2017: { TOP: [["Jirall", 82]], JNG: [["Oddie", 83]], MID: [["Seiya", 83]], ADC: [["WhiteLotus", 83]], SUP: [["Genthix", 82]] }
    }
  },
  {
    id: "movistar-r7", name: "Movistar R7", region: "LLA",
    rosters: {
      2018: { TOP: [["Jirall", 82]], JNG: [["Oddie", 83]], MID: [["Seiya", 83]], ADC: [["WhiteLotus", 83]], SUP: [["Genthix", 82]] },
      2023: { TOP: [["Bong", 83]], JNG: [["Oddie", 83]], MID: [["Mireu", 83]], ADC: [["ceo", 83]], SUP: [["Lyonz", 83]] }
    }
  },
  {
    id: "ahq-esports-club", name: "ahq eSports Club", region: "LMS",
    rosters: {
      2015: { TOP: [["Ziv", 82]], JNG: [["Mountain", 80]], MID: [["Westdoor", 84]], ADC: [["An", 79]], SUP: [["Albis", 79]] }
    }
  },
  {
    id: "flash-wolves", name: "Flash Wolves", region: "LMS",
    rosters: {
      2016: { TOP: [["MMD", 80]], JNG: [["Karsa", 85]], MID: [["Maple", 84]], ADC: [["NL", 80]], SUP: [["SwordArt", 83]] },
      2017: { TOP: [["MMD", 82]], JNG: [["Karsa", 87]], MID: [["Maple", 89]], ADC: [["Betty", 85]], SUP: [["SwordArt", 89]] },
      2018: { TOP: [["Hanabi", 82]], JNG: [["MooJin", 83]], MID: [["Maple", 87]], ADC: [["Betty", 84]], SUP: [["SwordArt", 88]] },
      2019: { TOP: [["Hanabi", 83]], JNG: [["Bugi", 83]], MID: [["Rather", 83]], ADC: [["Betty", 83]], SUP: [["ShiauC", 82]] }
    }
  },
  {
    id: "anyones-legend", name: "Anyone's Legend", region: "LPL",
    rosters: {
      2025: { TOP: [["Flandre", 88]], JNG: [["Tarzan", 90]], MID: [["Shanks", 89]], ADC: [["Hope", 89]], SUP: [["Kael", 88]] }
    }
  },
  {
    id: "bilibili-gaming", name: "Bilibili Gaming", region: "LPL",
    rosters: {
      2023: { TOP: [["Bin", 91]], JNG: [["Xun", 85]], MID: [["Yagao", 84]], ADC: [["Elk", 87]], SUP: [["ON", 82]] },
      2024: { TOP: [["Bin", 92]], JNG: [["Xun", 88]], MID: [["Knight", 91]], ADC: [["Elk", 89]], SUP: [["ON", 87]] },
      2025: { TOP: [["Bin", 91]], JNG: [["Beichuan", 84]], MID: [["Knight", 90]], ADC: [["Elk", 90]], SUP: [["ON", 90]] },
      2026: { TOP: [["Bin", 92]], JNG: [["Xun", 89]], MID: [["Knight", 92]], ADC: [["Viper", 92]], SUP: [["ON", 88]] }
    }
  },
  {
    id: "edward-gaming", name: "EDward Gaming", region: "LPL",
    rosters: {
      2015: { TOP: [["Koro1", 88]], JNG: [["Clearlove", 88]], MID: [["PawN", 89]], ADC: [["Deft", 90]], SUP: [["Meiko", 88]] }
    }
  },
  {
    id: "invictus-gaming", name: "Invictus Gaming", region: "LPL",
    rosters: {
      2019: { TOP: [["TheShy", 92]], JNG: [["Ning", 86]], MID: [["Rookie", 92]], ADC: [["JackeyLove", 91]], SUP: [["Baolan", 80]] }
    }
  },
  {
    id: "jd-gaming", name: "JD Gaming", region: "LPL",
    rosters: {
      2023: { TOP: [["369", 90]], JNG: [["Kanavi", 90]], MID: [["Knight", 93]], ADC: [["Ruler", 94]], SUP: [["MISSING", 88]] }
    }
  },
  {
    id: "royal-never-give-up", name: "Royal Never Give Up", region: "LPL",
    rosters: {
      2016: { TOP: [["Looper", 88]], JNG: [["Mlxg", 88]], MID: [["Xiaohu", 89]], ADC: [["Wuxx", 87]], SUP: [["Mata", 91]] },
      2018: { TOP: [["Letme", 84]], JNG: [["Karsa", 92], ["Mlxg", 86]], MID: [["Xiaohu", 91]], ADC: [["Uzi", 95]], SUP: [["Ming", 88]] },
      2021: { TOP: [["Xiaobai", 87], ["Xiaohu", 89]], JNG: [["Wei", 89]], MID: [["Cryin", 90]], ADC: [["GALA", 93]], SUP: [["Ming", 89]] },
      2022: { TOP: [["Bin", 92]], JNG: [["Wei", 89]], MID: [["Xiaohu", 89]], ADC: [["GALA", 93]], SUP: [["Ming", 89]] }
    }
  },
  {
    id: "team-we", name: "Team WE", region: "LPL",
    rosters: {
      2017: { TOP: [["957", 82]], JNG: [["Condi", 86]], MID: [["xiye", 84]], ADC: [["Mystic", 86]], SUP: [["Ben", 81], ["zero", 88]] }
    }
  },
  {
    id: "top-esports", name: "Top Esports", region: "LPL",
    rosters: {
      2024: { TOP: [["369", 90]], JNG: [["Tian", 90]], MID: [["Creme", 89]], ADC: [["JackeyLove", 90]], SUP: [["Meiko", 90]] },
      2026: { TOP: [["ZUIAN", 85]], JNG: [["Tian", 88]], MID: [["Creme", 88]], ADC: [["JackeyLove", 90]], SUP: [["fengyue", 85]] }
    }
  },
  {
    id: "dire-wolves", name: "Dire Wolves", region: "OCE",
    rosters: {
      2017: { TOP: [["Chippys", 83]], JNG: [["Shernfire", 85]], MID: [["Richard", 83]], ADC: [["k1ng", 84]], SUP: [["destiny", 84]] },
      2018: { TOP: [["Chippys", 83]], JNG: [["Shernfire", 85]], MID: [["Triple", 83]], ADC: [["k1ng", 84]], SUP: [["Cupcake", 81]] }
    }
  },
  {
    id: "pentanet-gg", name: "Pentanet.GG", region: "OCE",
    rosters: {
      2021: { TOP: [["BioPanther", 82]], JNG: [["Pabu", 82]], MID: [["Chazz", 83]], ADC: [["Praedyth", 83]], SUP: [["Decoy", 82]] }
    }
  },
  {
    id: "ctbc-flying-oyster", name: "CTBC Flying Oyster", region: "PCS",
    rosters: {
      2025: { TOP: [["Driver", 89], ["Rest", 85]], JNG: [["JunJia", 88]], MID: [["HongQ", 89]], ADC: [["Doggo", 89]], SUP: [["Kaiwing", 88]] }
    }
  },
  {
    id: "psg-talon", name: "PSG Talon", region: "PCS",
    rosters: {
      2021: { TOP: [["Hanabi", 85]], JNG: [["River", 84]], MID: [["Maple", 89]], ADC: [["Doggo", 90]], SUP: [["Kaiwing", 87]] },
      2022: { TOP: [["Azhi", 83], ["Hanabi", 85]], JNG: [["Juhan", 87]], MID: [["Bay", 87]], ADC: [["Unified", 87]], SUP: [["Kaiwing", 87]] },
      2023: { TOP: [["Azhi", 85]], JNG: [["JunJia", 87]], MID: [["ubao", 85]], ADC: [["Wako", 86]], SUP: [["Woody", 84]] },
      2024: { TOP: [["Azhi", 84]], JNG: [["JunJia", 87]], MID: [["Maple", 88]], ADC: [["Betty", 86]], SUP: [["Woody", 85]] }
    }
  },
  {
    id: "fenerbahce-esports", name: "Fenerbahce Esports", region: "TCL",
    rosters: {
      2019: { TOP: [["Ruin", 83]], JNG: [["Kirei", 83]], MID: [["Bolulu", 83]], ADC: [["Ellam", 82]], SUP: [["Japone", 81], ["Only35", 81]] }
    }
  },
  {
    id: "istanbul-wildcats", name: "Istanbul Wildcats", region: "TCL",
    rosters: {
      2021: { TOP: [["StarScreen", 82]], JNG: [["Ferret", 82]], MID: [["Serin", 82]], ADC: [["HolyPhoenix", 82]], SUP: [["Farfetch", 82]] },
      2022: { TOP: [["StarScreen", 81]], JNG: [["Ferret", 81]], MID: [["Serin", 81]], ADC: [["HolyPhoenix", 81]], SUP: [["Farfetch", 81]] }
    }
  },
  {
    id: "supermassive", name: "Papara SuperMassive", region: "TCL",
    rosters: {
      2016: { TOP: [["fabFabulous", 79], ["Thaldrin", 82]], JNG: [["Stomaged", 82]], MID: [["Naru", 82]], ADC: [["Achuu", 82]], SUP: [["Dumbledoge", 82]] },
      2017: { TOP: [["fabFabulous", 81]], JNG: [["Stomaged", 81]], MID: [["Naru", 82]], ADC: [["Zeitnot", 79]], SUP: [["Dumbledoge", 80]] },
      2018: { TOP: [["fabFabulous", 78]], JNG: [["Stomaged", 78]], MID: [["GBM", 83]], ADC: [["Zeitnot", 80]], SUP: [["SnowFlower", 79]] }
    }
  },
  {
    id: "gam-esports", name: "GAM Esports", region: "VCS",
    rosters: {
      2017: { TOP: [["Stark", 82]], JNG: [["Levi", 87]], MID: [["Optimus", 82]], ADC: [["Slay", 78]], SUP: [["Archie", 77]] },
      2023: { TOP: [["Kiaya", 82]], JNG: [["Levi", 86]], MID: [["Kati", 82]], ADC: [["Sty1e", 82]], SUP: [["Zin", 82]] },
      2024: { TOP: [["Kiaya", 83]], JNG: [["Levi", 86]], MID: [["Emo", 83]], ADC: [["Easylove", 83]], SUP: [["Elio", 83]] },
      2025: { TOP: [["Kiaya", 84]], JNG: [["Levi", 86]], MID: [["Aress", 84], ["Emo", 82]], ADC: [["Artemis", 84]], SUP: [["Elio", 85]] }
    }
  },
  {
    id: "phong-vu-buffalo", name: "Phong Vu Buffalo", region: "VCS",
    rosters: {
      2019: { TOP: [["Zeros", 83]], JNG: [["Meliodas", 84], ["XuHao", 79]], MID: [["Naul", 84]], ADC: [["Bigkoro", 83]], SUP: [["Palette", 87]] }
    }
  },
  {
    id: "saigon-buffalo", name: "Saigon Buffalo", region: "VCS",
    rosters: {
      2022: { TOP: [["Hasmed", 82]], JNG: [["BeanJ", 82]], MID: [["Froggy", 82]], ADC: [["Shogun", 83]], SUP: [["Taki", 82]] }
    }
  }

];

if (typeof window !== "undefined") { window.MSI_TEAMS = MSI_TEAMS; }
if (typeof module !== "undefined") { module.exports = { MSI_TEAMS }; }
