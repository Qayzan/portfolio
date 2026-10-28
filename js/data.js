/* Portfolio content. Edit text here; the page renders from this file. */
window.PORTFOLIO = {
  levels: [
    {
      id: 'hollows',
      title: 'Hollows',
      kind: 'Team game, DigiPen',
      status: 'Shipped',
      dates: 'Sep 2025 to Apr 2026',
      year: '2026', engine: 'C++20, custom engine', short: 'Audio, physics, saves, tools',
      role: 'Product manager and programmer. Audio, physics and collision lead',
      cover: 'assets/img/hollows-cover.webp',
      coverW: 1280, coverH: 720,
      tagline: 'A 2D horror game where the monsters hunt by sound, on an engine our team built from scratch.',
      stats: [['172 / 589', 'commits that are mine'], ['5', 'programmers'], ['8 months', 'one shipped game']],
      stack: ['C++20', 'Custom engine', 'FMOD', 'ImGui', 'Supabase', 'CMake'],
      video: {
        src: 'https://qayzan.github.io/hollows-case-study/media/hollows_trailer_720p.mp4',
        poster: 'assets/img/hollows-cover.webp',
        caption: 'Trailer made by the team. 1 minute, with sound.'
      },
      built: [
        'Audio engine and mixer on FMOD: buses for music, effects, ambience and UI, scene crossfades, 3D monster sounds, and a chase mix with a high pass filter, reverb and muffle, all driven by JSON.',
        'Fixed the “popping” problem: sample accurate 140 ms fades on FMOD’s audio clock, volume ramping on every channel, and a low pass filter updated in place instead of being added again.',
        'Box and circle collision with a broad phase grid of 128 pixel cells, so objects only test against their neighbours.',
        'Two local save slots, then sign up, login and cloud sync of those slots through Supabase’s REST API, called straight from C++ with WinHTTP, so the team never had to run a server.',
        'Rebindable gamepad controls with unit tests, controller navigation for every menu, and button prompts that switch with the device.',
        'ImGui editors for the audio mixer, cutscenes, bindings and build size, so designers could tune the game without touching code.'
      ],
      gallery: [
        ['assets/img/hollows-chase.webp', 'The chase: the screen tints red and the audio closes in.'],
        ['assets/img/hollows-mixer.webp', 'Volume sliders map straight onto the mixer buses I built.'],
        ['assets/img/hollows-cloud.webp', 'Cloud account panel on the main menu (test account).'],
        ['assets/img/hollows-inventory.webp', 'Inventory and crafting screen.']
      ],
      links: [
        ['Read the case study', 'https://qayzan.github.io/hollows-case-study/', true]
      ],
      credit: 'Team game. Teammates owned the ECS, renderer, math library and more of the engine; full credits are in the case study.'
    },
    {
      id: 'hot-potato',
      title: 'Hot Potato',
      kind: 'Multiplayer browser game, solo',
      status: 'Live',
      dates: 'Oct 2026 to now',
      year: '2026', engine: 'JavaScript, WebSockets', short: 'Everything',
      role: 'Everything: design, code, art direction, hosting',
      cover: 'assets/img/hotpotato-cover.webp',
      coverW: 1400, coverH: 875,
      tagline: 'A party game for two to four friends. Tag someone, pass the potato, and don’t be holding it when the 15 second fuse runs out.',
      stats: [['2 to 4', 'players per room'], ['v0.5', 'five releases so far'], ['0', 'downloads needed']],
      stack: ['JavaScript', 'WebSockets', 'Canvas', 'Web Audio', 'Render'],
      built: [
        'Live rooms over WebSockets: the host picks two, three or four players, friends join with a room code or invite link, and everyone readies up before each match and rematch.',
        'Controls made for phones first: slide to steer with diagonals, a second finger to dash, plus compact portrait and landscape layouts. Keyboard players get WASD and Space.',
        'A dressing room for your spud: mix and match hats, tops, bottoms, shoes and faces, with saved looks and a randomiser.',
        'Six emotes with shared speech bubbles, match awards, and sound effects with iPhone audio recovery and a sound check in one tap.',
        'Hosted online so it runs while my laptop is off, with dated patch notes inside the game (“The Potato Papers”).'
      ],
      gallery: [
        ['assets/img/hotpotato-arena.webp', 'A round for two players in the backyard, mid taunt.'],
        ['assets/img/hotpotato-boom.webp', 'Boom. The fuse never resets, even when you pass it.'],
        ['assets/img/hotpotato-wardrobe.webp', 'The dressing room.'],
        ['assets/img/hotpotato-mobile.webp', 'The lobby on a phone.']
      ],
      links: [
        ['Play it now', 'https://hot-potato-browser.onrender.com/', true]
      ],
      note: 'Hosted on a free tier, so the first load can take a few seconds while the server wakes up.'
    },
    {
      id: 'eduvision',
      title: 'EduVision',
      kind: 'Android app, team of 7',
      status: 'In development',
      dates: 'Sep 2026 to now',
      year: '2026', engine: 'Unity 6, C#', short: 'Audio, progression, maps',
      role: 'Audio lead and programmer. Gamification, discovery map, instrumentation',
      cover: 'assets/img/eduvision-cover.webp',
      coverW: 1280, coverH: 720,
      tagline: 'Point a phone at an insect, find out what it is, then explore it in 3D, collect it and learn about it. Built for curious kids.',
      stats: [['7', 'person team'], ['3', 'disciplines'], ['Android', 'and Windows builds']],
      stack: ['Unity 6', 'C#', 'Java (Android)', 'OpenStreetMap', 'Git LFS', 'Jira'],
      built: [
        'Text to speech behind one C# interface with Android (custom Java bridge), Windows and editor versions; callbacks reach Unity’s main thread through a thread safe queue, and music ducks while it speaks.',
        'An audio service driven by data: sounds come from a versioned JSON manifest and a pool of 16 audio sources, so new sounds ship without a rebuild.',
        'Gamification: XP and levels, badges, weekly challenges, streaks, a card flip discovery celebration and mini quizzes, all from one rules engine with checks against farming.',
        'A discovery map: opt in location for each find (never in the background, gallery photos never tagged), pins on an OpenStreetMap view you pan and pinch, history and delete.',
        'A performance overlay for development builds: FPS, frame time percentiles and a live graph of what each frame costs.'
      ],
      gallery: [
        ['assets/img/eduvision-discovery.webp', 'A new species: the card flips and the XP lands.'],
        ['assets/img/eduvision-viewer.webp', 'The 3D viewer, which reads aloud.'],
        ['assets/img/eduvision-achievements.webp', 'Badges and level progress.'],
        ['assets/img/eduvision-challenges.webp', 'Weekly challenges.'],
        ['assets/img/eduvision-history.webp', 'Discovery history: every find, with or without a place.'],
        ['assets/img/eduvision-performance.webp', 'The performance overlay in a development build on a phone.']
      ],
      links: [],
      credit: 'Screenshots from a test build on a real phone. UI design by the team’s designers; scan flow, 3D viewer, accounts and collection by teammates.'
    },
    {
      id: 'heavy-assault',
      title: 'Heavy Assault: Rust & Dust',
      kind: 'Team game, DigiPen',
      status: 'Shipped',
      dates: 'Jan to Apr 2025',
      year: '2025', engine: 'C and C++, Alpha Engine', short: 'Combat, leaderboards, audio',
      role: 'Gameplay programmer',
      cover: 'assets/img/heavyassault-cover.webp',
      coverW: 1280, coverH: 720,
      tagline: 'A pixel art boss fight game: parry, slash and shoot through two bosses, chaining combos for a leaderboard score. Written in C and C++ on DigiPen’s Alpha Engine.',
      stats: [['121 / 437', 'commits that are mine'], ['5', 'person team'], ['2', 'boss fights']],
      stack: ['C/C++', 'DigiPen Alpha Engine', 'Python', 'Google Apps Script'],
      built: [
        'Player combat: a heavy attack you hold to charge with knockback, light ranged projectiles on a three vial counter, and a delay so ranged attacks can’t be spammed.',
        'Projectile hits with segment against circle collision, boss arenas with boundary collision, and a debug toggle that draws boss hitboxes.',
        'Online leaderboards for both bosses: a small Python helper sends JSON GET and POST requests to a Google Apps Script web API, with scores kept in Google Sheets and a screen to enter your name.',
        'Network calls run on a background thread (std::async) behind a loading bar, so the game never stalls; the helper ships as an .exe, so players never install Python.',
        'Game audio: attack, parry, dash and charge sounds, both bosses’ attacks and the hub world music.',
        'The DigiPen logo intro with a skip, and tracking down the memory leaks before submission.'
      ],
      video: {
        src: 'assets/video/heavyassault-gameplay.mp4',
        poster: 'assets/img/heavyassault-cover.webp',
        caption: 'Gameplay, 10 seconds, with sound.'
      },
      gallery: [
        ['assets/img/heavyassault-parry2.webp', 'A parry on the second boss, mid combo.'],
        ['assets/img/heavyassault-combo.webp', 'Big hit: combo 9.'],
        ['assets/img/heavyassault-shoot.webp', 'Ranged attack across the desert arena.'],
        ['assets/img/heavyassault-telegraph.webp', 'The first boss telegraphs a sweep.']
      ],
      links: [],
      credit: 'Team game. Art by the team; the leaderboard, combat and audio work above is mine.'
    },
    {
      id: 'room-checker',
      title: 'SIT Room Checker',
      kind: 'Personal tool',
      status: 'Used by friends',
      dates: '2025',
      year: '2025', engine: 'Python, Playwright', short: 'Automation',
      role: 'Solo',
      cover: 'assets/img/roomchecker-cover.webp',
      coverW: 1280, coverH: 720,
      tagline: 'Finds every free discussion room on SIT’s booking system for a time window, instead of clicking through rooms one by one.',
      stats: [['1', 'request checks every room'], ['2', 'ways to use it'], ['0', 'passwords stored']],
      stack: ['Python', 'Playwright', 'Flask', 'Telegram Bot API', 'PyInstaller'],
      built: [
        'Drives the booking site with Playwright and sorts rooms into fully available, partly available (with the free slots) and fully booked.',
        'A Windows app you start with one click that opens a local web page and streams progress while it checks.',
        'A Telegram bot with /login and /check, date and time pickers as buttons, and results in the chat.',
        'Logins go only to SIT’s own sign in page; passwords are never stored.'
      ],
      gallery: [
        ['assets/img/roomchecker-form.webp', 'The local web app.']
      ],
      links: [
        ['Source on GitHub', 'https://github.com/Qayzan/rbs-checker', false]
      ]
    }
  ],

  quests: [
    {
      title: 'The Wardrobe',
      tag: 'Web app with AI',
      text: 'Upload photos of your clothes; AI catalogues each piece and suggests outfits. Garment cutouts run in the browser, and API keys stay in serverless functions.',
      stack: 'Vite, Vercel, Claude API'
    },
    {
      title: 'Song of the Day',
      tag: 'Telegram bot',
      text: 'A bot for group chats: paste a Spotify, Apple Music or YouTube link and it adds the track to one shared Spotify playlist, then posts a recap every Friday.',
      stack: 'Python, Telegram, Spotify API'
    },
    {
      title: 'Imposter',
      tag: 'Party game',
      text: 'A browser party game for a room of friends: a live server and a web client, set up to run on free hosting.',
      stack: 'React, Socket.IO, Render'
    }
  ]
};
