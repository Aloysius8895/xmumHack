/** Pure renderer; model text and user drafts must always be escaped. */
export const LEARNING_STRINGS = {
    'roadmap.status.alternative': { zh: '备选分支', en: 'Alternative branch', ms: 'Cabang alternatif' },
    'learning.otherBranch': { zh: '此分支可查看。在上方选择对应情境，预览并确认后可切换；原有进度保留。', en: 'You can view this branch. Select its scenario above, preview and confirm to switch; progress is retained.', ms: 'Anda boleh melihat cabang ini. Pilih senario di atas, pratonton dan sahkan untuk bertukar; kemajuan dikekalkan.' },
    'learning.title': { zh: 'AI 变化下的学习安排', en: 'Learning as AI changes', ms: 'Pembelajaran apabila AI berubah' },
    'learning.moderate': { zh: '温和', en: 'Moderate', ms: 'Sederhana' },
    'learning.extreme': { zh: '极端', en: 'Extreme', ms: 'Ekstrem' },
    'learning.default': { zh: '系统默认：温和。现有 AEI 是任务使用快照，无法判断发展速度；极端是可选的规划假设。', en: 'Default: Moderate. The AEI task-use snapshot cannot establish development speed; Extreme is an optional planning assumption.', ms: 'Lalai: Sederhana. Snapshot penggunaan tugas AEI tidak menentukan kadar perkembangan; Ekstrem ialah andaian perancangan pilihan.' },
    'learning.hours': { zh: '按每周 {hours} 小时估算，复查默认间隔 {days} 天；都属于规划设置。', en: 'Estimated at {hours} hours/week, with a {days}-day check-in interval. These are planning settings.', ms: 'Anggaran {hours} jam/minggu, dengan semakan setiap {days} hari. Ini ialah tetapan perancangan.' },
    'learning.analyze': { zh: '分析 AEI 学习依据', en: 'Analyze AEI learning evidence', ms: 'Analisis bukti pembelajaran AEI' },
    'learning.evidence': { zh: '查看技能映射依据', en: 'View skill-mapping evidence', ms: 'Lihat bukti pemetaan kemahiran' },
    'learning.mapping': { zh: '{name}：映射 {count} 项任务', en: '{name}: {count} mapped tasks', ms: '{name}: {count} tugas dipetakan' },
    'learning.thin': { zh: '依据较少或缺失；低值和零值不代表安全。', en: 'Thin or missing evidence; low and zero values do not mean safety.', ms: 'Bukti terhad atau tiada; nilai rendah dan sifar tidak bermakna selamat.' },
    'learning.changed': { zh: '选择已保存；正式路线保留原安排。点击预览，确认后才应用调整。', en: 'Choice saved; your roadmap keeps its current arrangement. Preview and confirm before applying changes.', ms: 'Pilihan disimpan; susunan peta laluan dikekalkan. Pratonton dan sahkan sebelum perubahan digunakan.' },
    'learning.resetMode': { zh: '使用系统默认', en: 'Use system default', ms: 'Guna lalai sistem' },
    'learning.preview': { zh: '预览路线调整', en: 'Preview roadmap changes', ms: 'Pratonton perubahan peta laluan' },
    'learning.previewTitle': { zh: '待确认的调整', en: 'Changes awaiting confirmation', ms: 'Perubahan menunggu pengesahan' },
    'learning.branchChange': { zh: '学习分支：{before} → {after}。两个分支的已有记录都会保留。', en: 'Learning branch: {before} → {after}. Existing progress on both branches is retained.', ms: 'Cabang pembelajaran: {before} → {after}. Kemajuan sedia ada pada kedua-dua cabang dikekalkan.' },
    'learning.preserved': { zh: '保留 {count} 项任务，预计总学习时间变化 {hours} 小时。积分和已有成果保留。', en: '{count} tasks preserved; estimated total effort changes by {hours} hours. Points and existing work are retained.', ms: '{count} tugas dikekalkan; jumlah usaha dianggarkan berubah {hours} jam. Mata dan hasil kerja dikekalkan.' },
    'learning.apply': { zh: '确认应用', en: 'Confirm and apply', ms: 'Sahkan dan gunakan' },
    'learning.discard': { zh: '保留当前路线', en: 'Keep current roadmap', ms: 'Kekalkan peta laluan semasa' },
    'learning.noChanges': { zh: '本次没有需要修改的任务，可以继续学习。', en: 'No task changes are needed this time; continue learning.', ms: 'Tiada perubahan tugas diperlukan kali ini; teruskan pembelajaran.' },
    'learning.reviewTitle': { zh: '每周学习复查 · 约 5–10 分钟', en: 'Weekly learning check-in · about 5–10 min', ms: 'Semakan mingguan · sekitar 5–10 min' },
    'learning.due': { zh: '已到建议复查时间。可以现在复查，也可稍后继续。', en: 'A check-in is due. You can review now or return later.', ms: 'Semakan sudah tiba. Anda boleh menyemak sekarang atau kembali kemudian.' },
    'learning.nextDue': { zh: '下次建议复查：{date}。完成项目后也可以提前复查。', en: 'Next suggested check-in: {date}. You can also review after finishing a project.', ms: 'Semakan seterusnya: {date}. Anda juga boleh menyemak selepas menyiapkan projek.' },
    'learning.start': { zh: '开始简短复查', en: 'Start a short check-in', ms: 'Mulakan semakan ringkas' },
    'learning.refreshQuestions': { zh: '刷新复查问题', en: 'Refresh check-in questions', ms: 'Jana semula soalan semakan' },
    'learning.refreshHint': { zh: '重新生成问题后，未提交的回答会清空；学习进度和已提交记录保留。', en: 'New questions clear unsubmitted answers; learning progress and submitted reviews are retained.', ms: 'Soalan baharu mengosongkan jawapan belum dihantar; kemajuan dan semakan yang dihantar dikekalkan.' },
    'error.checkpoint-refresh-unchanged': { zh: 'AI 返回了相同的问题，已保留当前问题和回答，请再试一次。', en: 'AI returned the same question. Your current questions and answers were kept; please try again.', ms: 'AI mengembalikan soalan sama. Soalan dan jawapan semasa dikekalkan; cuba lagi.' },
    'learning.noStudy': { zh: '暂无已学内容记录。可以先反馈时间和困难，这次不判断理解程度。', en: 'No studied material is recorded yet. You can report time and difficulties; understanding will not be assessed.', ms: 'Belum ada rekod bahan dipelajari. Anda boleh melaporkan masa dan kesukaran; pemahaman tidak dinilai.' },
    'learning.progress': { zh: '本周完成了什么？大约花了多少时间？', en: 'What did you work on, and roughly how much time did it take?', ms: 'Apakah yang anda usahakan dan berapa masa diambil?' },
    'learning.difficulty': { zh: '有哪些困难？也可以说明本周没有时间学习。', en: 'What was difficult? You can also say you had no time to study.', ms: 'Apakah kesukarannya? Anda juga boleh nyatakan tiada masa belajar.' },
    'learning.answer': { zh: '你的解释或检查方法（不知道也可以直接说明）', en: 'Your explanation or checking method (it is fine to say you do not know)', ms: 'Penjelasan atau kaedah semakan anda (boleh nyatakan tidak tahu)' },
    'learning.submit': { zh: '提交复查，查看下一步建议', en: 'Submit and see the next recommendation', ms: 'Hantar dan lihat cadangan seterusnya' },
    'learning.review.ready': { zh: '已有理解依据', en: 'Understanding demonstrated', ms: 'Pemahaman ditunjukkan' },
    'learning.review.needs_practice': { zh: '需要针对性练习', en: 'Targeted practice needed', ms: 'Latihan khusus diperlukan' },
    'learning.review.insufficient_evidence': { zh: '理解依据不足', en: 'Insufficient evidence of understanding', ms: 'Bukti pemahaman tidak mencukupi' },
    'learning.deliverable': { zh: '学习产出', en: 'Deliverable', ms: 'Hasil kerja' },
    'learning.criteria': { zh: '完成标准', en: 'Completion criteria', ms: 'Kriteria siap' },
    'error.bad-learning-mode': { zh: '请选择温和或极端。', en: 'Choose Moderate or Extreme.', ms: 'Pilih Sederhana atau Ekstrem.' },
    'error.no-study-evidence': { zh: '先记录学习或完成任务，再开始复查。', en: 'Record study or complete a task before starting a check-in.', ms: 'Rekod pembelajaran atau siapkan tugas sebelum semakan.' },
    'error.checkpoint-stale': { zh: '路线或进度已变化，请重新开始复查。', en: 'Your roadmap or progress changed. Start a fresh check-in.', ms: 'Peta laluan atau kemajuan berubah. Mulakan semakan baharu.' },
    'error.bad-checkpoint-response': { zh: '请填写至少一项回复，每项最多 2000 字。', en: 'Provide at least one response, up to 2,000 characters each.', ms: 'Isi sekurang-kurangnya satu jawapan, maksimum 2,000 aksara setiap satu.' },
    'error.learning-preview-stale': { zh: '路线、进度或依据已变化，请重新生成调整预览。', en: 'The roadmap, progress or evidence changed. Generate a new preview.', ms: 'Peta laluan, kemajuan atau bukti berubah. Jana pratonton baharu.' },
    'error.bad-learning-plan': { zh: '调整方案未通过规则校验，原路线已保留，请重试。', en: 'The proposed changes failed validation. Your roadmap is preserved; please retry.', ms: 'Cadangan gagal pengesahan. Peta laluan dikekalkan; cuba lagi.' },
    'error.protected-learning-task': { zh: '方案试图修改已有进度的任务，已阻止，请重试。', en: 'A proposed change would modify a task with progress and was blocked. Please retry.', ms: 'Cadangan mengubah tugas yang mempunyai kemajuan telah disekat. Cuba lagi.' },
}

export function renderLearningPanel(state, drafts, { t, esc, skillName, locale = 'en' })
{
    const learning = state.learning
    if(!learning) return ''
    const button = (action, label, extra = '', disabled = false) => `<button type="button" class="career-button is-secondary" data-action="${action}" ${extra} ${disabled ? 'disabled' : ''}>${esc(label)}</button>`
    const field = (key, label) => `<label class="career-field"><span>${esc(label)}</span><textarea class="career-textarea" data-draft="${key}" maxlength="2000" rows="3">${esc(drafts[key] ?? '')}</textarea></label>`
    const pending = learning.pending
    const evidence = learning.evidence?.skills ?? []
    return `<details class="career-notice career-learning" ${pending || learning.checkpoint || learning.checkpointDue || !state.roadmap ? 'open' : ''}>
        <summary>${esc(t('learning.title'))} · ${esc(t(`learning.${learning.mode}`))}</summary><div class="career-learning-content"><p>${esc(t('learning.default'))}</p>
        <div class="career-actions">${[ 'moderate', 'extreme' ].map(mode => button('learning-mode', t(`learning.${mode}`), `data-mode="${mode}" aria-pressed="${learning.mode === mode}"`)).join('')}
        ${learning.userOverride ? button('learning-default', t('learning.resetMode')) : ''}</div>
        <p class="career-muted">${esc(t('learning.hours', { hours: learning.weeklyHours, days: learning.checkpointDays }))}</p>
        ${learning.appliedMode !== learning.mode && state.roadmap ? `<p>${esc(t('learning.changed'))}</p>` : ''}
        <div class="career-learning-analysis">${button('learning-analyze', t('learning.analyze'))}${learning.analysis ? `<p>${esc(learning.analysis)}</p>` : ''}</div>
        <details><summary>${esc(t('learning.evidence'))}</summary><ul>${evidence.map(row => `<li>${esc(t('learning.mapping', { name: skillName(row.skillId), count: row.taskCount }))}${row.thinMapping || row.zeroIsNotSafety ? `<small> ${esc(t('learning.thin'))}</small>` : ''}<ul>${row.tasks.map(task => `<li>${esc(task)}</li>`).join('')}</ul>${row.note ? `<small>${esc(row.note)}</small>` : ''}</li>`).join('')}</ul>
        <a href="https://huggingface.co/datasets/Anthropic/EconomicIndex" target="_blank" rel="noopener noreferrer">Anthropic Economic Index</a></details>
        ${state.roadmap ? `<h3>${esc(t('learning.reviewTitle'))}</h3>
        <p>${esc(learning.checkpointDue ? t('learning.due') : t('learning.nextDue', { date: learning.checkpointDueAt ? new Date(learning.checkpointDueAt).toLocaleDateString(locale) : '—' }))}</p>
        ${learning.hasStudyEvidence ? '' : `<p>${esc(t('learning.noStudy'))}</p>`}${learning.canReview && !learning.checkpoint ? button('learning-checkpoint', t('learning.start')) : ''}
        ${learning.checkpoint ? `<div><div class="career-actions">${button('learning-checkpoint-refresh', t('learning.refreshQuestions'))}</div><p class="career-muted">${esc(t('learning.refreshHint'))}</p>${field('reviewProgress', learning.checkpoint.progressQuestion || t('learning.progress'))}${field('reviewDifficulty', learning.checkpoint.difficultyQuestion || t('learning.difficulty'))}<p><strong>${esc(learning.checkpoint.question)}</strong></p>${learning.checkpoint.feedbackOnly ? '' : field('reviewAnswer', t('learning.answer'))}${button('learning-review', t('learning.submit'))}</div>` : ''}
        ${learning.latestReview ? `<p><strong>${esc(t(`learning.review.${learning.latestReview.understanding}`))}</strong></p><p>${esc(learning.latestReview.feedback)}</p>` : ''}
        ${button('learning-preview', t('learning.preview'))}` : ''}
        ${pending ? `<article aria-live="polite"><h3>${esc(t('learning.previewTitle'))} · ${esc(t(`learning.${pending.mode}`))}</h3><p>${esc(pending.summary)}</p>
        ${pending.branchChanged ? `<p>${esc(t('learning.branchChange', { before: t(`learning.${pending.previousMode}`), after: t(`learning.${pending.mode}`) }))}</p>` : ''}
        <p>${esc(t('learning.preserved', { count: pending.preservedTasks, hours: pending.hoursDelta > 0 ? `+${pending.hoursDelta}` : pending.hoursDelta }))}</p>
        <ul>${pending.changes.map(row => `<li>${row.before ? `${esc(row.before)} → ` : '+ '}${esc(row.title)}<p>${esc(row.why)}</p></li>`).join('')}</ul>
        ${pending.changes.length || pending.branchChanged ? '' : `<p>${esc(t('learning.noChanges'))}</p>`}
        ${button('learning-apply', t('learning.apply'))} ${button('learning-discard', t('learning.discard'))}</article>` : ''}
    </div></details>`
}
