// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Timetable — loadTimetable · renderTimetable · designer
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadTimetable(){
    const classes = DB.get('classes',[]);
    const sel = document.getElementById('tt-class-sel');
    if(sel){
      const current = sel.value;
      sel.innerHTML = '<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
      if(current) sel.value = current;
    }
    const editBtn = document.getElementById('edit-tt-btn');
    if(editBtn) editBtn.onclick = ()=>{
      const classId = document.getElementById('tt-class-sel').value;
      if(!classId){ this.toast('Please select a class first','warn'); return; }
      this.renderTimetable();
    };
    this.renderTimetable();
  },

  renderTimetable(){
    const classId = document.getElementById('tt-class-sel')?.value;
    const grid = document.getElementById('timetable-grid');
    if(!grid) return;
    if(!classId){
      const classes = DB.get('classes',[]);
      grid.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--t4)">
        <div style="margin-bottom:.75rem;display:flex;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;color:var(--t4)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div style="font-weight:600;margin-bottom:.4rem;color:var(--t2)">Select a class to view its timetable</div>
        <div style="font-size:.82rem">Use <strong>Design Structure</strong> to customise days, periods and times</div>
      </div>`;
      return;
    }
    grid.innerHTML = this._buildTTTable(classId, true);
  },

  openTimetableSlot(classId,day,periodId){
    periodId=decodeURIComponent(periodId);
    const struct = this.getTTStructure();
    const period = struct.periods.find(p=>p.id===periodId);
    const timetable=DB.get('timetable',{}); const classData=timetable[classId]||{};
    const slot=classData[day]?.[periodId]||{};
    const subjects=DB.get('subjects',[]).filter(s=>!s.classId||s.classId===classId);
    const staff=DB.get('staff',[]);
    const periodLabel = period ? `${period.label} (${period.from}–${period.to})` : periodId;
    document.getElementById('receipt-title').textContent=`${day} · ${periodLabel}`;
    document.getElementById('receipt-body').innerHTML=`
      <div style="display:grid;gap:.75rem;margin-top:.25rem">
        <div><label style="font-size:.8rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">Subject</label>
          <input id="tt-subj-inp" list="tt-subj-list" value="${slot.subject||''}" placeholder="Type or select subject…" class="form-input" style="width:100%">
          <datalist id="tt-subj-list">${subjects.map(s=>`<option value="${sanitize(s.name)}">`).join('')}</datalist></div>
        <div><label style="font-size:.8rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">Teacher</label>
          <input id="tt-teacher-inp" list="tt-teacher-list" value="${slot.teacher||''}" placeholder="Type or select teacher…" class="form-input" style="width:100%">
          <datalist id="tt-teacher-list">${staff.map(s=>`<option value="${s.fname+' '+s.lname}">`).join('')}</datalist></div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.25rem">
          ${slot.subject?`<button class="btn btn-secondary btn-sm" onclick="SMS.clearTimetableSlot('${classId}','${day}','${periodId}')">Clear Slot</button>`:''}
          <button class="btn btn-primary btn-sm" onclick="SMS.saveTimetableSlot('${classId}','${day}','${periodId}')">Save</button>
        </div>
      </div>`;
    this.openModal('m-receipt');
  },

  saveTimetableSlot(classId,day,periodId){
    const subj=document.getElementById('tt-subj-inp').value.trim();
    const teacher=document.getElementById('tt-teacher-inp').value.trim();
    if(!subj){ this.toast('Enter a subject','warn'); return; }
    const timetable=DB.get('timetable',{});
    if(!timetable[classId]) timetable[classId]={};
    if(!timetable[classId][day]) timetable[classId][day]={};
    timetable[classId][day][periodId]={subject:subj,teacher};
    DB.set('timetable',timetable);
    this.closeModal('m-receipt'); this.renderTimetable();
    this.toast(`${subj} saved!`,'success');
  },

  clearTimetableSlot(classId,day,periodId){
    const timetable=DB.get('timetable',{});
    if(timetable[classId]?.[day]?.[periodId]) delete timetable[classId][day][periodId];
    DB.set('timetable',timetable); this.closeModal('m-receipt'); this.renderTimetable();
  },

  clearTimetable(classId){
    this.confirmDelete('Clear entire timetable for this class?',()=>{
      const timetable=DB.get('timetable',{}); delete timetable[classId]; DB.set('timetable',timetable); this.renderTimetable(); this.toast('Timetable cleared','warn');
    });
  },

  // ══ HOMEWORK ══
});
