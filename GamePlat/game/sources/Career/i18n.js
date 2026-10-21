/**
 * UI strings by id (skills/game/dialogue-systems: author against ids, never raw text), { zh, en, ms }
 * t('id', { name: 'x' }) replaces {name}
 */
const STRINGS = {
    // General
    'app.title': { zh: '职业冒险', en: 'Career Quest', ms: 'Pengembaraan Kerjaya' },
    'common.close': { zh: '关闭', en: 'Close', ms: 'Tutup' },
    'common.back': { zh: '返回', en: 'Back', ms: 'Kembali' },
    'common.save': { zh: '保存', en: 'Save', ms: 'Simpan' },
    'common.cancel': { zh: '取消', en: 'Cancel', ms: 'Batal' },
    'common.loading': { zh: 'AI 思考中…', en: 'AI is thinking…', ms: 'AI sedang berfikir…' },
    'common.hours': { zh: '{n} 小时', en: '{n} h', ms: '{n} jam' },
    'common.months': { zh: '{a}–{b} 个月', en: '{a}–{b} months', ms: '{a}–{b} bulan' },
    'common.attach': { zh: '附加文件', en: 'Attach file', ms: 'Lampirkan fail' },
    'common.attached': { zh: '已附加：{name}', en: 'Attached: {name}', ms: 'Dilampirkan: {name}' },
    'common.remove': { zh: '移除', en: 'Remove', ms: 'Buang' },
    'common.level': { zh: 'Lv.{n}', en: 'Lv.{n}', ms: 'Tahap {n}' },

    // Character select (sources/Game/CharacterSelect.js)
    'characterSelect.title': { zh: '选择你的角色', en: 'Choose your character', ms: 'Pilih watak anda' },
    'characterSelect.hint': { zh: 'A / D 切换 · Enter 确认开始', en: 'A / D to browse · Enter to start', ms: 'A / D untuk tukar · Enter untuk mula' },
    'characterSelect.empty': { zh: '即将推出', en: 'Coming soon', ms: 'Akan datang' },
    'characterSelect.emptyHint': { zh: '这个角色还没开放，换一个吧', en: 'This character is not available yet', ms: 'Watak ini belum tersedia' },

    // Menu
    'menu.title': { zh: '菜单', en: 'Menu', ms: 'Menu' },
    'menu.profile': { zh: '档案', en: 'Profile', ms: 'Profil' },
    'menu.careers': { zh: '职业', en: 'Careers', ms: 'Kerjaya' },
    'menu.pet': { zh: '宠物', en: 'Pet', ms: 'Haiwan' },
    'menu.roadmap': { zh: '路线', en: 'Roadmap', ms: 'Peta laluan' },
    'menu.log': { zh: '记录', en: 'Log', ms: 'Log' },
    'menu.settings': { zh: '设置', en: 'Settings', ms: 'Tetapan' },
    'menu.leaderboard': { zh: '排行榜', en: 'Leaderboard', ms: 'Papan markah' },

    // HUD
    'hud.points': { zh: '积分', en: 'Points', ms: 'Mata' },
    'hud.affinity': { zh: '好感度', en: 'Affinity', ms: 'Keakraban' },
    'hud.noPet': { zh: '还没有职业宠物', en: 'No career pet yet', ms: 'Belum ada haiwan kerjaya' },
    'hud.mock': { zh: 'AI 演示模式', en: 'AI demo mode', ms: 'Mod demo AI' },
    'hud.noKey': { zh: '未配置 AI 密钥', en: 'AI key missing', ms: 'Kunci AI tiada' },
    'hud.next': { zh: '下一步', en: 'Next', ms: 'Seterusnya' },

    // Next step objective
    'next.profile': { zh: '建立能力档案：说说你会什么', en: 'Build your skill profile: tell us what you can do', ms: 'Bina profil kemahiran: ceritakan apa yang anda boleh buat' },
    'next.target': { zh: '选择目标职业：在小地图上点导师头像传送过去，或打开「职业」', en: 'Pick a target career: click a mentor on the minimap to travel there, or open Careers', ms: 'Pilih kerjaya sasaran: klik mentor pada peta mini untuk ke sana, atau buka Kerjaya' },
    'next.roadmap': { zh: '让 AI 生成你的学习路线', en: 'Let the AI plan your roadmap', ms: 'Biar AI rancang peta laluan anda' },
    'next.study': { zh: '自主学习「{stage}」并记录进度（{p}%）', en: 'Study "{stage}" on your own and log it ({p}%)', ms: 'Belajar "{stage}" sendiri dan log kemajuan ({p}%)' },
    'next.done': { zh: '路线全部完成！可以挑战新的目标', en: 'Roadmap complete! Time for a new goal', ms: 'Peta laluan selesai! Masa untuk matlamat baharu' },

    // Profile
    'profile.title': { zh: '能力档案', en: 'Skill profile', ms: 'Profil kemahiran' },
    'profile.intro': { zh: '用几句话写下你学过、做过的事（课程、项目、实习、兴趣），也可以附上简历。AI 会整理成技能清单，你可以再手动调整。', en: 'Write a few lines about what you have learned or done (courses, projects, internships, hobbies), or attach your CV. The AI turns it into a skill list you can adjust.', ms: 'Tulis beberapa ayat tentang apa yang anda pelajari atau lakukan (kursus, projek, latihan industri, hobi), atau lampirkan CV. AI akan menyusunnya menjadi senarai kemahiran yang boleh anda ubah.' },
    'profile.placeholder': { zh: '例如：大二资讯系，会用 Excel 做报表，学过一点 SQL，做过一个 React 课程作业……', en: 'e.g. 2nd year IT student, I make reports in Excel, learned some SQL, built a React course project…', ms: 'cth. Pelajar IT tahun 2, buat laporan dengan Excel, belajar sedikit SQL, bina projek kursus React…' },
    'profile.extract': { zh: '让 AI 整理技能', en: 'Extract my skills', ms: 'Ekstrak kemahiran saya' },
    'profile.skills': { zh: '我的技能', en: 'My skills', ms: 'Kemahiran saya' },
    'profile.empty': { zh: '还没有技能，先在上面描述一下自己吧。', en: 'No skills yet, describe yourself above first.', ms: 'Belum ada kemahiran, terangkan diri anda di atas dahulu.' },
    'profile.add': { zh: '手动添加技能', en: 'Add a skill', ms: 'Tambah kemahiran' },
    'profile.newSkill': { zh: '技能名称', en: 'Skill name', ms: 'Nama kemahiran' },
    'profile.found': { zh: '找到 {n} 项技能', en: 'Found {n} skills', ms: '{n} kemahiran ditemui' },
    'profile.source.ai': { zh: 'AI', en: 'AI', ms: 'AI' },
    'profile.source.gym': { zh: '历史记录', en: 'Previous record', ms: 'Rekod terdahulu' },
    'profile.source.manual': { zh: '手动', en: 'Manual', ms: 'Manual' },
    'level.0': { zh: '未掌握', en: 'None', ms: 'Tiada' },
    'level.1': { zh: '入门', en: 'Basic', ms: 'Asas' },
    'level.2': { zh: '能实际使用', en: 'Working', ms: 'Boleh guna' },
    'level.3': { zh: '熟练', en: 'Solid', ms: 'Mahir' },

    // Careers
    'careers.title': { zh: '探索职业', en: 'Explore careers', ms: 'Terokai kerjaya' },
    'careers.intro': { zh: '按宠物好感度排序。职业导师分散在世界各地，在小地图上点头像即可传送过去聊天。', en: 'Sorted by pet affinity. Click a career mentor on the minimap to travel there and talk.', ms: 'Disusun mengikut keakraban haiwan. Klik mentor kerjaya pada peta mini untuk ke sana dan berbual.' },
    'careers.affinity': { zh: '好感度 {p}%', en: 'Affinity {p}%', ms: 'Keakraban {p}%' },
    'careers.heat': { zh: '热度：{p}%', en: 'Heat: {p}%', ms: 'Populariti: {p}%' },
    'careers.demand.high': { zh: '需求高', en: 'High demand', ms: 'Permintaan tinggi' },
    'careers.demand.medium': { zh: '需求中等', en: 'Medium demand', ms: 'Permintaan sederhana' },
    'careers.trend.rising': { zh: '热度上升', en: 'Rising', ms: 'Meningkat' },
    'careers.trend.stable': { zh: '热度稳定', en: 'Stable', ms: 'Stabil' },
    'careers.monthTrend': { zh: '{month}趋势 {arrow} {change}%', en: '{month} trend {arrow} {change}%', ms: 'Trend {month} {arrow} {change}%' },
    'careers.monthLive': { zh: '本月趋势来自招聘网站数据（{period}，职位数较上一期变化）；鼠标停在标签上可看说明。', en: 'Monthly trend from job board data ({period}, postings vs the previous period); hover a badge for details.', ms: 'Trend bulanan daripada data laman kerja ({period}, jawatan berbanding tempoh sebelum); halakan tetikus ke lencana untuk butiran.' },
    'careers.postings': { zh: '{n} 个职位', en: '{n} postings', ms: '{n} jawatan' },
    'careers.monthNote': { zh: '本月趋势为参考数据（{period}，需求较上月变化），不是实时招聘统计；鼠标停在标签上可看说明。', en: 'Monthly trend is reference data ({period}, demand vs last month), not live hiring statistics; hover a badge for details.', ms: 'Trend bulanan ialah data rujukan ({period}, permintaan berbanding bulan lepas), bukan statistik pengambilan masa nyata; halakan tetikus ke lencana untuk butiran.' },
    'careers.effort': { zh: '预计投入 {range}（从零开始，每周约 10 小时）', en: 'Estimated effort {range} (from zero, ~10 h a week)', ms: 'Anggaran usaha {range} (dari sifar, ~10 jam seminggu)' },
    'careers.marketNote': { zh: '市场热度为整理的参考信息，并非实时数据。', en: 'Market info is a curated reference, not live data.', ms: 'Maklumat pasaran ialah rujukan yang disusun, bukan data masa nyata.' },
    'careers.requirements': { zh: '技能要求与你的差距', en: 'Skill requirements and your gaps', ms: 'Keperluan kemahiran dan jurang anda' },
    'careers.required': { zh: '要求 {r}', en: 'needs {r}', ms: 'perlu {r}' },
    'careers.yours': { zh: '你 {c}', en: 'you {c}', ms: 'anda {c}' },
    'careers.pet': { zh: '职业宠物：{name}', en: 'Career pet: {name}', ms: 'Haiwan kerjaya: {name}' },
    'careers.current': { zh: '当前目标', en: 'Current target', ms: 'Sasaran semasa' },
    'careers.chooseMode': { zh: '选择准备模式', en: 'Choose a preparation mode', ms: 'Pilih mod persediaan' },
    'mode.general': { zh: 'General 通用职业模式', en: 'General mode', ms: 'Mod Umum' },
    'mode.general.desc': { zh: '还没锁定公司：按职业的一般要求规划。', en: 'No company yet: plan from the general requirements.', ms: 'Belum ada syarikat: rancang ikut keperluan umum.' },
    'mode.customise': { zh: 'Customise 目标公司模式', en: 'Customise mode (target company)', ms: 'Mod Suai (syarikat sasaran)' },
    'mode.customise.desc': { zh: '已有目标岗位：上传或贴上招聘要求，针对性准备。', en: 'Have a target role: upload or paste the job posting to prepare for it.', ms: 'Ada jawatan sasaran: muat naik atau tampal iklan kerja untuk bersedia.' },
    'mode.postingPlaceholder': { zh: '贴上招聘要求文字，或附加 PDF / 截图', en: 'Paste the job posting, or attach a PDF / screenshot', ms: 'Tampal iklan kerja, atau lampirkan PDF / tangkapan skrin' },
    'mode.disclaimer': { zh: '招聘文件只反映该岗位已公开的要求；系统据此协助准备，不代表公司的全部标准，也不保证录用。', en: 'A posting only shows the requirements the company disclosed. We help you prepare for them; it is not the full hiring bar and no offer is guaranteed.', ms: 'Iklan kerja hanya menunjukkan keperluan yang didedahkan. Kami membantu anda bersedia; ia bukan keseluruhan kriteria dan tawaran tidak dijamin.' },
    'mode.confirm': { zh: '确定目标', en: 'Set as target', ms: 'Tetapkan sasaran' },
    'mode.switchWarning': { zh: '更换职业会换一只新宠物并重新规划路线（已有记录会保留）。', en: 'Switching careers gives you a new pet and a new roadmap (logs are kept).', ms: 'Menukar kerjaya memberi haiwan baharu dan peta laluan baharu (log disimpan).' },
    'posting.title': { zh: '岗位要求对照', en: 'Posting requirements', ms: 'Keperluan jawatan' },
    'posting.must': { zh: '必须', en: 'Must', ms: 'Wajib' },
    'posting.nice': { zh: '加分', en: 'Bonus', ms: 'Bonus' },
    'posting.status.met': { zh: '已满足', en: 'Met', ms: 'Dipenuhi' },
    'posting.status.partial': { zh: '部分满足', en: 'Partly', ms: 'Sebahagian' },
    'posting.status.gap': { zh: '有差距', en: 'Gap', ms: 'Jurang' },

    // Pet
    'pet.title': { zh: '职业宠物', en: 'Career pet', ms: 'Haiwan kerjaya' },
    'pet.none': { zh: '选择目标职业后，你会获得一只对应的职业宠物陪你一起准备。', en: 'Pick a target career to get a matching career pet that prepares with you.', ms: 'Pilih kerjaya sasaran untuk mendapat haiwan kerjaya yang bersedia bersama anda.' },
    'pet.affinityNote': { zh: '好感度记录你与职业宠物的关系；技能卡展示你的学习进度与准备方向。', en: 'Affinity records your bond with your career pet; skill cards show your preparation and learning progress.', ms: 'Keakraban merekodkan hubungan anda dengan haiwan kerjaya; kad kemahiran menunjukkan persediaan dan kemajuan pembelajaran.' },
    'pet.skills': { zh: '宠物技能', en: 'Pet skills', ms: 'Kemahiran haiwan' },
    'skill.mastery': { zh: '熟练度', en: 'Proficiency', ms: 'Penguasaan' },
    'skill.heat': { zh: '热度', en: 'Heat', ms: 'Populariti' },
    'skill.market': { zh: '市场需求', en: 'Market demand', ms: 'Permintaan pasaran' },
    'skill.difficulty': { zh: '难度', en: 'Difficulty', ms: 'Kesukaran' },
    'skill.demand.high': { zh: '高', en: 'High', ms: 'Tinggi' },
    'skill.demand.medium': { zh: '中', en: 'Medium', ms: 'Sederhana' },
    'skill.demand.low': { zh: '低', en: 'Low', ms: 'Rendah' },
    'skill.reference': { zh: '热度与难度为参考等级，热度不代表实时招聘数据。', en: 'Heat and difficulty are reference levels; heat is not live recruitment data.', ms: 'Populariti dan kesukaran ialah tahap rujukan; populariti bukan data pengambilan pekerja masa nyata.' },
    'pet.species.owl': { zh: '数据猫头鹰', en: 'Data owl', ms: 'Burung hantu data' },
    'pet.species.fox': { zh: '像素小狐', en: 'Pixel fox', ms: 'Musang piksel' },
    'pet.species.turtle': { zh: '服务器龟', en: 'Server turtle', ms: 'Penyu pelayan' },
    'pet.species.bunny': { zh: '调色兔', en: 'Palette bunny', ms: 'Arnab palet' },
    'pet.species.axolotl': { zh: '神经美西螈', en: 'Neural axolotl', ms: 'Axolotl neural' },
    'pet.species.penguin': { zh: '指南企鹅', en: 'Compass penguin', ms: 'Penguin kompas' },

    // Roadmap
    'roadmap.title': { zh: '学习路线', en: 'Roadmap', ms: 'Peta laluan' },
    'roadmap.noTarget': { zh: '先选择目标职业。', en: 'Pick a target career first.', ms: 'Pilih kerjaya sasaran dahulu.' },
    'roadmap.generate': { zh: '生成路线', en: 'Plan my roadmap', ms: 'Rancang peta laluan' },
    'roadmap.regenerate': { zh: '重新规划', en: 'Re-plan', ms: 'Rancang semula' },
    'roadmap.regenerateConfirm': { zh: '重新规划会清空当前路线的进度，确定吗？', en: 'Re-planning clears the progress of the current roadmap. Continue?', ms: 'Merancang semula akan mengosongkan kemajuan peta laluan semasa. Teruskan?' },
    'roadmap.intro': { zh: 'AI 负责规划，学习由你自主完成：自己找资料、练习、做项目，再回来记录。', en: 'The AI plans, you do the learning: find your own materials, practise, build, then come back and log it.', ms: 'AI merancang, anda belajar: cari bahan sendiri, berlatih, bina projek, kemudian log di sini.' },
    'roadmap.stage': { zh: '阶段 {n}', en: 'Stage {n}', ms: 'Peringkat {n}' },
    'roadmap.status.locked': { zh: '未解锁', en: 'Locked', ms: 'Dikunci' },
    'roadmap.status.active': { zh: '进行中', en: 'In progress', ms: 'Sedang berjalan' },
    'roadmap.status.cleared': { zh: '已完成', en: 'Completed', ms: 'Selesai' },
    'roadmap.why': { zh: '为什么需要', en: 'Why it matters', ms: 'Mengapa penting' },
    'roadmap.covers': { zh: '对应岗位要求：{refs}', en: 'Covers posting requirements: {refs}', ms: 'Meliputi keperluan: {refs}' },
    'roadmap.needs': { zh: '先修：{stages}', en: 'Do first: {stages}', ms: 'Lakukan dahulu: {stages}' },
    'roadmap.mp': { zh: '{n} MP', en: '{n} MP', ms: '{n} MP' },
    'roadmap.mpNote': { zh: 'MP（魔力）= 预计投入的精力，1 MP ≈ 1 小时专注学习。', en: 'MP = estimated effort, 1 MP ≈ 1 hour of focused study.', ms: 'MP = anggaran usaha, 1 MP ≈ 1 jam belajar fokus.' },
    'roadmap.mapTitle': { zh: '学习寻宝图', en: 'Learning treasure map', ms: 'Peta harta pembelajaran' },
    'roadmap.mapTarget': { zh: '目标：{career}', en: 'Goal: {career}', ms: 'Sasaran: {career}' },
    'roadmap.mapRibbon': { zh: '完成任务，点亮你的成长路线', en: 'Finish tasks to light up your path', ms: 'Selesaikan tugasan untuk menerangi laluan anda' },
    'roadmap.mpShort': { zh: '1 MP ≈ 1 小时', en: '1 MP ≈ 1 hour', ms: '1 MP ≈ 1 jam' },
    'roadmap.mapHint': { zh: '把鼠标移到旗子上查看阶段任务', en: 'Hover a flag to see its tasks', ms: 'Halakan tetikus ke bendera untuk melihat tugasan' },
    'roadmap.tasksDone': { zh: '{done} / {total} 已完成', en: '{done} / {total} done', ms: '{done} / {total} siap' },
    'roadmap.unlock': { zh: '解锁条件：完成 {stages}', en: 'Unlocks after: {stages}', ms: 'Dibuka selepas: {stages}' },
    'roadmap.force': { zh: '我还是要学这一阶段', en: 'Start this stage anyway', ms: 'Mulakan peringkat ini juga' },
    'roadmap.forceConfirm': { zh: '还没完成「{stages}」，现在直接学可能会比较吃力。确定要提前开始吗？', en: '“{stages}” is not done yet, this stage may feel hard without it. Start it now anyway?', ms: '“{stages}” belum selesai, peringkat ini mungkin sukar tanpanya. Mulakan sekarang juga?' },
    'roadmap.forceYes': { zh: '确定，开始学', en: 'Yes, start it', ms: 'Ya, mulakan' },
    'roadmap.forced': { zh: '已提前解锁', en: 'Started early', ms: 'Dimulakan awal' },
    'roadmap.chest': { zh: '完成所有阶段，打开宝箱', en: 'Clear every stage to open the chest', ms: 'Selesaikan semua peringkat untuk membuka peti' },
    'roadmap.chestOpen': { zh: '宝箱已开启，你做到了！', en: 'Chest open, you made it!', ms: 'Peti dibuka, anda berjaya!' },
    'roadmap.done': { zh: '完成', en: 'Done', ms: 'Siap' },

    // Log
    'log.title': { zh: '学习记录', en: 'Learning log', ms: 'Log pembelajaran' },
    'log.intro': { zh: '用一句话记下今天做了什么，AI 会归类到对应的技能和任务。', en: 'Note what you did today in a sentence, the AI files it under the right skill and task.', ms: 'Catat apa yang anda buat hari ini dalam satu ayat, AI akan menyusunnya ke kemahiran dan tugasan yang betul.' },
    'log.placeholder': { zh: '例如：今天研究了 SQL JOIN，完成了三道练习，花了 2 小时。', en: 'e.g. Studied SQL JOINs today and did three exercises, 2 hours.', ms: 'cth. Belajar SQL JOIN hari ini dan buat tiga latihan, 2 jam.' },
    'log.submit': { zh: '记录', en: 'Log it', ms: 'Log' },
    'log.noRoadmap': { zh: '先生成学习路线，记录才能对应到任务。', en: 'Plan a roadmap first so logs can be matched to tasks.', ms: 'Rancang peta laluan dahulu supaya log boleh dipadankan dengan tugasan.' },
    'log.channels': { zh: '即将支持：在 WhatsApp / Telegram 直接发消息记录进度。', en: 'Coming soon: log your progress by messaging us on WhatsApp / Telegram.', ms: 'Akan datang: log kemajuan melalui WhatsApp / Telegram.' },
    'log.note': { zh: '每推进 1% 任务进度得分：高难度技能 ×3、中等 ×2、低难度 ×1。', en: 'Each 1% of task progress scores: hard skills ×3, medium ×2, easy ×1.', ms: 'Setiap 1% kemajuan tugasan memberi mata: kemahiran sukar ×3, sederhana ×2, mudah ×1.' },
    'log.recent': { zh: '最近记录', en: 'Recent logs', ms: 'Log terkini' },
    'log.advanced': { zh: '任务进度 {from}% → {to}%', en: 'Task {from}% → {to}%', ms: 'Tugasan {from}% → {to}%' },
    'log.points': { zh: '+{n} 积分', en: '+{n} points', ms: '+{n} mata' },


    // Leaderboard (friend codes, server/friends.js)
    'leaderboard.title': { zh: '排行榜', en: 'Leaderboard', ms: 'Papan markah' },
    'leaderboard.openSpot': { zh: '待上榜', en: 'Open spot', ms: 'Tempat kosong' },
    'leaderboard.rule': { zh: '积分来自每天的学习记录：任务每推进 1%，高难度技能得 {high} 分、中等 {medium} 分、低难度 {low} 分。', en: 'Points come from your daily logs: each 1% of task progress gives {high} for hard skills, {medium} for medium, {low} for easy.', ms: 'Mata datang daripada log harian: setiap 1% kemajuan tugasan memberi {high} untuk kemahiran sukar, {medium} sederhana, {low} mudah.' },
    'leaderboard.you': { zh: '你', en: 'you', ms: 'anda' },
    'leaderboard.noName': { zh: '未命名', en: 'No name', ms: 'Tiada nama' },
    'leaderboard.sharedAt': { zh: '分数更新于 {date}', en: 'Score from {date}', ms: 'Markah pada {date}' },
    'leaderboard.empty': { zh: '还没有好友。把你的好友码发给朋友，再把他们的好友码贴到下面。', en: 'No friends yet. Send your friend code to friends and paste theirs below.', ms: 'Belum ada rakan. Hantar kod rakan anda dan tampal kod mereka di bawah.' },
    'leaderboard.name': { zh: '你的名字', en: 'Your name', ms: 'Nama anda' },
    'leaderboard.namePlaceholder': { zh: '朋友会看到的名字', en: 'The name your friends see', ms: 'Nama yang dilihat rakan' },
    'leaderboard.nameFirst': { zh: '先设定名字，朋友才知道是你。', en: 'Set a name first so your friends know it is you.', ms: 'Tetapkan nama dahulu supaya rakan kenal anda.' },
    'leaderboard.nameSaved': { zh: '名字已保存。', en: 'Name saved.', ms: 'Nama disimpan.' },
    'leaderboard.myCode': { zh: '我的好友码', en: 'My friend code', ms: 'Kod rakan saya' },
    'leaderboard.myCodeHint': { zh: '好友码包含你现在的积分，分数变高后再分享一次，朋友那边就会更新。', en: 'The code carries your current points, share it again after you score to update your friends.', ms: 'Kod ini membawa mata semasa anda, kongsi semula selepas mendapat mata untuk mengemas kini rakan.' },
    'leaderboard.copy': { zh: '复制', en: 'Copy', ms: 'Salin' },
    'leaderboard.copied': { zh: '好友码已复制，发给朋友吧！', en: 'Friend code copied, send it to your friends!', ms: 'Kod rakan disalin, hantar kepada rakan anda!' },
    'leaderboard.add': { zh: '添加好友 / 更新分数', en: 'Add a friend / update a score', ms: 'Tambah rakan / kemas kini markah' },
    'leaderboard.addButton': { zh: '添加', en: 'Add', ms: 'Tambah' },
    'leaderboard.added': { zh: '好友已加入排行榜。', en: 'Friend added to the leaderboard.', ms: 'Rakan ditambah ke papan markah.' },
    'leaderboard.updated': { zh: '好友分数已更新。', en: 'Friend score updated.', ms: 'Markah rakan dikemas kini.' },

    // Settings
    'settings.language': { zh: '语言', en: 'Language', ms: 'Bahasa' },
    'settings.reset': { zh: '重置全部进度', en: 'Reset all progress', ms: 'Set semula semua kemajuan' },
    'settings.resetConfirm': { zh: '确定要清空档案、宠物、路线和记录吗？无法恢复。', en: 'Delete your profile, pet, roadmap and logs? This cannot be undone.', ms: 'Padam profil, haiwan, peta laluan dan log? Tidak boleh dibatalkan.' },
    'settings.ai': { zh: 'AI：{model}', en: 'AI: {model}', ms: 'AI: {model}' },
    'settings.aiMock': { zh: 'AI 演示模式（未调用 Claude，结果为示例）。在 .env 设置 ANTHROPIC_API_KEY 并去掉 AI_MOCK=1 即可启用。', en: 'AI demo mode (Claude is not called, answers are samples). Set ANTHROPIC_API_KEY in .env and remove AI_MOCK=1 to enable it.', ms: 'Mod demo AI (Claude tidak dipanggil, jawapan ialah contoh). Tetapkan ANTHROPIC_API_KEY dalam .env dan buang AI_MOCK=1.' },

    // NPC
    'npc.leader': { zh: '{career}职业导师', en: '{career} mentor', ms: 'Mentor {career}' },
    'npc.talk': { zh: '聊天', en: 'Talk', ms: 'Berbual' },
    'npc.greeting': { zh: '欢迎来了解{career}！我是这里的职业导师。', en: 'Welcome! I am your {career} career mentor.', ms: 'Selamat datang! Saya mentor kerjaya {career} anda.' },
    'npc.greetingTarget': { zh: '你回来啦！和 {pet} 准备得怎么样了？', en: 'Welcome back! How is the preparation with {pet} going?', ms: 'Selamat kembali! Bagaimana persediaan dengan {pet}?' },
    'npc.ask.about': { zh: '这个职业需要什么？', en: 'What does this career need?', ms: 'Apa yang kerjaya ini perlukan?' },
    'npc.ask.fit': { zh: '我离这个职业还有多远？', en: 'How far am I from it?', ms: 'Sejauh mana saya daripadanya?' },
    'npc.ask.market': { zh: '市场需求怎么样？', en: 'How is the job market?', ms: 'Bagaimana pasaran kerja?' },
    'npc.ask.target': { zh: '我想以这个职业为目标', en: 'I want this career as my goal', ms: 'Saya mahu kerjaya ini sebagai matlamat' },
    'npc.ask.bye': { zh: '下次再聊', en: 'See you later', ms: 'Jumpa lagi' },
    'npc.about': { zh: '我们最看重这些技能：{skills}。', en: 'We value these skills most: {skills}.', ms: 'Kami paling menghargai kemahiran ini: {skills}.' },
    'npc.fit': { zh: '你现在的匹配度是 {p}%。还需要补充：{gaps}。', en: 'Your match is {p}%. Still to build: {gaps}.', ms: 'Padanan anda {p}%. Masih perlu dibina: {gaps}.' },
    'npc.fitNone': { zh: '你的匹配度是 {p}%，要求的技能都达到了！', en: 'Your match is {p}%, you meet every required skill!', ms: 'Padanan anda {p}%, semua kemahiran dipenuhi!' },
    'npc.fitNoProfile': { zh: '我还不了解你。先去「档案」建立能力档案吧。', en: 'I do not know you yet. Build your skill profile first.', ms: 'Saya belum kenal anda. Bina profil kemahiran dahulu.' },
    'npc.market': { zh: '热度：{p}%，{trend}。从零开始大约要 {range}。（参考信息，非实时数据）', en: 'Heat: {p}%, {trend}. From zero it takes about {range}. (Reference, not live data)', ms: 'Populariti: {p}%, {trend}. Dari sifar mengambil kira-kira {range}. (Rujukan, bukan data masa nyata)' },
    'npc.target': { zh: '好！选择准备模式，我会把 {pet} 交给你。', en: 'Great! Choose your preparation mode and I will hand {pet} over to you.', ms: 'Bagus! Pilih mod persediaan dan saya akan serahkan {pet} kepada anda.' },
    'npc.bye': { zh: '祝你学习顺利！', en: 'Good luck with your studies!', ms: 'Semoga berjaya!' },
    'npc.continue': { zh: '继续', en: 'Continue', ms: 'Teruskan' },
    'map.teleport': { zh: '点击传送', en: 'click to travel', ms: 'klik untuk ke sana' },

    // Errors
    'error.ai-auth': { zh: 'AI 密钥无效或未设置（ANTHROPIC_API_KEY）。', en: 'The AI key is missing or invalid (ANTHROPIC_API_KEY).', ms: 'Kunci AI tiada atau tidak sah (ANTHROPIC_API_KEY).' },
    'error.ai-busy': { zh: 'AI 现在比较忙，请稍后再试。', en: 'The AI is busy, try again shortly.', ms: 'AI sibuk, cuba lagi sebentar.' },
    'error.ai-offline': { zh: '连不上 AI 服务，请检查网络。', en: 'Cannot reach the AI service, check the network.', ms: 'Tidak dapat menghubungi AI, semak rangkaian.' },
    'error.ai-refused': { zh: 'AI 拒绝处理这段内容，请换个说法。', en: 'The AI declined this content, try rephrasing.', ms: 'AI menolak kandungan ini, cuba ubah ayat.' },
    'error.file-type': { zh: '只支持 PDF、图片（PNG/JPG/WebP）和纯文本文件。', en: 'Only PDF, images (PNG/JPG/WebP) and text files are supported.', ms: 'Hanya PDF, imej (PNG/JPG/WebP) dan fail teks disokong.' },
    'error.file-too-large': { zh: '文件太大（上限 10 MB）。', en: 'The file is too large (10 MB max).', ms: 'Fail terlalu besar (maks 10 MB).' },
    'error.empty': { zh: '请先输入内容。', en: 'Please write something first.', ms: 'Sila tulis sesuatu dahulu.' },
    'error.empty-posting': { zh: '请贴上招聘要求或附加文件。', en: 'Paste the posting or attach a file.', ms: 'Tampal iklan kerja atau lampirkan fail.' },
    'error.locked': { zh: '先完成先修阶段。', en: 'Clear the earlier stages first.', ms: 'Selesaikan peringkat awal dahulu.' },
    'error.empty-name': { zh: '请先输入名字。', en: 'Please enter a name first.', ms: 'Sila masukkan nama dahulu.' },
    'error.friend-code': { zh: '好友码无效，请确认整串都复制了。', en: 'That friend code is not valid, check it was copied in full.', ms: 'Kod rakan tidak sah, pastikan ia disalin sepenuhnya.' },
    'error.friend-self': { zh: '这是你自己的好友码。', en: 'That is your own friend code.', ms: 'Itu kod rakan anda sendiri.' },
    'error.friend-full': { zh: '好友已满（最多 50 位）。', en: 'Friend list is full (50 max).', ms: 'Senarai rakan penuh (maks 50).' },
    'error.no-friend': { zh: '找不到这位好友。', en: 'Friend not found.', ms: 'Rakan tidak dijumpai.' },
    'error.generic': { zh: '出了点问题，请再试一次。', en: 'Something went wrong, please try again.', ms: 'Ada masalah, sila cuba lagi.' },
}

export const LANGS = [
    { id: 'zh', label: '中文' },
    { id: 'en', label: 'English' },
    { id: 'ms', label: 'Bahasa Melayu' },
]

let current = 'zh'
try
{
    current = localStorage.getItem('careerLang') || current
}
catch {}

export function getLang()
{
    return current
}

export function setLang(lang)
{
    current = lang
    try
    {
        localStorage.setItem('careerLang', lang)
    }
    catch {}
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang
}

export function t(id, vars = {})
{
    const entry = STRINGS[id]
    let text = entry ? (entry[current] ?? entry.en) : id
    for(const key in vars)
        text = text.replaceAll(`{${key}}`, vars[key])
    return text
}

// { zh, en, ms } objects coming from the server (career names...)
export function pick(localized)
{
    return localized ? (localized[current] ?? localized.en) : ''
}
