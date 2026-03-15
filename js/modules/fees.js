// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Fees — loadFees · renderFees · payments · structure · defaulters · receipt
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadFees(){
    const classes=DB.get('classes',[]);
    const sel=document.getElementById('fee-class-f'); if(sel) sel.innerHTML='<option value="">All Classes</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const fstu=document.getElementById('fee-student'); if(fstu){ const students=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
    // Populate year filter
    const yearSel=document.getElementById('fee-year-f');
    if(yearSel){
      const years=getAllAcademicYears();
      yearSel.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join('');
    }
    // Populate fee modal year dropdown
    const fmYear=document.getElementById('fee-academic-year');
    if(fmYear){
      const years=getAllAcademicYears();
      fmYear.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join('');
    }
    this.renderFeesKpis(); this.renderFees(); this.renderFeeStructure(); this.renderDefaulters();
  },

  renderFeesKpis(){
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const payments=DB.get('feePayments',[]).filter(p=>!p.academicYear||p.academicYear===yearFilter);
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    // Total collected for the selected year
    const totalCollected=payments.reduce((s,p)=>s+(+p.amount||0),0);
    // Term X collected = only payments recorded against current term
    const termCollected=payments.filter(p=>String(p.term)===String(_currentTerm)).reduce((s,p)=>s+(+p.amount||0),0);
    // Term Outstanding = current term only (matches dashboard hero exactly)
    let termOutstanding=0, defaulterCount=0;
    // Full Year Outstanding = all 3 terms
    let totalYearOutstanding=0;
    students.forEach(s=>{
      const fs=getYearStructure(s.classId,yearFilter);
      if(!fs) return;
      const yf=getYearFees(s,yearFilter);
      // Current term only
      const termOwed=Math.max(0,(+(fs['term'+_currentTerm]||0))-(+(yf['term'+_currentTerm]||0)));
      if(termOwed>0){ termOutstanding+=termOwed; defaulterCount++; }
      // All 3 terms from enrollTerm
      const enrollTerm=Math.min(3,Math.max(1,+(s.enrollTerm||1)));
      for(let t=enrollTerm;t<=3;t++){
        totalYearOutstanding+=Math.max(0,(+(fs['term'+t]||0))-(+(yf['term'+t]||0)));
      }
    });
    document.getElementById('fees-kpis').innerHTML=[
      {icon:'fees',val:fmt(totalCollected),lbl:`Total Collected (${yearFilter})`,color:'teal'},
      {icon:'fees',val:fmt(termCollected),lbl:`Term ${_currentTerm} Collected`,color:'teal'},
      {icon:'transactions',val:payments.length,lbl:'Transactions',color:'blue'},
      {icon:'warning',val:defaulterCount,lbl:'Defaulters',color:'amber'},
      {icon:'outstanding',val:fmt(termOutstanding),lbl:`Term ${_currentTerm} Outstanding`,color:'red'},
      {icon:'warning',val:fmt(totalYearOutstanding),lbl:'Full Year Outstanding',color:'red'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val" style="font-size:${k.val.toString().length>9?'1.1rem':'1.5rem'}">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
  },

  renderFees(){
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const feeStructure=DB.get('feeStructure',[]);
    const q=(document.getElementById('fee-search')?.value||'').toLowerCase();
    const cf=document.getElementById('fee-class-f')?.value||'';
    const tf=document.getElementById('fee-term-f')?.value||'';
    const yf=document.getElementById('fee-year-f')?.value||_academicYear;
    let filtered=payments.filter(p=>{
      const s=students.find(x=>x.id===p.studentId);
      if(!s) return false; if(cf&&s.classId!==cf) return false; if(tf&&p.term!==tf) return false;
      if(yf&&p.academicYear&&p.academicYear!==yf) return false;
      if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${p.receiptNo||''}`.toLowerCase().includes(q)) return false; return true;
    }).sort((a,b)=>b.date.localeCompare(a.date));
    document.getElementById('fees-tbody').innerHTML=filtered.map(p=>{
      const s=students.find(x=>x.id===p.studentId);
      // Work out if this term is fully paid for the student
      const pYear=p.academicYear||_academicYear;
      const fs=s?getYearStructure(s.classId,pYear):null;
      const sfyf=s?getYearFees(s,pYear):{term1:0,term2:0,term3:0};
      const termDue=fs?+(fs['term'+p.term]||0):0;
      const termPaid=+(sfyf['term'+p.term]||0);
      const termOwed=Math.max(0,termDue-termPaid);
      const termStatus=termDue===0
        ? `<span class="badge badge-neutral">No structure</span>`
        : termOwed===0
          ? `<span class="badge badge-success">Term ${p.term} Fully Paid</span>`
          : `<span class="badge badge-warn">Balance: ${fmt(termOwed)}</span>`;
      const t1=+(fs?.term1||0),t2=+(fs?.term2||0),t3=+(fs?.term3||0);
      const totalOwed=s&&fs?this._studentOwed(s,pYear):0;
      return `<tr>
        <td style="font-family:monospace;font-size:.75rem;color:var(--t3);white-space:nowrap">${p.receiptNo||'—'}</td>
        <td><div style="font-weight:600;color:var(--t1);white-space:nowrap">${s?sanitize(s.fname)+' '+sanitize(s.lname):'Unknown'}</div><div style="font-size:.72rem;color:var(--t4)">${this.className(s?.classId)}</div></td>
        <td style="white-space:nowrap;text-align:center"><span class="badge badge-info">Term ${p.term}</span></td>
        <td style="font-weight:800;color:var(--success);white-space:nowrap;text-align:center">${fmt(p.amount)}</td>
        <td style="white-space:nowrap;text-align:center">${termStatus}</td>
        <td style="font-weight:700;white-space:nowrap;text-align:center;color:${totalOwed>0?'var(--danger)':'var(--success)'}">${totalOwed>0?fmt(totalOwed)+' owed':'All Clear'}</td>
        <td style="white-space:nowrap;text-align:center"><span class="badge badge-neutral">${p.method}</span></td>
        <td style="white-space:nowrap;font-size:.82rem;color:var(--t3)">${fmtDate(p.date)}</td>
        <td style="font-size:.82rem;color:var(--t3)">${p.by||'—'}</td>
        <td><div style="display:flex;gap:.3rem">
          <button class="btn btn-ghost btn-sm" onclick="SMS.showReceipt('${p.id}')" style="padding:.3rem .5rem" title="View Receipt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
          ${this.currentUser?.role==='admin'?`<button class="btn btn-ghost btn-sm" onclick="SMS.openReversePaymentModal('${p.id}')" style="padding:.3rem .5rem;color:var(--danger)" title="Reverse Payment"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>`:''}
        </div></td>
      </tr>`;
    }).join('')||SMS._emptyState('fees','No Payments Found','Record your first fee payment or adjust the filters above.','+ Record Payment',"SMS.openFeeModal()");
  },

  renderFeeStructure(){
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const fs=DB.get('feeStructure',[]).filter(f=>!f.year||f.year===yearFilter); const classes=DB.get('classes',[]);
    document.getElementById('fee-struct-tbody').innerHTML=fs.map(f=>{
      const cls=classes.find(c=>c.id===f.classId);
      const total=(+f.term1||0)+(+f.term2||0)+(+f.term3||0);
      return `<tr>
        <td style="font-weight:600">${cls?.name||'—'}</td>
        <td>${fmt(f.term1)}</td><td>${fmt(f.term2)}</td><td>${fmt(f.term3)}</td>
        <td class="fee-struct-total">${fmt(total)}</td>
        <td style="font-size:.75rem;color:var(--t3)">${f.includes||'Tuition, Books, Activities'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.openFeeStructModal('${f.classId}')" style="padding:.3rem .5rem;color:var(--brand)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></td>
      </tr>`;
    }).join('')||SMS._emptyState('fees','No Fee Structure Set','Define term fees for each class so the system can track balances.','');
  },

  renderDefaulters(){
    const students=DB.get('students',[]); const classes=DB.get('classes',[]);
    const yearFilter=document.getElementById('fee-year-f')?.value||_academicYear;
    const curr=Math.min(3,Math.max(1,+_currentTerm));
    // Only students who owe on at least one of their active terms
    const defaulters=students.filter(s=>{
      if(s.status!=='active') return false;
      return this._studentOwed(s,yearFilter)>0;
    });
    // Update table headers dynamically to reflect current term scope
    const thead=document.querySelector('#fees-defaulters thead tr');
    if(thead){
      // Build headers: Student, Class, Phone, then one col per term 1→curr, then Total Owed, Actions
      const termHeaders=Array.from({length:curr},(_,i)=>`<th>Term ${i+1}</th>`).join('');
      thead.innerHTML=`<th>Student</th><th>Class</th><th>Parent Phone</th>${termHeaders}<th>Total Owed</th><th></th>`;
    }
    document.getElementById('defaulters-tbody').innerHTML=defaulters.map(s=>{
      const fs=getYearStructure(s.classId,yearFilter);
      const yf=getYearFees(s,yearFilter);
      const enrollTerm=Math.min(3,Math.max(1,+(s.enrollTerm||1)));
      // Build one cell per term 1→curr
      const termCells=Array.from({length:curr},(_,i)=>{
        const t=i+1;
        if(t<enrollTerm){
          // Term before this student enrolled — not charged
          return `<td style="color:var(--t4);font-size:.75rem;text-align:center">—</td>`;
        }
        const due=+(fs?fs['term'+t]||0:0);
        const paid=+(yf['term'+t]||0);
        const owed=Math.max(0,due-paid);
        return `<td style="color:${owed>0?'var(--danger)':'var(--success)'};font-weight:600;text-align:center">${owed>0?fmt(owed):'Paid'}</td>`;
      }).join('');
      const totalOwed=this._studentOwed(s,yearFilter);
      return `<tr>
        <td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
        <td>${this.className(s.classId)}</td>
        <td>${sanitize(s.dadPhone||'—')}</td>
        ${termCells}
        <td style="font-weight:800;color:var(--danger);text-align:center">${fmt(totalOwed)}</td>
        <td>
          <div style="display:flex;gap:.3rem">
            <button class="btn btn-primary btn-sm" onclick="SMS.openFeeModal('${s.id}')" style="font-size:.73rem;padding:.3rem .6rem">Pay Now</button>
            <button class="btn btn-secondary btn-sm" onclick="SMS.sendFeeReminder('${s.id}')" style="font-size:.73rem;padding:.3rem .6rem" title="Send SMS Reminder"><svg style="width:13px;height:13px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">All fees paid — no defaulters</td></tr>';
  },

  // ══ FEE REMINDER (Alert/Simulate SMS) ══
  sendFeeReminder(studentId){
    const s=DB.get('students',[]).find(x=>x.id===studentId); if(!s) return;
    const fs=getYearStructure(s.classId,_academicYear);
    const yf=getYearFees(s,_academicYear);
    // Use _studentOwed: only active terms (enrollTerm → _currentTerm) — matches defaulters table exactly
    const total=this._studentOwed(s,_academicYear);
    // Build per-active-term breakdown
    const enrollTerm=Math.min(3,Math.max(1,+(s.enrollTerm||1)));
    const curr=Math.min(3,Math.max(1,+_currentTerm));
    const termRows=[];
    for(let t=enrollTerm;t<=curr;t++){
      const due=+(fs?fs['term'+t]||0:0);
      const paid=+(yf['term'+t]||0);
      const owed=Math.max(0,due-paid);
      if(due>0) termRows.push(`<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border);font-size:.82rem"><span style="color:var(--t2)">Term ${t}</span><span style="font-weight:700;color:${owed>0?'var(--danger)':'var(--success)'}">${owed>0?fmt(owed):'Paid'}</span></div>`);
    }
    const school=DB.get('school',{});
    const msg=`Dear ${sanitize(s.dadName||'Parent')}, your ward ${sanitize(s.fname)} ${sanitize(s.lname)} (${sanitize(this.className(s.classId))}) has an outstanding fee balance of ${fmt(total)} for Term ${_currentTerm}. Please contact ${sanitize(school.name||'the school')} at ${sanitize(school.phone||'our office')} to make payment. Thank you.`;
    document.getElementById('receipt-title').textContent='Fee Reminder Preview';
    document.getElementById('receipt-body').innerHTML=`
      <div style="background:var(--brand-lt);border:1px solid var(--brand-lt2);border-radius:10px;padding:1rem;margin-bottom:1rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.4rem">SMS Message to ${sanitize(s.dadPhone||'No phone on record')}</div>
        <div style="font-size:.88rem;color:var(--t1);line-height:1.6">${msg}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.82rem;margin-bottom:.75rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">TOTAL OWED</div><div style="font-weight:800;color:var(--danger);font-size:.95rem">${fmt(total)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">PARENT PHONE</div><div>${sanitize(s.dadPhone||s.momPhone||'Not on record')}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">CLASS</div><div>${sanitize(this.className(s.classId))}</div></div>
      </div>
      ${termRows.length?`<div style="margin-bottom:.75rem"><div style="font-size:.7rem;color:var(--t4);font-weight:700;margin-bottom:.35rem">TERM BREAKDOWN (up to Term ${_currentTerm})</div>${termRows.join('')}</div>`:''}
      <div style="margin-top:.5rem;padding:.75rem;background:var(--warn-bg);border-radius:8px;font-size:.78rem;color:var(--t2)">
        <svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Configure your SMS gateway in Settings → SMS Notifications to send real messages. This preview shows what will be sent.
      </div>`;
    this.audit('Fee Reminder','create',`Fee reminder sent to parent of ${sanitize(s.fname)} ${sanitize(s.lname)}`);
    this.openModal('m-receipt');
  },

  sendBulkReminders(){
    const students=DB.get('students',[]); const feeStructure=DB.get('feeStructure',[]);
    const defaulters=students.filter(s=>{
      if(s.status!=='active') return false;
      const fs=getYearStructure(s.classId,_academicYear); if(!fs) return false;
      const yf=getYearFees(s,_academicYear);
      const t1=+(fs.term1||0), t2=+(fs.term2||0), t3=+(fs.term3||0);
      return (+(yf.term1||0))<t1 || (+(yf.term2||0))<t2 || (+(yf.term3||0))<t3;
    });
    if(defaulters.length===0){ this.toast('No defaulters — all fees are paid!','success'); return; }
    this.audit('Fee Reminder','create',`Bulk reminders queued for ${defaulters.length} defaulters`);
    this.toast(`${defaulters.length} reminders queued! Configure SMS gateway in Settings to send.`,'success');
  },

  // ══ STUDENT PROMOTION ══
  openPromoteModal(){
    const classes=DB.get('classes',[]).sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('receipt-title').textContent='Year-End Student Promotion';
    document.getElementById('receipt-body').innerHTML=`
      <div style="margin-bottom:1rem;font-size:.85rem;color:var(--t3)">Promote all active students in a class to the next class level.</div>
      <div class="form-grid-2" style="margin-bottom:1rem">
        <div class="form-field">
          <label class="form-label">From Class *</label>
          <select class="form-input" id="promo-from">${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label class="form-label">To Class *</label>
          <select class="form-input" id="promo-to"><option value="">— Select Target Class —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div style="background:var(--warn-bg);border:1px solid var(--warn);border-radius:8px;padding:.75rem;font-size:.78rem;color:var(--t2);margin-bottom:1rem">
        <svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This will move all <strong>active</strong> students from the selected class to the target class. This action can be undone by promoting them back.
      </div>
      <div id="promo-preview" style="font-size:.82rem;color:var(--t3)"></div>
      <div style="margin-top:1rem;display:flex;gap:.75rem">
        <button class="btn btn-secondary btn-sm" onclick="SMS.previewPromotion()">Preview</button>
        <button class="btn btn-primary" onclick="SMS.executePromotion()">Promote Students</button>
      </div>`;
    // Live preview on change
    setTimeout(()=>{
      document.getElementById('promo-from')?.addEventListener('change',()=>SMS.previewPromotion());
      document.getElementById('promo-to')?.addEventListener('change',()=>SMS.previewPromotion());
    },100);
    this.openModal('m-receipt');
  },

  previewPromotion(){
    const fromId=document.getElementById('promo-from')?.value;
    const toId=document.getElementById('promo-to')?.value;
    const prev=document.getElementById('promo-preview'); if(!prev) return;
    if(!fromId||!toId||fromId===toId){ prev.innerHTML=''; return; }
    const students=DB.get('students',[]).filter(s=>s.classId===fromId&&s.status==='active');
    prev.innerHTML=`<strong>${students.length} student(s)</strong> will be promoted: ${students.slice(0,5).map(s=>`${sanitize(s.fname)} ${sanitize(s.lname)}`).join(', ')}${students.length>5?` +${students.length-5} more`:''}`;
  },

  executePromotion(){
    const fromId=document.getElementById('promo-from')?.value;
    const toId=document.getElementById('promo-to')?.value;
    if(!fromId||!toId||fromId===toId){ this.toast('Select two different classes','warn'); return; }
    const students=DB.get('students',[]);
    const promotedIds=[]; let count=0;
    students.forEach(s=>{ if(s.classId===fromId&&s.status==='active'){ s.classId=toId; if(!s.feesPaid||typeof s.feesPaid.term1==='number') s.feesPaid={}; s.feesPaid[_academicYear]={term1:0,term2:0,term3:0}; promotedIds.push(s.id); count++; } });
    DB.set('students',students);
    // Clear old fee payment records for promoted students so feesPaid stays in sync
    const orphanPromo=DB.get('feePayments',[]).filter(p=>promotedIds.includes(p.studentId));
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>!promotedIds.includes(p.studentId)));
    // Also delete from Firestore so they don't return on refresh
    const _sid=window.SMS&&window.SMS.schoolId;
    if(_sid&&window.FDB) orphanPromo.forEach(p=>FDB.delete(_sid,'feePayments',p.id).catch(()=>{}));
    this.audit('Student Promotion','edit',`Promoted ${count} students from ${this.className(fromId)} to ${this.className(toId)}`);
    this.toast(`${count} students successfully promoted to ${this.className(toId)}!`,'success');
    this.closeModal('m-receipt'); this.renderStudents(); this.renderStudentStats();
  },

  // ══ BULK IMPORT STUDENTS via CSV/XLSX ══
  openImportModal(){
    document.getElementById('receipt-title').textContent='Import Students';
    document.getElementById('receipt-body').innerHTML=`
      <div style="margin-bottom:.75rem;font-size:.85rem;color:var(--t3)">Upload a CSV or Excel file to import multiple students at once.</div>
      <div style="background:var(--surface-2);border:2px dashed var(--border);border-radius:10px;padding:1.5rem;text-align:center;margin-bottom:1rem">
        <div style="margin-bottom:.5rem;display:flex;justify-content:center"><svg style="width:28px;height:28px;color:var(--t3)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">Drop CSV / Excel file here</div>
        <div style="font-size:.75rem;color:var(--t4);margin-bottom:.75rem">Required columns: First Name, Last Name, Class, Gender, DOB, Parent Name, Parent Phone</div>
        <input type="file" id="import-file" accept=".csv,.xlsx,.xls" style="display:none" onchange="SMS.handleImportFile(event)"/>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('import-file').click()">Choose File</button>
      </div>
      <div style="margin-bottom:1rem">
        <a href="#" onclick="SMS.downloadImportTemplate();return false;" style="font-size:.82rem;color:var(--brand-teal);text-decoration:underline"><svg style="width:13px;height:13px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Template CSV</a>
      </div>
      <div id="import-preview" style="font-size:.82rem"></div>`;
    this.openModal('m-receipt');
  },

  downloadImportTemplate(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const template=[{'First Name':'Kwame','Last Name':'Asante','Class':'JHS 1','Gender':'Male','Date of Birth':'2012-01-15','Parent Name':'Kofi Asante','Parent Phone':'+233 24 123 4567','Address':'Accra, Ghana','Student ID':''}];
    const ws=XLSX.utils.json_to_sheet(template); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Students');
    XLSX.writeFile(wb,'StudentImportTemplate.xlsx');
    this.toast('Template downloaded!','success');
  },

  handleImportFile(e){
    const file=e.target.files[0]; if(!file) return;
    if(typeof XLSX==='undefined'){ this.toast('Import library not loaded','error'); return; }
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=new Uint8Array(ev.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws);
        if(rows.length===0){ document.getElementById('import-preview').innerHTML='<div style="color:var(--danger)">No data found in file.</div>'; return; }
        const classes=DB.get('classes',[]);
        let valid=0, errors=[];
        const toImport=rows.map((r,i)=>{
          const fname=(r['First Name']||r['fname']||'').trim();
          const lname=(r['Last Name']||r['lname']||'').trim();
          const clsName=(r['Class']||r['class']||'').trim();
          const gender=(r['Gender']||r['gender']||'').trim();
          const cls=classes.find(c=>c.name.toLowerCase()===clsName.toLowerCase()||c.id===clsName);
          if(!fname||!lname||!cls||!gender){ errors.push(`Row ${i+2}: Missing required fields`); return null; }
          valid++;
          return {id:uid('stu'),studentId:`IMP-${Date.now()}-${i}`,fname,lname,classId:cls.id,gender,dob:r['Date of Birth']||r['dob']||'',dadName:r['Parent Name']||r['dadName']||'',dadPhone:r['Parent Phone']||r['dadPhone']||'',address:r['Address']||'',status:'active',admitDate:new Date().toISOString().split('T')[0],feesPaid:{term1:0,term2:0,term3:0}};
        }).filter(Boolean);
        document.getElementById('import-preview').innerHTML=`
          <div style="background:var(--success-bg);border-radius:8px;padding:.75rem;margin-bottom:.75rem"><strong>${valid} student(s)</strong> ready to import from ${rows.length} rows.</div>
          ${errors.length>0?`<div style="background:var(--danger-bg);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.75rem;color:var(--danger)">${errors.slice(0,5).join('<br>')}</div>`:''}
          <div style="overflow-x:auto;max-height:200px;overflow-y:auto;font-size:.75rem;border:1px solid var(--border);border-radius:8px">
            <table class="tbl" style="font-size:.73rem"><thead><tr><th>Name</th><th>Class</th><th>Gender</th><th>Parent</th></tr></thead><tbody>
            ${toImport.slice(0,10).map(s=>`<tr><td>${sanitize(s.fname)} ${sanitize(s.lname)}</td><td>${sanitize(this.className(s.classId))}</td><td>${sanitize(s.gender||'')}</td><td>${sanitize(s.dadName||'—')}</td></tr>`).join('')}
            ${toImport.length>10?`<tr><td colspan="4" style="text-align:center;color:var(--t4)">+${toImport.length-10} more...</td></tr>`:''}
            </tbody></table>
          </div>
          <button class="btn btn-primary" style="margin-top:.75rem" id="do-import-btn">Import ${valid} Students</button>`;
        // Store safely in memory — never pass via onclick attribute
        SMS._pendingImport = toImport;
        setTimeout(()=>{
          document.getElementById('do-import-btn')?.addEventListener('click',()=>SMS.confirmImport());
        },50);
      }catch(err){ document.getElementById('import-preview').innerHTML=`<div style="color:var(--danger)">Error reading file: ${sanitize(String(err.message||'Unknown error'))}</div>`; }
    };
    reader.readAsArrayBuffer(file);
  },

  confirmImport(){
    const toImport=this._pendingImport;
    if(!toImport||!toImport.length){ this.toast('No import data found','error'); return; }
    this._pendingImport=null;
    const students=DB.get('students',[]); students.push(...toImport); DB.set('students',students);
    this.audit('Bulk Import','create',`Imported ${toImport.length} students via file upload`);
    this.toast(`${toImport.length} students imported successfully!`,'success');
    // Refresh fee modal student dropdown so imported students appear
    const fstu=document.getElementById('fee-student'); if(fstu){ const sts=DB.get('students',[]); fstu.innerHTML='<option value="">— Select Student —</option>'+sts.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${this.className(s.classId)})</option>`).join(''); }
    this.closeModal('m-receipt'); this.renderStudents(); this.renderStudentStats();
  },

  // ══ PRINTABLE ATTENDANCE SHEET ══
  printAttendanceSheet(){
    const classes=DB.get('classes',[]);
    const date=document.getElementById('att-date')?.value||new Date().toISOString().split('T')[0];
    const classId=document.getElementById('att-class')?.value;
    if(!classId){ this.toast('Select a class first to print its sheet','warn'); return; }
    const students=DB.get('students',[]).filter(s=>s.classId===classId&&s.status==='active');
    const cls=classes.find(c=>c.id===classId);
    const school=DB.get('school',{});
    const html=`
      <div style="font-size:.85rem;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:2px solid #1a3a6b">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:#1a3a6b">${sanitize(school.name||'School')}</div>
            <div style="font-size:.75rem;color:#666">Attendance Sheet — ${sanitize(cls?.name||'Class')} — ${fmtDate(date)}</div>
          </div>
          <div style="text-align:right;font-size:.72rem;color:#666">
            Teacher: ${(()=>{ const t=DB.get('staff',[]).find(s=>s.id===cls?.teacherId); return t?sanitize(t.fname)+' '+sanitize(t.lname):'—'; })()}<br>
            Academic Year: ${school.academicYear||'2025/2026'} · Term ${school.currentTerm||'2'}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:.8rem">
          <thead>
            <tr style="background:#1a3a6b;color:white">
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">#</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Student Name</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Student ID</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">P</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">A</th>
              <th style="padding:.5rem;text-align:center;border:1px solid #ccc;width:60px">L</th>
              <th style="padding:.5rem;text-align:left;border:1px solid #ccc">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s,i)=>`
              <tr style="background:${i%2===0?'#f9f9f9':'white'}">
                <td style="padding:.45rem;border:1px solid #ddd;font-weight:700">${i+1}</td>
                <td style="padding:.45rem;border:1px solid #ddd;font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
                <td style="padding:.45rem;border:1px solid #ddd;font-family:monospace;font-size:.72rem">${s.studentId}</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd;text-align:center">☐</td>
                <td style="padding:.45rem;border:1px solid #ddd"></td>
              </tr>`).join('')}
            <tr style="background:#e8f0fe;font-weight:700">
              <td colspan="3" style="padding:.5rem;border:1px solid #ddd">TOTALS</td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd;text-align:center"></td>
              <td style="padding:.5rem;border:1px solid #ddd"></td>
            </tr>
          </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:2rem;font-size:.78rem">
          <div>Teacher's Signature: ________________________</div>
          <div>Date: ${fmtDate(date)}</div>
          <div>Head Teacher's Initials: ________</div>
        </div>
        <div style="text-align:center;margin-top:1rem;font-size:.68rem;color:#999">Generated by Eduformium School Management System · ${new Date().toLocaleDateString()}</div>
      </div>`;
    document.getElementById('receipt-title').textContent='Attendance Sheet';
    document.getElementById('receipt-body').innerHTML=html;
    this.openModal('m-receipt');
    setTimeout(()=>window.print(),300);
  },

  // ══ DASHBOARD REFRESH ══
  refreshDashboard(){
    const btn=document.getElementById('dash-refresh-btn'); if(btn){ const ico=btn.querySelector('svg'); if(ico){ ico.style.animation='spin .6s linear'; setTimeout(()=>ico.style.animation='',700); } }
    this._dashDataFingerprint=null; // force chart redraw on manual refresh
    this.loadDashboard(); this.toast('Dashboard refreshed','success');
  },

  openFeeModal(preStudentId=null){
    ['fee-id','fee-amount','fee-ref','fee-notes'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('fee-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('fee-term').value=_currentTerm;
    document.getElementById('fee-method').value='cash';
    // Set academic year dropdown
    const fmYearEl=document.getElementById('fee-academic-year');
    if(fmYearEl){ const years=getAllAcademicYears(); fmYearEl.innerHTML=years.map(y=>`<option value="${y.year}"${y.year===_academicYear?' selected':''}>${y.year}${y.isCurrent?' (Current)':''}</option>`).join(''); }
    document.getElementById('fee-err').style.display='none';
    const fstu=document.getElementById('fee-student'); if(fstu) fstu.value=preStudentId||'';
    // Always re-enable save button in case it was disabled by a previous "fully paid" check
    const saveBtnEl=document.getElementById('save-fee-btn'); if(saveBtnEl) saveBtnEl.disabled=false;
    this.openModal('m-fee');
    // Live term status — runs when student or term changes
    const checkTermStatus=()=>{
      const sId=document.getElementById('fee-student')?.value;
      const tm=document.getElementById('fee-term')?.value;
      const errEl=document.getElementById('fee-err');
      const amtEl=document.getElementById('fee-amount');
      const saveBtn=document.getElementById('save-fee-btn');
      if(!sId||!tm){ errEl.style.display='none'; return; }
      const st=DB.get('students',[]).find(x=>x.id===sId);
      const fmYear=document.getElementById('fee-academic-year')?.value||_academicYear;
      const fs=getYearStructure(st?.classId,fmYear);
      if(!st||!fs){ errEl.style.display='none'; return; }
      const due=+(fs['term'+tm]||0);
      const fmyf=getYearFees(st,fmYear); const paid=+(fmyf['term'+tm]||0);
      const owed=Math.max(0,due-paid);
      if(due===0){ errEl.style.display='none'; return; }
      if(owed===0){
        errEl.style.display='block';
        errEl.style.background='var(--success-bg)';
        errEl.style.color='var(--success)';
        errEl.style.borderColor='var(--success)';
        errEl.textContent=`Term ${tm} is already fully paid (${fmt(paid)} of ${fmt(due)}). No payment needed.`;
        if(amtEl) amtEl.value='';
        if(saveBtn) saveBtn.disabled=true;
      } else {
        errEl.style.display='block';
        errEl.style.background='var(--surface-2)';
        errEl.style.color='var(--t2)';
        errEl.style.borderColor='var(--border)';
        errEl.textContent=`Term ${tm}: ${fmt(paid)} paid of ${fmt(due)} — Balance remaining: ${fmt(owed)}`;
        if(saveBtn) saveBtn.disabled=false;
      }
    };
    setTimeout(()=>{
      // Replace elements with clones to remove any previously stacked listeners
      ['fee-student','fee-term','fee-academic-year'].forEach(eid=>{
        const el=document.getElementById(eid); if(!el) return;
        const clone=el.cloneNode(true); el.parentNode.replaceChild(clone,el);
        clone.addEventListener('change', checkTermStatus);
      });
      if(preStudentId) checkTermStatus();
    }, 80);
  },

  saveFee(){
    if(!this.hasRole('admin','accountant')){ this.toast('You do not have permission to perform this action','error'); return; }
    const studentId=document.getElementById('fee-student').value;
    const term=document.getElementById('fee-term').value;
    const amount=+document.getElementById('fee-amount').value;
    const date=document.getElementById('fee-date').value;
    const errEl=document.getElementById('fee-err');
    if(!studentId||!amount||!date){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    if(amount<=0){ errEl.style.display='block'; errEl.textContent='Amount must be greater than zero.'; return; }
    // Hard block — prevent overpayment if term is already fully paid
    const stCheck=DB.get('students',[]).find(x=>x.id===studentId);
    const payYear=document.getElementById('fee-academic-year')?.value||_academicYear;
    const fsCheck=getYearStructure(stCheck?.classId,payYear);
    if(stCheck&&fsCheck){
      const due=+(fsCheck['term'+term]||0);
      const scyf=getYearFees(stCheck,payYear); const paid=+(scyf['term'+term]||0);
      if(due>0&&paid>=due){
        errEl.style.display='block';
        errEl.style.background='var(--danger-bg)';
        errEl.style.color='var(--danger)';
        errEl.textContent=`Term ${term} is already fully paid. No further payment can be recorded for this term.`;
        return;
      }
      // Also cap: don't allow amount that exceeds remaining balance
      const owed=Math.max(0,due-paid);
      if(due>0&&amount>owed){
        errEl.style.display='block';
        errEl.style.background='var(--danger-bg)';
        errEl.style.color='var(--danger)';
        errEl.textContent=`Amount exceeds remaining balance of ${fmt(owed)} for Term ${term}. Please enter the correct amount.`;
        return;
      }
    }
    errEl.style.display='none';
    const payments=DB.get('feePayments',[]);
    const maxRec=payments.reduce((mx,p)=>{ const n=parseInt((p.receiptNo||'').replace('REC-','')||0); return n>mx?n:mx; },0);
    const receiptNo='REC-'+String(maxRec+1).padStart(4,'0');
    const _saveYear=document.getElementById('fee-academic-year')?.value||_academicYear;
    const payment={id:uid('fp'),studentId,term,amount,method:document.getElementById('fee-method').value,date,by:this.currentUser.name,receiptNo,ref:document.getElementById('fee-ref').value,notes:document.getElementById('fee-notes').value,academicYear:_saveYear};
    payments.push(payment); DB.set('feePayments',payments);
    // Update student feesPaid (year-keyed)
    const students=DB.get('students',[]); const si=students.findIndex(s=>s.id===studentId);
    if(si>-1){
      if(!students[si].feesPaid||typeof students[si].feesPaid.term1==='number') students[si].feesPaid={};
      if(!students[si].feesPaid[_saveYear]) students[si].feesPaid[_saveYear]={term1:0,term2:0,term3:0};
      students[si].feesPaid[_saveYear]['term'+term]=(+(students[si].feesPaid[_saveYear]['term'+term]||0))+amount;
      DB.set('students',students);
    }
    const s=DB.get('students',[]).find(x=>x.id===studentId);
    this.audit('Fee Payment','create',`Payment recorded: ${s?.fname} ${s?.lname} — ${fmt(amount)} Term ${term} (${receiptNo})`);
    // Refresh student to get updated feesPaid
    const updatedSt=DB.get('students',[]).find(x=>x.id===studentId);
    const fs2=getYearStructure(updatedSt?.classId,_saveYear);
    const termDue2=fs2?+(fs2['term'+term]||0):0;
    const _ustYF=getYearFees(updatedSt,_saveYear); const termPaid2=+((_ustYF)['term'+term]||0);
    const termFullyPaid=termDue2>0&&termPaid2>=termDue2;
    const toastMsg=termFullyPaid
      ? `Term ${term} fully paid! Receipt: ${receiptNo}`
      : `Payment of ${fmt(amount)} recorded. Receipt: ${receiptNo}${termDue2>0?' · Balance: '+fmt(Math.max(0,termDue2-termPaid2)):''}`;
    this.toast(toastMsg,'success');
    this.closeModal('m-fee'); this.renderFees(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

  showReceipt(paymentId){
    const p=DB.get('feePayments',[]).find(x=>x.id===paymentId); if(!p) return;
    const s=DB.get('students',[]).find(x=>x.id===p.studentId);
    const school=DB.get('school',{});
    document.getElementById('receipt-title').textContent='Fee Receipt';
    document.getElementById('receipt-body').innerHTML=`
      <div style="text-align:center;margin-bottom:1rem;padding-bottom:1rem;border-bottom:2px solid var(--border)">
        ${school.logo?`<img src="${school.logo}" alt="School Logo" style="width:56px;height:56px;border-radius:50%;object-fit:contain;margin:0 auto .5rem;display:block;border:2px solid var(--border)">`:''}
        <div style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;color:var(--brand)">${sanitize(school.name||'School')}</div>
        <div style="font-size:.72rem;color:var(--t4)">${sanitize(school.address||'')}</div>
        <div style="font-size:.72rem;color:var(--t4)">${sanitize(school.phone||'')} · ${sanitize(school.email||'')}</div>
      </div>
      <div style="text-align:center;margin-bottom:1.25rem">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--t3)">Fee Receipt</div>
        <div style="font-family:monospace;font-size:.9rem;font-weight:800;color:var(--brand)">${p.receiptNo||'—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.82rem;margin-bottom:1rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${s?sanitize(s.fname)+' '+sanitize(s.lname):'—'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">CLASS</div><div style="font-weight:600">${sanitize(this.className(s?.classId))}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">TERM</div><div style="font-weight:600">Term ${p.term}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">DATE</div><div style="font-weight:600">${fmtDate(p.date)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">PAYMENT METHOD</div><div style="font-weight:600">${sanitize(p.method||'')}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">RECEIVED BY</div><div style="font-weight:600">${sanitize(p.by||'—')}</div></div>
        ${p.ref?`<div><div style="font-size:.7rem;color:var(--t4);font-weight:700">REFERENCE</div><div style="font-weight:600">${sanitize(p.ref)}</div></div>`:''}
        ${p.notes?`<div style="grid-column:1/-1"><div style="font-size:.7rem;color:var(--t4);font-weight:700">NOTES</div><div style="font-weight:600">${sanitize(p.notes)}</div></div>`:''}
      </div>
      <div style="background:var(--brand);color:white;padding:1rem;border-radius:var(--radius);text-align:center;margin-bottom:1rem">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;opacity:.7">Amount Paid</div>
        <div style="font-size:1.8rem;font-weight:800;letter-spacing:-.04em">${fmt(p.amount)}</div>
      </div>
      <div style="text-align:center;font-size:.7rem;color:var(--t4)">This receipt was generated by Eduformium School Management System.<br>Thank you for your payment.</div>
    `;
    this.openModal('m-receipt');
  },

  openReversePaymentModal(paymentId){
    if(this.currentUser?.role!=='admin'){ this.toast('Only admins can reverse payments','error'); return; }
    const p=DB.get('feePayments',[]).find(x=>x.id===paymentId); if(!p) return;
    const s=DB.get('students',[]).find(x=>x.id===p.studentId);
    document.getElementById('receipt-title').textContent='Reverse Payment';
    document.getElementById('receipt-body').innerHTML=`
      <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:.6rem;padding:.85rem 1rem;margin-bottom:1rem">
        <div style="font-size:.78rem;font-weight:700;color:var(--danger);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.05em"><svg style="width:15px;height:15px;vertical-align:middle;margin-right:5px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This action cannot be undone</div>
        <div style="font-size:.83rem;color:var(--t2)">You are about to permanently reverse the following payment:</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;font-size:.82rem;margin-bottom:1rem">
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">RECEIPT</div><div style="font-weight:700;font-family:monospace">${p.receiptNo||'—'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">STUDENT</div><div style="font-weight:600">${s?sanitize(s.fname)+' '+sanitize(s.lname):'Unknown'}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">TERM</div><div style="font-weight:600">Term ${p.term}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">AMOUNT</div><div style="font-weight:800;color:var(--danger)">${fmt(p.amount)}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">METHOD</div><div>${p.method}</div></div>
        <div><div style="font-size:.7rem;color:var(--t4);font-weight:700">DATE</div><div>${fmtDate(p.date)}</div></div>
      </div>
      <div class="form-field" style="margin-bottom:1rem">
        <label class="form-label" style="color:var(--danger);font-weight:700">Reason for Reversal *</label>
        <textarea class="form-input" id="reversal-reason" rows="3" placeholder="e.g. Wrong student selected, duplicate payment, incorrect amount…" style="border-color:rgba(239,68,68,.4)"></textarea>
        <div id="reversal-err" style="display:none;color:var(--danger);font-size:.78rem;margin-top:.3rem">Please provide a reason for the reversal.</div>
      </div>
      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="SMS.closeModal('m-receipt')">Cancel</button>
        <button class="btn btn-sm" style="background:#dc2626;color:#fff;font-weight:700;padding:.4rem 1rem;border:none;border-radius:.45rem;cursor:pointer" onclick="SMS.reversePayment('${paymentId}')">Confirm Reversal</button>
      </div>`;
    this.openModal('m-receipt');
  },

  reversePayment(paymentId){
    if(this.currentUser?.role!=='admin'){ this.toast('Only admins can reverse payments','error'); return; }
    const reason=document.getElementById('reversal-reason')?.value.trim();
    const errEl=document.getElementById('reversal-err');
    if(!reason){ if(errEl) errEl.style.display='block'; return; }
    const payments=DB.get('feePayments',[]);
    const p=payments.find(x=>x.id===paymentId); if(!p){ this.toast('Payment not found','error'); return; }
    const students=DB.get('students',[]);
    const si=students.findIndex(s=>s.id===p.studentId);
    // Subtract amount from student feesPaid for that term — use year-keyed path
    if(si>-1){
      const pYear=p.academicYear||_academicYear;
      if(!students[si].feesPaid||typeof students[si].feesPaid.term1==='number') students[si].feesPaid={};
      if(!students[si].feesPaid[pYear]) students[si].feesPaid[pYear]={term1:0,term2:0,term3:0};
      const current=+(students[si].feesPaid[pYear]['term'+p.term]||0);
      students[si].feesPaid[pYear]['term'+p.term]=Math.max(0, current - p.amount);
      DB.set('students',students);
    }
    // Delete payment record from local + Firestore
    DB.set('feePayments',payments.filter(x=>x.id!==paymentId));
    const sid=window.SMS&&window.SMS.schoolId;
    if(sid&&window.FDB) FDB.delete(sid,'feePayments',paymentId).catch(()=>{});
    // Sync updated student to Firestore
    if(si>-1&&sid&&window.FDB) FDB.batchWrite(sid,'students',[students[si]]).catch(()=>{});
    this.audit('Fee Reversal','delete',`Payment ${p.receiptNo} reversed for ${students[si]?.fname||'Unknown'} — ${fmt(p.amount)} Term ${p.term}. Reason: ${reason}`);
    this.closeModal('m-receipt');
    this.toast(`Payment ${p.receiptNo} reversed successfully`,'warn');
    this.renderFees(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

});