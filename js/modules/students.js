// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Students — loadStudents · renderStudents · save · delete · export · promote
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadStudents(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('s-class-f'); if(sel){ sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join(''); }
    this.renderStudentStats();
    this.renderStudents();
    // Populate student dropdown in fee modal
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
  },

  renderStudentStats(){
    const students=DB.get('students',[]);
    const stats=[
      {val:students.length,lbl:'Total Enrolled'},{val:students.filter(s=>s.status==='active').length,lbl:'Active'},
      {val:students.filter(s=>s.gender==='Male').length,lbl:'Male'},{val:students.filter(s=>s.gender==='Female').length,lbl:'Female'},
      {val:students.filter(s=>s.status==='graduated').length,lbl:'Graduated'},
    ];
    document.getElementById('student-stats').innerHTML=stats.map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderStudents(){
    const students=DB.get('students',[]);
    const q=(document.getElementById('s-search')?.value||'').toLowerCase();
    const cf=document.getElementById('s-class-f')?.value||'';
    const sf=document.getElementById('s-status-f')?.value||'';
    const gf=document.getElementById('s-gender-f')?.value||'';
    let filtered=students.filter(s=>{
      if(cf&&s.classId!==cf) return false;
      if(sf&&s.status!==sf) return false;
      if(gf&&s.gender!==gf) return false;
      if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.studentId} ${s.dadPhone||''} ${s.momPhone||''} ${s.momName||''} ${s.roll||''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const perPage=15, total=filtered.length, pages=Math.ceil(total/perPage);
    this._studPage=Math.min(this._studPage,pages||1);
    const slice=filtered.slice((this._studPage-1)*perPage,this._studPage*perPage);
    const tbody=document.getElementById('students-tbody');
    if(!tbody) return;
    const feeStructure=DB.get('feeStructure',[]);
    tbody.innerHTML=slice.map(s=>{
      const _sfs=getYearStructure(s.classId,_academicYear);
      const owed=this._studentOwed(s,_academicYear);
      const noStructure=!_sfs||(+((_sfs.term1)||0)===0&&+((_sfs.term2)||0)===0&&+((_sfs.term3)||0)===0);
      const feeStatus=noStructure?`<span style="color:var(--t4);font-size:.76rem;font-weight:600">—</span>`:owed>0?`<span style="color:var(--danger);font-size:.76rem;font-weight:600">Owes ${fmt(owed)}</span>`:`<span style="color:var(--success);font-size:.76rem;font-weight:600">Paid</span>`;
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.studentId}</td>
        <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600;color:var(--t1)">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${fmtDate(s.dob)}</div></div></div></td>
        <td>${this.className(s.classId)}</td>
        <td>${s.gender}</td>
        <td><div style="font-size:.8rem;font-weight:600">${s.dadName||'—'}</div><div style="font-size:.73rem;color:var(--t4)">${s.momName||''}</div></td>
        <td style="font-size:.8rem">${s.dadPhone||s.momPhone||'—'}</td>
        <td>${feeStatus}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${s.id}')" style="padding:.3rem .5rem" title="View Profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            ${SMS.hasRole('admin')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openStudentModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete student ${sanitize(s.fname)} ${sanitize(s.lname)}?',()=>SMS.deleteStudent('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:``}
          </div>
        </td>
      </tr>`;
    }).join('') || SMS._emptyState('students','No Students Found','Try adjusting your filters, or enroll your first student using the button above.','+ Enrol Student',"SMS.openStudentModal()");
    // Pager
    let pager=`<span class="pager-info">Showing ${Math.min(filtered.length,perPage*(this._studPage-1)+1)}–${Math.min(filtered.length,perPage*this._studPage)} of ${total}</span>`;
    for(let i=1;i<=pages;i++) pager+=`<button class="pager-btn ${i===this._studPage?'active':''}" onclick="SMS._studPage=${i};SMS.renderStudents()">${i}</button>`;
    document.getElementById('students-pager').innerHTML=pager;
  },

  viewStudent(id){
    const s=DB.get('students',[]).find(x=>x.id===id); if(!s) return;
    document.getElementById('sp-modal-title').textContent=`${sanitize(s.fname)} ${sanitize(s.lname)}`;
    const payments=DB.get('feePayments',[]).filter(p=>p.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));
    const grades=DB.get('grades',[]).filter(g=>g.studentId===id);
    const exams=DB.get('exams',[]);
    const feeStructure=DB.get('feeStructure',[]);
    const fs=getYearStructure(s.classId,_academicYear);
    const ft1=+(fs?.term1||0),ft2=+(fs?.term2||0),ft3=+(fs?.term3||0);
    const _spyf=getYearFees(s,_academicYear); const fp1=+(_spyf.term1||0),fp2=+(_spyf.term2||0),fp3=+(_spyf.term3||0);
    const fb1=Math.max(0,ft1-fp1),fb2=Math.max(0,ft2-fp2),fb3=Math.max(0,ft3-fp3);
    const totalDue=ft1+ft2+ft3, totalPaid=fp1+fp2+fp3, totalOwed=fb1+fb2+fb3;
    const noFeeStruct=!fs||(ft1===0&&ft2===0&&ft3===0);
    const feeSummaryHtml=noFeeStruct
      ? `<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0;font-style:italic">No fee structure set for this student's class. Go to Fees → Fee Structure to configure.</div>`
      : `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:.75rem">
        ${[['Term 1',ft1,fp1,fb1],['Term 2',ft2,fp2,fb2],['Term 3',ft3,fp3,fb3]].map(([lbl,due,paid,bal])=>`
        <div style="background:var(--bg2);border-radius:.6rem;padding:.6rem .75rem;border:1px solid var(--border)">
          <div style="font-size:.72rem;color:var(--t4);font-weight:600;margin-bottom:.3rem">${lbl}</div>
          <div style="font-size:.78rem;color:var(--t3)">Due: <span style="color:var(--t1);font-weight:600">${fmt(due)}</span></div>
          <div style="font-size:.78rem;color:var(--t3)">Paid: <span style="color:var(--success);font-weight:600">${fmt(paid)}</span></div>
          <div style="font-size:.78rem;font-weight:700;margin-top:.2rem;color:${bal>0?'var(--danger)':'var(--success)'}">
            ${bal>0?'Owes '+fmt(bal):'Cleared'}
          </div>
        </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:${totalOwed>0?'rgba(239,68,68,.07)':'rgba(34,197,94,.07)'};border:1px solid ${totalOwed>0?'rgba(239,68,68,.2)':'rgba(34,197,94,.2)'};border-radius:.6rem;padding:.6rem .85rem;margin-bottom:.75rem">
        <div style="font-size:.82rem;color:var(--t2)">Total: <strong>${fmt(totalPaid)}</strong> paid of <strong>${fmt(totalDue)}</strong></div>
        ${totalOwed>0?`<span style="font-size:.82rem;font-weight:700;color:var(--danger)">Balance: ${fmt(totalOwed)}</span><button class="btn btn-sm" style="background:#1d4ed8;color:#fff;padding:.35rem .9rem;font-size:.8rem;font-weight:700;border:2px solid #1e40af;border-radius:.45rem;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.18)" onclick="SMS.closeModal('m-student-profile');SMS.nav('fees');SMS.openFeeModal('${s.id}')">Pay Now</button>`:`<span style="font-size:.82rem;font-weight:700;color:var(--success)">Fully Paid</span>`}
      </div>`;
    document.getElementById('student-profile-body').innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:1.25rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <div class="profile-av-lg">${s.fname[0]}${s.lname[0]}</div>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:var(--t1);margin-bottom:.2rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div style="font-size:.82rem;color:var(--t3);margin-bottom:.75rem">${s.studentId} · ${this.className(s.classId)} · ${s.gender}</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">${statusBadge(s.status)}<span class="badge badge-info">${this.className(s.classId)}</span></div>
        </div>
      </div>
      <div class="profile-section-title">Personal Information</div>
      <div class="profile-info-grid">
        <div class="pinfo-item"><div class="pinfo-label">Date of Birth</div><div class="pinfo-val">${fmtDate(s.dob)}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Gender</div><div class="pinfo-val">${s.gender}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Admission Date</div><div class="pinfo-val">${fmtDate(s.admitDate)}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Address</div><div class="pinfo-val">${s.address||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Nationality</div><div class="pinfo-val">${s.nationality||'Ghanaian'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Religion</div><div class="pinfo-val">${s.religion||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Blood Group</div><div class="pinfo-val">${s.blood||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Previous School</div><div class="pinfo-val">${s.prevSchool||'—'}</div></div>
      </div>
      <div class="profile-section-title">Parent / Guardian</div>
      <div class="profile-info-grid">
        <div class="pinfo-item"><div class="pinfo-label">Father/Guardian</div><div class="pinfo-val">${s.dadName||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Phone</div><div class="pinfo-val">${s.dadPhone||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Email</div><div class="pinfo-val">${s.dadEmail||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Mother</div><div class="pinfo-val">${s.momName||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Mother Phone</div><div class="pinfo-val">${s.momPhone||'—'}</div></div>
        <div class="pinfo-item"><div class="pinfo-label">Emergency</div><div class="pinfo-val">${s.emerName||'—'} ${s.emerPhone?'· '+s.emerPhone:''}</div></div>
      </div>
      <div class="profile-section-title">Fee Summary</div>
      ${feeSummaryHtml}
      <div class="profile-section-title">Payment History (${payments.length} records)</div>
      ${payments.length>0?`<table class="tbl"><thead><tr><th>Receipt</th><th>Term</th><th>Amount</th><th>Method</th><th>Date</th><th>Ref</th></tr></thead><tbody>${payments.map(p=>`<tr><td style="font-family:monospace;font-size:.75rem">${p.receiptNo||'—'}</td><td>Term ${p.term}</td><td style="font-weight:700;color:var(--success)">${fmt(p.amount)}</td><td>${p.method}</td><td>${fmtDate(p.date)}</td><td style="font-size:.75rem;color:var(--t4)">${p.ref||'—'}</td></tr>`).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No payment records yet.</div>'}
      <div class="profile-section-title">Academic Results (${grades.length} entries)</div>
      ${grades.length>0?`<table class="tbl"><thead><tr><th>Exam</th><th>Score</th><th>Max</th><th>Grade</th></tr></thead><tbody>${grades.map(g=>{ const ex=exams.find(e=>e.id===g.examId); return `<tr><td>${ex?.name||'—'}</td><td style="font-weight:700">${g.score}</td><td>${ex?.maxScore||100}</td><td><span class="badge ${gradeFromScore(g.score,ex?.maxScore||100)==='F'?'badge-danger':gradeFromScore(g.score,ex?.maxScore||100)<='C'?'badge-warn':'badge-success'}">${gradeFromScore(g.score,ex?.maxScore||100)}</span></td></tr>`; }).join('')}</tbody></table>`:'<div style="color:var(--t4);font-size:.82rem;padding:.5rem 0">No grades recorded</div>'}
    `;
    this.openModal('m-student-profile');
  },

  openStudentModal(id=null){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('sf-class'); if(sel) sel.innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('sf-err').style.display='none';
    // Reset all fields
    ['sf-id','sf-fname','sf-mname','sf-lname','sf-dob','sf-address','sf-sid','sf-roll','sf-prev-school','sf-notes','sf-dad','sf-dad-phone','sf-dad-email','sf-dad-job','sf-mom','sf-mom-phone','sf-mom-job','sf-emer','sf-emer-phone','sf-emer-rel','sf-allergies','sf-medical','sf-doctor','sf-doc-phone'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('sf-gender').value='';
    document.getElementById('sf-blood').value='';
    document.getElementById('sf-transport').value='none';
    document.getElementById('sf-status').value='active';
    document.getElementById('sf-admit-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('student-modal-title').textContent='Enroll New Student';
    document.getElementById('save-student-btn').textContent='Enroll Student';
    if(id){
      const s=DB.get('students',[]).find(x=>x.id===id); if(!s) return;
      document.getElementById('sf-id').value=s.id;
      document.getElementById('sf-fname').value=s.fname||'';
      document.getElementById('sf-mname').value=s.mname||'';
      document.getElementById('sf-lname').value=s.lname||'';
      document.getElementById('sf-dob').value=s.dob||'';
      document.getElementById('sf-gender').value=s.gender||'';
      document.getElementById('sf-blood').value=s.blood||'';
      document.getElementById('sf-admit-date').value=s.admitDate||'';
      document.getElementById('sf-address').value=s.address||'';
      document.getElementById('sf-class').value=s.classId||'';
      document.getElementById('sf-sid').value=s.studentId||'';
      document.getElementById('sf-roll').value=s.roll||'';
      document.getElementById('sf-status').value=s.status||'active';
      document.getElementById('sf-transport').value=s.transport||'none';
      document.getElementById('sf-notes').value=s.notes||'';
      document.getElementById('sf-prev-school').value=s.prevSchool||'';
      if(document.getElementById('sf-nation')) document.getElementById('sf-nation').value=s.nationality||'';
      if(document.getElementById('sf-religion')) document.getElementById('sf-religion').value=s.religion||'';
      document.getElementById('sf-dad').value=s.dadName||'';
      document.getElementById('sf-dad-phone').value=s.dadPhone||'';
      document.getElementById('sf-dad-email').value=s.dadEmail||'';
      document.getElementById('sf-dad-job').value=s.dadJob||'';
      document.getElementById('sf-mom').value=s.momName||'';
      document.getElementById('sf-mom-phone').value=s.momPhone||'';
      document.getElementById('sf-mom-job').value=s.momJob||'';
      document.getElementById('sf-emer').value=s.emerName||'';
      document.getElementById('sf-emer-phone').value=s.emerPhone||'';
      document.getElementById('sf-emer-rel').value=s.emerRel||'';
      document.getElementById('sf-allergies').value=s.allergies||'';
      document.getElementById('sf-medical').value=s.medical||'';
      document.getElementById('sf-doctor').value=s.doctorName||'';
      document.getElementById('sf-doc-phone').value=s.docPhone||'';
      document.getElementById('student-modal-title').textContent='Edit Student';
      document.getElementById('save-student-btn').textContent='Save Changes';
    }
    // Reset modal tabs
    document.querySelectorAll('.modal-tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
    document.getElementById('basic')?.classList.add('active');
    document.querySelector('.mtab[data-mtab="basic"]')?.classList.add('active');
    this.openModal('m-student');
  },

  saveStudent(){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; }
    const fname=document.getElementById('sf-fname').value.trim();
    const lname=document.getElementById('sf-lname').value.trim();
    const classId=document.getElementById('sf-class').value;
    const gender=document.getElementById('sf-gender').value;
    const dob=document.getElementById('sf-dob').value;
    const admitDate=document.getElementById('sf-admit-date').value;
    const errEl=document.getElementById('sf-err');
    // Inline field highlighting
    const fields=[['sf-fname',fname],['sf-lname',lname],['sf-class',classId],['sf-gender',gender],['sf-admit-date',admitDate]];
    let hasError=false;
    fields.forEach(([id,val])=>{ const el=document.getElementById(id); if(el){ el.style.borderColor=val?'':'var(--danger)'; if(!val) hasError=true; } });
    if(hasError){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields (marked in red).'; return; }
    errEl.style.display='none';
    // Reset field borders
    fields.forEach(([id])=>{ const el=document.getElementById(id); if(el) el.style.borderColor=''; });
    const students=DB.get('students',[]);
    const existingId=document.getElementById('sf-id').value;
    const _maxId=students.reduce((mx,st)=>{ const n=parseInt((st.studentId||'').split('-').pop()||0); return n>mx?n:mx; },100);
    const sid=document.getElementById('sf-sid').value.trim()||`BFA-${new Date().getFullYear()}-`+String(_maxId+1).padStart(4,'0');
    const data={fname,mname:document.getElementById('sf-mname').value.trim(),lname,classId,gender,dob,admitDate,blood:document.getElementById('sf-blood').value,address:document.getElementById('sf-address').value,nationality:document.getElementById('sf-nation')?.value||'',religion:document.getElementById('sf-religion')?.value||'',studentId:sid,roll:document.getElementById('sf-roll').value,status:document.getElementById('sf-status').value,transport:document.getElementById('sf-transport').value,notes:document.getElementById('sf-notes').value,dadName:document.getElementById('sf-dad').value,dadPhone:document.getElementById('sf-dad-phone').value,dadEmail:document.getElementById('sf-dad-email').value,dadJob:document.getElementById('sf-dad-job').value,momName:document.getElementById('sf-mom').value,momPhone:document.getElementById('sf-mom-phone').value,momJob:document.getElementById('sf-mom-job').value,emerName:document.getElementById('sf-emer').value,emerPhone:document.getElementById('sf-emer-phone').value,emerRel:document.getElementById('sf-emer-rel').value,allergies:document.getElementById('sf-allergies').value,medical:document.getElementById('sf-medical').value,doctorName:document.getElementById('sf-doctor').value,docPhone:document.getElementById('sf-doc-phone').value,
      // enrollTerm: derived from admitDate vs term date ranges of current academic year.
      // Fees are only due from this term onwards — never back-charged for terms before enrolment.
      enrollTerm: getEnrollTermFromDate(admitDate, _academicYear),
      feesPaid:{[_academicYear]:{term1:0,term2:0,term3:0}}};
    if(existingId){
      const i=students.findIndex(s=>s.id===existingId);
      if(i>-1){ const old=students[i]; students[i]={...old,...data,id:existingId,studentId:old.studentId,feesPaid:old.feesPaid}; DB.set('students',students); this.audit('Edit Student','edit',`Updated student: ${fname} ${lname}`); this.toast('Student updated','success'); }
    } else {
      const newS={id:uid('stu'),...data,studentId:sid}; students.push(newS); DB.set('students',students);
      this.audit('Enroll Student','create',`New student enrolled: ${fname} ${lname} (${this.className(classId)})`);
      this.toast(`${fname} ${lname} enrolled successfully!`,'success');
    }
    this.closeModal('m-student'); this.renderStudents(); this.renderStudentStats();
    // Keep fee modal student dropdown in sync
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
  },

  deleteStudent(id){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; }
    const students=DB.get('students',[]);
    const s=students.find(x=>x.id===id);
    DB.set('students',students.filter(x=>x.id!==id));
    // Explicitly delete from Firestore so it doesn't return on refresh
    const sid=window.SMS&&window.SMS.schoolId;
    if(sid&&window.FDB) FDB.delete(sid,'students',id).catch(()=>{});
    // Also remove orphan fee payment records for this student
    const orphanPayments=DB.get('feePayments',[]).filter(p=>p.studentId===id);
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>p.studentId!==id));
    if(sid&&window.FDB) orphanPayments.forEach(p=>FDB.delete(sid,'feePayments',p.id).catch(()=>{}));
    this.audit('Delete Student','delete',`Removed student: ${s?.fname} ${s?.lname}`);
    this.toast('Student removed','warn'); this.renderStudents(); this.renderStudentStats(); this.renderFeesKpis(); this.renderDefaulters();
    const fstu=document.getElementById('fee-student'); if(fstu){ const sts=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+sts.map(st=>`<option value="${st.id}">${sanitize(st.fname)} ${sanitize(st.lname)} (${this.className(st.classId)})</option>`).join(''); }
  },

  exportStudents(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const students=DB.get('students',[]);
    const data=students.map(s=>({'Student ID':s.studentId,'First Name':s.fname,'Middle Name':s.mname||'','Last Name':s.lname,'Class':this.className(s.classId),'Gender':s.gender,'DOB':s.dob,'Address':s.address||'','Blood Group':s.blood||'','Nationality':s.nationality||'','Roll No':s.roll||'','Status':s.status,'Transport':s.transport||'none','Admission Date':s.admitDate,'Father/Guardian':s.dadName||'','Father Phone':s.dadPhone||'','Father Email':s.dadEmail||'','Mother':s.momName||'','Mother Phone':s.momPhone||'','Emergency Contact':s.emerName||'','Emergency Phone':s.emerPhone||'','Notes':s.notes||''}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,`Students_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Students exported','success');
  },

  // ══ STAFF ══
});
