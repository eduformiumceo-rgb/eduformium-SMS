// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Classes & Subjects — loadClasses · renderClasses · subjects
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadClasses(){
    this.renderClasses(); this.renderSubjectsTable();
    // Populate class selects everywhere
    const classes=DB.get('classes',[]);
    const staff=DB.get('staff',[]).filter(s=>s.role==='teacher');
    ['clf-teacher','subj-class','att-class','tt-class-sel','hw-class-f','grade-class-sel','res-class-sel','fee-class-f','sf-class','msg-class','ex-class','s-class-f'].forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      if(id==='clf-teacher') el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
      else if(id==='subj-class'||id==='att-class'||id==='tt-class-sel'||id==='hw-class-f'||id==='grade-class-sel'||id==='res-class-sel'||id==='fee-class-f'||id==='msg-class'||id==='ex-class')
        el.innerHTML=(id==='att-class'||id==='tt-class-sel'?'<option value="">Select Class</option>':'<option value="">All Classes</option>')+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
      else el.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    });
    ['subj-teacher'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join(''); });
  },

  renderClasses(){
    const classes=DB.get('classes',[]);
    const students=DB.get('students',[]);
    const staff=DB.get('staff',[]);
    document.getElementById('classes-grid').innerHTML=classes.map(c=>{
      const count=students.filter(s=>s.classId===c.id).length;
      const teacher=staff.find(s=>s.id===c.teacherId);
      return `<div class="class-card" onclick="SMS.openClassModal('${c.id}')">
        <div class="class-card-name">${sanitize(c.name)}</div>
        <div class="class-card-teacher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;margin-right:4px;vertical-align:middle;opacity:.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${teacher?teacher.fname+' '+teacher.lname:'No class teacher'}</div>
        <div class="class-card-stats">
          <div class="cc-stat"><strong>${count}</strong>Students</div>
          <div class="cc-stat"><strong>${c.capacity}</strong>Capacity</div>
          <div class="cc-stat"><strong>${c.room||'—'}</strong>Room</div>
        </div>
      </div>`;
    }).join('') || '<div style="color:var(--t4);padding:1rem">No classes added yet.</div>';
  },

  renderSubjectsTable(){
    const subjects=DB.get('subjects',[]);
    const classes=DB.get('classes',[]);
    const staff=DB.get('staff',[]);
    document.getElementById('subjects-tbody').innerHTML=subjects.map(s=>{
      const cls=classes.find(c=>c.id===s.classId);
      const teacher=staff.find(t=>t.id===s.teacherId);
      return `<tr>
        <td style="font-weight:600">${sanitize(s.name)}</td>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.code||'—'}</td>
        <td>${cls?.name||'—'}</td>
        <td>${teacher?teacher.fname+' '+teacher.lname:'—'}</td>
        <td>${s.periods||'—'}/week</td>
        <td>${SMS.hasRole('admin')?`<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete subject ${sanitize(s.name)}?',()=>SMS.deleteSubject('${s.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:`<span></span>`}</td>
      </tr>`;
    }).join('')||SMS._emptyState('default','No Subjects Added','Add subjects to your classes so you can assign exams and track grades.','+ Add Subject',"SMS.openSubjectModal()");
  },

  openClassModal(id=null){
    const staff=DB.get('staff',[]).filter(s=>s.role==='teacher');
    document.getElementById('clf-teacher').innerHTML='<option value="">— Select —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
    ['clf-id','clf-name','clf-level','clf-room'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('clf-capacity').value='40';
    document.getElementById('class-modal-title').textContent='Add Class';
    if(id){
      const c=DB.get('classes',[]).find(x=>x.id===id); if(!c) return;
      document.getElementById('clf-id').value=c.id;
      document.getElementById('clf-name').value=c.name;
      document.getElementById('clf-level').value=c.level||'';
      document.getElementById('clf-teacher').value=c.teacherId||'';
      document.getElementById('clf-capacity').value=c.capacity||40;
      document.getElementById('clf-room').value=c.room||'';
      document.getElementById('class-modal-title').textContent='Edit Class';
    }
    this.openModal('m-class');
  },

  saveClass(){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; }
    const name=document.getElementById('clf-name').value.trim(); if(!name){ this.toast('Class name required','error'); return; }
    const classes=DB.get('classes',[]);
    const existId=document.getElementById('clf-id').value;
    const data={name,level:document.getElementById('clf-level').value,teacherId:document.getElementById('clf-teacher').value,capacity:+document.getElementById('clf-capacity').value||40,room:document.getElementById('clf-room').value};
    if(existId){ const i=classes.findIndex(c=>c.id===existId); if(i>-1){ classes[i]={...classes[i],...data}; DB.set('classes',classes); this.toast('Class updated','success'); this.audit('Edit Class','edit',`Updated class: ${name}`); } }
    else { classes.push({id:uid('cls'),...data}); DB.set('classes',classes); this.toast('Class added','success'); this.audit('Add Class','create',`New class: ${name}`); }
    this.closeModal('m-class'); this.renderClasses();
  },

  openSubjectModal(){ ['subj-name','subj-code','subj-class','subj-teacher'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; }); document.getElementById('subj-periods').value='5'; this.openModal('m-subject'); },

  saveSubject(){
    const name=document.getElementById('subj-name').value.trim(); const classId=document.getElementById('subj-class').value;
    if(!name||!classId){ this.toast('Subject name and class required','error'); return; }
    const subjs=DB.get('subjects',[]);
    subjs.push({id:uid('subj'),name,code:document.getElementById('subj-code').value,classId,teacherId:document.getElementById('subj-teacher').value,periods:+document.getElementById('subj-periods').value||5});
    DB.set('subjects',subjs); this.toast('Subject added','success'); this.audit('Add Subject','create',`New subject: ${name}`);
    this.closeModal('m-subject'); this.renderSubjectsTable();
  },

  deleteSubject(id){ const s=DB.get('subjects',[]); DB.set('subjects',s.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'subjects',id).catch(()=>{}); this.toast('Subject removed','warn'); this.renderSubjectsTable(); },

  // ══ ATTENDANCE ══
});
