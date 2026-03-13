// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Audit & Reports — openReport · renderAudit · exportAudit
// ══════════════════════════════════════════

Object.assign(SMS, {
  openReport(type){
    const output=document.getElementById('report-output'); output.style.display='block';
    const title=document.getElementById('report-output-title');
    const content=document.getElementById('report-output-content');
    const students=DB.get('students',[]); const staff=DB.get('staff',[]); const payments=DB.get('feePayments',[]); const expenses=DB.get('expenses',[]);
    if(type==='academic'){
      title.textContent='Academic Performance Report';
      const grades=DB.get('grades',[]); const exams=DB.get('exams',[]);
      const byStudent=students.map(s=>{ const sg=grades.filter(g=>g.studentId===s.id); const avg=sg.length>0?Math.round(sg.reduce((sum,g)=>{ const ex=exams.find(e=>e.id===g.examId); return sum+(g.score/(ex?.maxScore||100)*100); },0)/sg.length):null; return {...s,avg,gradeCount:sg.length}; }).filter(s=>s.avg!==null).sort((a,b)=>b.avg-a.avg).slice(0,10);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>Average</th><th>Grade</th></tr></thead><tbody>${byStudent.map((s,i)=>`<tr><td style="font-weight:800;color:${i<3?'var(--warn)':'var(--t3)'}">${i+1}</td><td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td><td>${this.className(s.classId)}</td><td style="font-weight:700;color:var(--brand-teal)">${s.avg}%</td><td><span class="badge ${gradeFromScore(s.avg)==='F'?'badge-danger':'badge-success'}">${gradeFromScore(s.avg)}</span></td></tr>`).join('')}</tbody></table>`;
    } else if(type==='finance'){
      title.textContent='Financial Report';
      const totalFees=payments.reduce((s,p)=>s+(+p.amount||0),0); const totalExp=expenses.reduce((s,e)=>s+(+e.amount||0),0);
      const feeStructure=DB.get('feeStructure',[]);
      let totalOutstanding=0; students.filter(s=>s.status==='active').forEach(s=>{ const fs=feeStructure.find(f=>f.classId===s.classId); if(!fs) return; totalOutstanding+=Math.max(0,+(fs.term1||0)-(+(s.feesPaid?.term1||0)))+Math.max(0,+(fs.term2||0)-(+(s.feesPaid?.term2||0)))+Math.max(0,+(fs.term3||0)-(+(s.feesPaid?.term3||0))); });
      content.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1rem;margin-bottom:1.25rem">
        <div class="kpi-card"><div class="kpi-icon teal">${SMS._kpiSvg('fees')}</div><div class="kpi-val">${fmt(totalFees)}</div><div class="kpi-label">Total Fee Revenue</div></div>
        <div class="kpi-card"><div class="kpi-icon red">${SMS._kpiSvg('expenses')}</div><div class="kpi-val">${fmt(totalExp)}</div><div class="kpi-label">Total Expenses</div></div>
                <div class="kpi-card"><div class="kpi-icon amber">${SMS._kpiSvg('warning')}</div><div class="kpi-val" style="color:var(--danger)">${fmt(totalOutstanding)}</div><div class="kpi-label">Outstanding Balance</div></div>
<div class="kpi-card"><div class="kpi-icon ${totalFees-totalExp>0?'green':'amber'}">${SMS._kpiSvg('trending')}</div><div class="kpi-val" style="color:${totalFees-totalExp>0?'var(--success)':'var(--danger)'}">${fmt(totalFees-totalExp)}</div><div class="kpi-label">Net Balance</div></div>
      </div>`;
    } else if(type==='enrollment'){
      title.textContent='Enrollment Report';
      const classes=DB.get('classes',[]);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Class</th><th>Level</th><th>Enrolled</th><th>Male</th><th>Female</th><th>Capacity</th><th>Fill Rate</th></tr></thead><tbody>${classes.map(c=>{ const cl=students.filter(s=>s.classId===c.id); const m=cl.filter(s=>s.gender==='Male').length, f=cl.filter(s=>s.gender==='Female').length, rate=Math.round(cl.length/c.capacity*100); return `<tr><td style="font-weight:600">${sanitize(c.name)}</td><td>${c.level||'—'}</td><td style="font-weight:700;color:var(--brand)">${cl.length}</td><td>${m}</td><td>${f}</td><td>${c.capacity}</td><td><span class="badge ${rate>90?'badge-danger':rate>70?'badge-warn':'badge-success'}">${rate}%</span></td></tr>`; }).join('')}</tbody></table>`;
    } else if(type==='attendance'){
      title.textContent='Attendance Report';
      const att=DB.get('attendance',[]);
      content.innerHTML=`<table class="tbl"><thead><tr><th>Date</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr></thead><tbody>${att.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(a=>`<tr><td>${fmtDate(a.date)}</td><td>${sanitize(this.className(a.classId))}</td><td style="color:var(--success);font-weight:700">${a.present}</td><td style="color:var(--danger);font-weight:700">${a.absent}</td><td style="color:var(--warn);font-weight:700">${a.late}</td><td><span class="badge ${a.present/a.total>=0.9?'badge-success':'badge-warn'}">${Math.round(a.present/a.total*100)||0}%</span></td></tr>`).join('')}</tbody></table>`;
    } else {
      title.textContent=type.charAt(0).toUpperCase()+type.slice(1)+' Report';
      content.innerHTML=`<div style="padding:2rem;text-align:center;color:var(--t4);font-size:.85rem">Detailed ${type} report coming soon. Use Excel export for full data.</div>`;
    }
    output.scrollIntoView({behavior:'smooth'});
  },

  // ══ AUDIT ══
  renderAudit(){
    const log=DB.get('auditLog',[]); const q=(document.getElementById('audit-q')?.value||'').toLowerCase(); const tf=document.getElementById('audit-type')?.value||'';
    let filtered=log.filter(l=>{ if(tf&&l.type!==tf) return false; if(q&&!`${sanitize(l.action)} ${l.details} ${l.user}`.toLowerCase().includes(q)) return false; return true; }).sort((a,b)=>b.time.localeCompare(a.time));
    const perPage=20, total=filtered.length, pages=Math.ceil(total/perPage);
    this._auditPage=Math.min(this._auditPage,pages||1);
    const slice=filtered.slice((this._auditPage-1)*perPage,this._auditPage*perPage);
    const colors={login:'var(--brand)',create:'var(--success)',edit:'var(--warn)',delete:'var(--danger)',settings:'var(--info)'};
    const emojis={login:'',create:'',edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',delete:'',settings:''};
    document.getElementById('audit-list').innerHTML=slice.map(l=>`
      <div class="audit-item">
        <div class="audit-icon" style="background:${colors[l.type]||'var(--surface-3)'}20;color:${colors[l.type]||'var(--t3)'}">${emojis[l.type]||''}</div>
        <div class="audit-text">
          <div class="audit-action">${sanitize(l.action)} <span style="font-weight:400;color:var(--t3)">by</span> ${sanitize(l.user)}</div>
          <div style="font-size:.78rem;color:var(--t2);margin:.15rem 0">${sanitize(l.details)}</div>
          <div class="audit-time">${new Date(l.time).toLocaleString()}</div>
        </div>
        <span class="badge badge-neutral" style="font-size:.65rem;flex-shrink:0">${l.type}</span>
      </div>`).join('')||'<div style="padding:3rem;text-align:center;color:var(--t4)">No audit entries found</div>';
    let pager=`<span class="pager-info">Showing ${Math.min(total,perPage*(this._auditPage-1)+1)}–${Math.min(total,perPage*this._auditPage)} of ${total}</span>`;
    for(let i=1;i<=pages;i++) pager+=`<button class="pager-btn ${i===this._auditPage?'active':''}" onclick="SMS._auditPage=${i};SMS.renderAudit()">${i}</button>`;
    document.getElementById('audit-pager').innerHTML=pager;
  },

  exportAudit(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const log=DB.get('auditLog',[]); const data=log.map(l=>({Action:l.action,Type:l.type,User:l.user,Details:l.details,Time:l.time}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Audit Log');
    XLSX.writeFile(wb,`AuditLog_${new Date().toISOString().split('T')[0]}.xlsx`); this.toast('Audit log exported','success');
  },

  // ══ SETTINGS ══
});
