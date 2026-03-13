// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Exams & Grades — loadExams · gradeEntry · results · reportCards
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadExams(){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    ['ex-class','grade-class-sel','res-class-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join(''); });
    ['ex-subject','grade-exam-sel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML='<option value="">All Subjects</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join(''); });
    this.renderExams();
  },

  renderExams(){
    const exams=DB.get('exams',[]); const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('exams-tbody').innerHTML=exams.map(e=>{
      const cls=classes.find(c=>c.id===e.classId); const subj=subjects.find(s=>s.id===e.subjectId);
      return `<tr>
        <td style="font-weight:600">${sanitize(e.name)}</td>
        <td><span class="badge badge-info">${e.type}</span></td>
        <td>${sanitize(cls?.name||'—')}</td>
        <td>${sanitize(subj?.name||'—')}</td>
        <td>${fmtDate(e.date)}</td>
        <td style="font-weight:700">${e.maxScore}</td>
        <td>${statusBadge(e.status)}</td>
        <td><div style="display:flex;gap:.3rem">${SMS.hasRole('admin','teacher')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openExamModal('${e.id}')" style="padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete exam ${sanitize(e.name)}?',()=>SMS.deleteExam('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:''}</div></td>
      </tr>`;
    }).join('')||SMS._emptyState('exams','No Exams Created','Create your first exam to start tracking student performance.','+ Create Exam',"SMS.openExamModal()");
    // Populate grade exam selector
    const gex=document.getElementById('grade-exam-sel'); if(gex) gex.innerHTML='<option value="">— Select Exam —</option>'+exams.map(e=>`<option value="${e.id}">${sanitize(e.name)}</option>`).join('');
  },

  openExamModal(id=null){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    document.getElementById('ex-class').innerHTML='<option value="">— Select —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('ex-subject').innerHTML='<option value="">— Select —</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join('');
    ['ex-name','ex-date'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('ex-max').value='100'; document.getElementById('ex-duration').value='90'; document.getElementById('ex-type').value='midterm'; document.getElementById('ex-term').value='2'; document.getElementById('ex-class').value=''; document.getElementById('ex-subject').value='';
    if(id){
      const ex=DB.get('exams',[]).find(x=>x.id===id); if(!ex) return;
      document.getElementById('ex-name').value=ex.name; document.getElementById('ex-type').value=ex.type; document.getElementById('ex-class').value=ex.classId; document.getElementById('ex-subject').value=ex.subjectId; document.getElementById('ex-date').value=ex.date; document.getElementById('ex-max').value=ex.maxScore; document.getElementById('ex-term').value=ex.term; document.getElementById('ex-duration').value=ex.duration||90;
    }
    this.openModal('m-exam');
  },

  saveExam(){
    if(!this.hasRole('admin','teacher')){ this.toast('You do not have permission to perform this action','error'); return; }
    const name=document.getElementById('ex-name').value.trim(); const classId=document.getElementById('ex-class').value; const date=document.getElementById('ex-date').value;
    if(!name||!classId||!date){ this.toast('Fill in required fields','error'); return; }
    const exams=DB.get('exams',[]);
    exams.push({id:uid('ex'),name,type:document.getElementById('ex-type').value,classId,subjectId:document.getElementById('ex-subject').value,date,maxScore:+document.getElementById('ex-max').value||100,term:document.getElementById('ex-term').value,duration:+document.getElementById('ex-duration').value||90,status:'upcoming'});
    DB.set('exams',exams); this.audit('Create Exam','create',`New exam: ${name}`); this.toast('Exam created','success'); this.closeModal('m-exam'); this.renderExams();
  },

  deleteExam(id){ DB.set('exams',DB.get('exams',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'exams',id).catch(()=>{}); this.toast('Exam deleted','warn'); this.renderExams(); },

  loadGradeEntry(){
    const examId=document.getElementById('grade-exam-sel').value;
    const classId=document.getElementById('grade-class-sel').value;
    if(!examId){ this.toast('Select an exam first','warn'); return; }
    const exam=DB.get('exams',[]).find(e=>e.id===examId);
    const targetClass=classId||exam?.classId;
    const students=DB.get('students',[]).filter(s=>s.classId===targetClass&&s.status==='active');
    const existingGrades=DB.get('grades',[]).filter(g=>g.examId===examId);
    const list=document.getElementById('grade-entry-list');
    list.innerHTML=`<div style="margin-bottom:.75rem;font-size:.82rem;color:var(--t3)">Entering grades for: <strong>${sanitize(exam?.name||'Exam')}</strong> · Max Score: <strong>${exam?.maxScore||100}</strong></div>`+students.map(s=>{
      const existing=existingGrades.find(g=>g.studentId===s.id);
      return `<div class="grade-row">
        <div class="grade-name">${sanitize(s.fname)} ${sanitize(s.lname)} <span style="font-size:.73rem;color:var(--t4)">${s.studentId}</span></div>
        <input type="number" class="form-input grade-input" data-student="${s.id}" min="0" max="${exam?.maxScore||100}" value="${existing?.score||''}" placeholder="Score" style="width:90px"/>
        <span class="grade-badge" id="gb_${s.id}">${existing?`<span class="badge ${gradeFromScore(existing.score,exam?.maxScore||100)==='F'?'badge-danger':'badge-success'}">${gradeFromScore(existing.score,exam?.maxScore||100)}</span>`:''}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('input[data-student]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const v=+inp.value, max=exam?.maxScore||100;
        const gb=document.getElementById('gb_'+inp.dataset.student);
        if(gb&&v>=0) gb.innerHTML=`<span class="badge ${gradeFromScore(v,max)==='F'?'badge-danger':v/max>=0.8?'badge-success':'badge-warn'}">${gradeFromScore(v,max)}</span>`;
      });
    });
    document.getElementById('save-grades-btn').style.display='inline-flex';
    document.getElementById('save-grades-btn').dataset.examId=examId;
  },

  saveGrades(){
    if(!this.hasRole('admin','teacher')){ this.toast('You do not have permission to perform this action','error'); return; }
    const examId=document.getElementById('save-grades-btn').dataset.examId;
    const exam=DB.get('exams',[]).find(e=>e.id===examId);
    const inputs=document.querySelectorAll('#grade-entry-list input[data-student]');
    const grades=DB.get('grades',[]); let count=0;
    inputs.forEach(inp=>{
      const studentId=inp.dataset.student, score=+inp.value;
      if(inp.value==='') return;
      const i=grades.findIndex(g=>g.examId===examId&&g.studentId===studentId);
      if(i>-1) grades[i].score=score; else grades.push({id:uid('g'),examId,studentId,score}); count++;
    });
    DB.set('grades',grades);
    // Mark exam completed if grades saved
    const exams=DB.get('exams',[]); const ei=exams.findIndex(e=>e.id===examId); if(ei>-1){ exams[ei].status='completed'; DB.set('exams',exams); }
    this.audit('Grades Entry','edit',`Grades saved for ${exam?.name}: ${count} entries`);
    this.toast(`${count} grades saved!`,'success');
  },

  loadResults(){
    const classId=document.getElementById('res-class-sel').value;
    const term=document.getElementById('res-term-sel').value;
    const students=classId?DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active'):DB.get('students',[]).filter(s=>s.status==='active');
    const exams=DB.get('exams',[]).filter(e=>(!classId||e.classId===classId)&&(!term||e.term===term));
    const grades=DB.get('grades',[]);
    const results=students.map(s=>{
      const sGrades=grades.filter(g=>exams.some(e=>e.id===g.examId)&&g.studentId===s.id);
      const total=sGrades.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0);
      const avg=sGrades.length>0?Math.round(total/sGrades.length):0;
      return {student:s,count:sGrades.length,avg,grade:gradeFromScore(avg)};
    }).filter(r=>r.count>0).sort((a,b)=>b.avg-a.avg);
    document.getElementById('results-tbody').innerHTML=results.map((r,i)=>`<tr>
      <td style="font-weight:600">${sanitize(r.student.fname)} ${sanitize(r.student.lname)}</td>
      <td>${this.className(r.student.classId)}</td>
      <td>${r.count}</td>
      <td style="font-weight:700">${r.avg*r.count}</td>
      <td style="font-weight:700;color:var(--brand-teal)">${r.avg}%</td>
      <td><span class="badge ${r.grade==='F'?'badge-danger':r.grade==='D'||r.grade==='C'?'badge-warn':'badge-success'}">${r.grade}</span></td>
      <td style="font-weight:700;color:${i<3?'var(--warn)':'var(--t3)'}">${i===0?'1st':i===1?'2nd':i===2?'3rd':(i+1)+'th'}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="SMS.viewStudent('${r.student.id}')" style="padding:.3rem .5rem">View →</button></td>
    </tr>`).join('')||SMS._emptyState('exams','No Results Available','Create exams and enter student grades first, then view results here.','');
  },

  showReportCards(){
    const classes=DB.get('classes',[]);
    const html=`<div style="margin-bottom:1rem;font-size:.85rem;color:var(--t3)">Select a class to generate report cards:</div><div style="display:flex;gap:.75rem;flex-wrap:wrap">${classes.map(c=>`<button class="btn btn-secondary btn-sm" onclick="SMS.generateReportCard('${c.id}')">${sanitize(c.name)}</button>`).join('')}</div>`;
    document.getElementById('receipt-title').textContent='Report Cards';
    document.getElementById('receipt-body').innerHTML=html;
    this.openModal('m-receipt');
  },

  generateReportCard(classId){
    const school=DB.get('school',{});
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const grades=DB.get('grades',[]);
    const exams=DB.get('exams',[]).filter(e=>e.classId===classId);
    const cls=DB.get('classes',[]).find(c=>c.id===classId);
    const staff=DB.get('staff',[]);
    const gradeLabel=(p)=>{ if(p>=80)return{g:'A',r:'Excellent',c:'#16a34a'}; if(p>=70)return{g:'B',r:'Very Good',c:'#0d9488'}; if(p>=60)return{g:'C',r:'Good',c:'#2563eb'}; if(p>=50)return{g:'D',r:'Pass',c:'#d97706'}; return{g:'F',r:'Needs Improvement',c:'#dc2626'}; };
    const html=`<style>@media print{.no-print{display:none!important;}.report-card-page{page-break-after:always;}}</style>
    <div style="font-size:.82rem">${students.map((s,si)=>{
      const sGrades=grades.filter(g=>g.studentId===s.id&&exams.some(e=>e.id===g.examId));
      const totalPct=sGrades.length>0?sGrades.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sGrades.length:0;
      const avg=Math.round(totalPct);
      const overall=gradeLabel(avg);
      // Rank among class
      const allAvgs=students.map(st=>{ const sg=grades.filter(g=>g.studentId===st.id&&exams.some(e=>e.id===g.examId)); return sg.length>0?Math.round(sg.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sg.length):0; }).sort((a,b)=>b-a);
      const pos=allAvgs.indexOf(avg)+1;
      const posStr=pos===1?'1st':pos===2?'2nd':pos===3?'3rd':pos+'th';
      const classTeacher=staff.find(x=>x.id===cls?.teacherId);
      return `<div class="report-card-page" style="border:2px solid #1a3a6b;border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;background:white;position:relative">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:3px solid #1a3a6b">
          <div style="display:flex;align-items:center;gap:.75rem">
            <div style="width:52px;height:52px;border-radius:50%;background:#1a3a6b;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:1.1rem">${s.fname[0]}${s.lname[0]}</div>
            <div>
              <div style="font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:800;color:#1a3a6b">${school.name||'School'}</div>
              <div style="font-size:.68rem;color:#666">${school.address||''} · ${school.phone||''}</div>
              <div style="font-size:.68rem;color:#0d9488;font-style:italic">${school.motto||'Excellence in All Things'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:.2rem">STUDENT REPORT CARD</div>
            <div style="font-size:.68rem;color:#888">${school.academicYear||'2025/2026'} · Term ${school.currentTerm||'2'}</div>
            <div style="font-size:.68rem;color:#888">Issued: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
          </div>
        </div>
        <!-- Student Info Band -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;background:#f0f4f8;border-radius:8px;padding:.65rem .75rem;margin-bottom:.85rem">
          <div><div style="font-size:.6rem;color:#888;font-weight:700">STUDENT NAME</div><div style="font-weight:700;font-size:.82rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">STUDENT ID</div><div style="font-weight:700;font-size:.82rem">${s.studentId}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">CLASS</div><div style="font-weight:700;font-size:.82rem">${cls?.name||'—'}</div></div>
          <div><div style="font-size:.6rem;color:#888;font-weight:700">POSITION</div><div style="font-weight:700;font-size:.82rem;color:#1a3a6b">${posStr} of ${students.length}</div></div>
        </div>
        <!-- Grades Table -->
        <table style="width:100%;border-collapse:collapse;font-size:.77rem;margin-bottom:.85rem">
          <thead>
            <tr style="background:#1a3a6b;color:white">
              <th style="padding:.45rem .6rem;text-align:left;border:1px solid #1a3a6b">Subject / Exam</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Score</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Max</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">%</th>
              <th style="padding:.45rem .6rem;text-align:center;border:1px solid #1a3a6b">Grade</th>
              <th style="padding:.45rem .6rem;text-align:left;border:1px solid #1a3a6b">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${sGrades.map((g,gi)=>{ const ex=exams.find(e=>e.id===g.examId); const pct=Math.round(g.score/(ex?.maxScore||100)*100); const gl=gradeLabel(pct); return `<tr style="background:${gi%2===0?'#fafafa':'white'};border-bottom:1px solid #e5e7eb"><td style="padding:.38rem .6rem;border:1px solid #e5e7eb">${ex?.name||'—'}</td><td style="padding:.38rem .6rem;text-align:center;font-weight:700;border:1px solid #e5e7eb">${g.score}</td><td style="padding:.38rem .6rem;text-align:center;border:1px solid #e5e7eb">${ex?.maxScore||100}</td><td style="padding:.38rem .6rem;text-align:center;font-weight:700;border:1px solid #e5e7eb">${pct}%</td><td style="padding:.38rem .6rem;text-align:center;border:1px solid #e5e7eb"><span style="background:${gl.c}20;color:${gl.c};font-weight:700;padding:.15rem .4rem;border-radius:4px;font-size:.72rem">${gl.g}</span></td><td style="padding:.38rem .6rem;color:${gl.c};font-weight:600;border:1px solid #e5e7eb">${gl.r}</td></tr>`; }).join('')}
            <tr style="background:#1a3a6b20;font-weight:800">
              <td style="padding:.5rem .6rem;border:1px solid #ccc">OVERALL AVERAGE</td>
              <td colspan="2" style="border:1px solid #ccc"></td>
              <td style="padding:.5rem .6rem;text-align:center;color:#1a3a6b;font-size:.92rem;border:1px solid #ccc">${avg}%</td>
              <td style="padding:.5rem .6rem;text-align:center;border:1px solid #ccc"><span style="background:${overall.c}20;color:${overall.c};font-weight:800;padding:.2rem .5rem;border-radius:4px">${overall.g}</span></td>
              <td style="padding:.5rem .6rem;color:${overall.c};border:1px solid #ccc">${overall.r}</td>
            </tr>
          </tbody>
        </table>
        <!-- Comments & Signatures -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:.3rem">Class Teacher's Comment</div>
            <div style="border:1px solid #ddd;border-radius:6px;padding:.5rem;min-height:48px;font-size:.75rem;color:#555;background:#fafafa">${avg>=80?'Outstanding performance! Keep it up.':avg>=70?'Very commendable effort. Strive for more.':avg>=60?'Good work. With more effort you can do better.':avg>=50?'Satisfactory. Please put in more effort next term.':'Needs significant improvement. Let us work together.'}</div>
          </div>
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:.3rem">Head Teacher's Comment</div>
            <div style="border:1px solid #ddd;border-radius:6px;padding:.5rem;min-height:48px;background:#fafafa"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-top:.5rem">
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Class Teacher: ${classTeacher?.fname||'—'} ${classTeacher?.lname||''}</div></div>
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Head Teacher's Signature</div></div>
          <div style="text-align:center"><div style="border-top:1px solid #999;padding-top:.3rem;font-size:.68rem;color:#888">Parent/Guardian's Signature</div></div>
        </div>
        <!-- Footer -->
        <div style="text-align:center;font-size:.62rem;color:#aaa;padding-top:.5rem;margin-top:.5rem;border-top:1px solid #eee">Generated by Eduformium School Management System · ${new Date().toLocaleDateString()}</div>
      </div>`;
    }).join('')}</div>`;
    document.getElementById('receipt-body').innerHTML=html;
    document.getElementById('receipt-title').textContent=`Report Cards — ${cls?.name} (${students.length} students)`;
    this.openModal('m-receipt');
  },

  // ══ TIMETABLE ══
});
