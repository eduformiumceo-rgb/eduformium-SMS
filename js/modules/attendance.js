// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Attendance — loadAttendance · takeAttendance · save · records
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadAttendance(){
    // Always reset date to today when module loads — prevents stale date from boot time
    const attDateEl=document.getElementById('att-date');
    if(attDateEl) attDateEl.value=localDateStr();
    this.renderAttSummary(); this.renderAttendanceRecords();
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('att-class'); if(sel) sel.innerHTML='<option value="">Select Class</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const from=document.getElementById('att-from'), to=document.getElementById('att-to');
    const _7ago=new Date(); _7ago.setDate(_7ago.getDate()-7);
    if(from) from.value=localDateStr(_7ago);
    if(to) to.value=localDateStr();
  },

  renderAttSummary(){
    const att=DB.get('attendance',[]);
    const today=att.filter(a=>a.date===localDateStr());
    const totP=today.reduce((s,a)=>s+(a.present||0),0), totA=today.reduce((s,a)=>s+(a.absent||0),0), totL=today.reduce((s,a)=>s+(a.late||0),0), totT=today.reduce((s,a)=>s+(a.total||0),0);
    const rate=totT>0?Math.round(totP/totT*100):0;
    document.getElementById('att-summary').innerHTML=[
      {val:totT,lbl:"Today's Total",col:'var(--brand)'},
      {val:totP,lbl:'Present',col:'var(--success)'},
      {val:totA,lbl:'Absent',col:'var(--danger)'},
      {val:totL,lbl:'Late',col:'var(--warn)'},
      {val:rate+'%',lbl:'Attendance Rate',col:'var(--brand-teal)'},
    ].map(s=>`<div class="att-card"><div class="att-card-val" style="color:${s.col}">${s.val}</div><div class="att-card-lbl">${s.lbl}</div></div>`).join('');
  },

  openAttendanceForm(){
    const date=document.getElementById('att-date').value;
    const classId=document.getElementById('att-class').value;
    if(!date||!classId){ this.toast('Select a date and class','warn'); return; }
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const cls=DB.get('classes',[]).find(c=>c.id===classId);
    const formCard=document.getElementById('att-form-card');
    document.getElementById('att-form-title').textContent=`Attendance — ${cls?.name||'Class'} · ${fmtDate(date)}`;
    document.getElementById('att-student-list').innerHTML=`<div style="padding:0 1.25rem 1rem">${students.map(s=>`
      <div class="att-student-row">
        <div class="mini-av">${s.fname[0]}${s.lname[0]}</div>
        <div><div style="font-weight:600;font-size:.85rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${s.studentId}</div></div>
        <div class="att-radio-group">
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="present" checked> <span style="color:var(--success);font-weight:600">P</span></label>
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="absent"> <span style="color:var(--danger);font-weight:600">A</span></label>
          <label class="att-radio"><input type="radio" name="att_${s.id}" value="late"> <span style="color:var(--warn);font-weight:600">L</span></label>
        </div>
      </div>`).join('')}
    </div>`;
    formCard.style.display='block'; formCard.dataset.classId=classId; formCard.dataset.date=date;
    formCard.scrollIntoView({behavior:'smooth'});
  },

  markAllAtt(status){
    const students=DB.get('students',[]).filter(s=>s.classId===document.getElementById('att-form-card').dataset.classId&&s.status==='active');
    students.forEach(s=>{ const r=document.querySelector(`input[name="att_${s.id}"][value="${status}"]`); if(r) r.checked=true; });
  },

  saveAttendance(){
    if(!this.hasRole('admin','teacher')){ this.toast('You do not have permission to perform this action','error'); return; }
    const formCard=document.getElementById('att-form-card');
    const classId=formCard.dataset.classId, date=formCard.dataset.date;
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    let present=0,absent=0,late=0;
    students.forEach(s=>{ const v=document.querySelector(`input[name="att_${s.id}"]:checked`)?.value||'present'; if(v==='present') present++; else if(v==='absent') absent++; else late++; });
    const att=DB.get('attendance',[]); const existIdx=att.findIndex(a=>a.date===date&&a.classId===classId);
    const rec={id:uid('a'),date,classId,present,absent,late,total:students.length,term:_currentTerm,academicYear:_academicYear};
    if(existIdx>-1) att[existIdx]=rec; else att.push(rec);
    DB.set('attendance',att); formCard.style.display='none';
    this.audit('Attendance','create',`Attendance saved: ${this.className(classId)} on ${date}`);
    this.toast('Attendance saved!','success'); this.renderAttSummary(); this.renderAttendanceRecords();
  },

  renderAttendanceRecords(){
    const att=DB.get('attendance',[]);
    const from=document.getElementById('att-from')?.value, to=document.getElementById('att-to')?.value;
    let filtered=att;
    if(from&&to) filtered=att.filter(a=>a.date>=from&&a.date<=to);
    filtered.sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('att-tbody').innerHTML=filtered.map(a=>`<tr>
      <td>${fmtDate(a.date)}</td>
      <td>${this.className(a.classId)}</td>
      <td style="color:var(--success);font-weight:700">${a.present}</td>
      <td style="color:var(--danger);font-weight:700">${a.absent}</td>
      <td style="color:var(--warn);font-weight:700">${a.late}</td>
      <td><span class="badge ${a.present/a.total>=0.9?'badge-success':'badge-warn'}">${Math.round(a.present/a.total*100)||0}%</span></td>
      <td>${SMS.hasRole('admin','teacher')?`<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this attendance record?',()=>SMS.deleteAtt('${a.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:`<span></span>`}</td>
    </tr>`).join('')||SMS._emptyState('attendance','No Attendance Records','No records match your date range. Take attendance for today using the form above.','');
  },

  deleteAtt(id){ const a=DB.get('attendance',[]); DB.set('attendance',a.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'attendance',id).catch(()=>{}); this.renderAttSummary(); this.renderAttendanceRecords(); this.toast('Record deleted','warn'); },

  // ══ EXAMS ══
});
