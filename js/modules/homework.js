// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Homework — loadHomework · renderHomework
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadHomework(){ this.renderHomework(); },

  renderHomework(){
    const hw=DB.get('homework',[]); const cf=document.getElementById('hw-class-f')?.value; const sf=document.getElementById('hw-status-f')?.value;
    let filtered=hw.filter(h=>{ if(cf&&h.classId!==cf) return false; if(sf&&h.status!==sf) return false; return true; });
    const colors={pending:'var(--warn-bg)',submitted:'var(--info-bg)',graded:'var(--success-bg)'};
    const border={pending:'var(--warn)',submitted:'var(--info)',graded:'var(--success)'};
    document.getElementById('hw-cards').innerHTML=filtered.map(h=>`
      <div class="hw-card" style="border-left:4px solid ${border[h.status]||'var(--border)'}">
        <div class="hw-card-top">
          <div class="hw-card-title">${sanitize(h.title)}</div>
          ${statusBadge(h.status)}
        </div>
        <div class="hw-card-meta">${this.className(h.classId)} · ${this.subjectName(h.subjectId)}</div>
        <div class="hw-card-desc">${h.desc}</div>
        <div class="hw-card-footer">
          <span>Due: <strong>${fmtDate(h.dueDate)}</strong></span>
          <span>Assigned: ${fmtDate(h.assignedDate)}</span>
          <div style="display:flex;gap:.4rem;margin-left:auto">${SMS.hasRole('admin','teacher')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openHomeworkModal('${h.id}')" style="color:var(--brand);padding:.25rem .5rem;font-size:.72rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:.25rem;vertical-align:-.1em"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this homework?',()=>SMS.deleteHomework('${h.id}'))" style="color:var(--danger);padding:.25rem .5rem;font-size:.72rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:.25rem;vertical-align:-.1em"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete</button>`:`<span></span>`}</div>
        </div>
      </div>`).join('')||'<div style="color:var(--t4);padding:1.5rem">No homework assignments found.</div>';
  },

  // ══ PAYROLL ══
});
