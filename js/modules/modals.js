// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Modal Openers — deleteBook · expenseModal · homeworkModal · leaveModal · bookModal · feeStructModal · timetableDesigner
// ══════════════════════════════════════════

Object.assign(SMS, {
  deleteBook(id){
    const issues=DB.get('bookIssues',[]).filter(i=>!i.returnedDate&&i.bookId===id);
    if(issues.length>0){ this.toast('Cannot delete: book has active borrowings','error'); return; }
    DB.set('books',DB.get('books',[]).filter(b=>b.id!==id));
    const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'books',id).catch(()=>{});
    this.toast('Book deleted','warn'); this.loadLibrary();
  },

  // ══ STUDENT PROMOTION WIZARD ══
  openPromotionWizard(){
    const classes=DB.get('classes',[]).sort((a,b)=>a.name.localeCompare(b.name));
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    document.getElementById('receipt-title').textContent='Year-End Student Promotion';
    document.getElementById('receipt-body').innerHTML=`
      <div style="font-size:.82rem;color:var(--t3);margin-bottom:.9rem">Move all active students from one class to the next at the end of the academic year.</div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.5rem;align-items:center;margin-bottom:.75rem">
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">From Class</label>
          <select id="promo-from" class="form-select" style="width:100%" onchange="SMS._updatePromotionPreview()">
            <option value="">— Select —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}
          </select>
        </div>
        <div style="text-align:center;font-size:1.2rem;padding-top:1.2rem">→</div>
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--t2);display:block;margin-bottom:.3rem">To Class</label>
          <select id="promo-to" class="form-select" style="width:100%" onchange="SMS._updatePromotionPreview()">
            <option value="">— Select —</option>${classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="promo-preview" style="display:none;background:var(--surface-2);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.82rem"></div>
      <div style="display:flex;gap:.5rem;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="SMS.closeModal('m-receipt')">Cancel</button>
        <button class="btn btn-primary btn-sm" id="promo-confirm-btn" onclick="SMS.runPromotion()" style="display:none">Promote Students</button>
      </div>`;
    this.openModal('m-receipt');
  },

  _updatePromotionPreview(){
    const fromId=document.getElementById('promo-from').value;
    const toId=document.getElementById('promo-to').value;
    const preview=document.getElementById('promo-preview');
    const btn=document.getElementById('promo-confirm-btn');
    if(!fromId||!toId||fromId===toId){ preview.style.display='none'; btn.style.display='none'; return; }
    const students=DB.get('students',[]).filter(s=>s.classId===fromId&&s.status==='active');
    const toName=DB.get('classes',[]).find(c=>c.id===toId)?.name||'';
    const fromName=DB.get('classes',[]).find(c=>c.id===fromId)?.name||'';
    preview.style.display='block';
    btn.style.display='block';
    if(students.length===0){ preview.innerHTML=`<span style="color:var(--warn)">⚠ No active students found in ${fromName}.</span>`; btn.style.display='none'; return; }
    preview.innerHTML=`<strong>${students.length} student(s)</strong> will be moved from <strong>${fromName}</strong> → <strong>${toName}</strong>:<br><div style="margin-top:.4rem;max-height:100px;overflow-y:auto">${students.map(s=>`<span style="display:inline-block;margin:.15rem .3rem;background:var(--surface-3,rgba(0,0,0,.06));border-radius:4px;padding:.1rem .4rem">${sanitize(s.fname)} ${sanitize(s.lname)}</span>`).join('')}</div>`;
  },

  runPromotion(){
    const fromId=document.getElementById('promo-from').value;
    const toId=document.getElementById('promo-to').value;
    if(!fromId||!toId||fromId===toId){ this.toast('Select valid from/to classes','warn'); return; }
    const students=DB.get('students',[]);
    let count=0;
    students.forEach(s=>{ if(s.classId===fromId&&s.status==='active'){ s.classId=toId; count++; } });
    DB.set('students',students);
    const fromName=DB.get('classes',[]).find(c=>c.id===fromId)?.name||fromId;
    const toName=DB.get('classes',[]).find(c=>c.id===toId)?.name||toId;
    this.audit('Student Promotion','edit',`Promoted ${count} students from ${fromName} → ${toName}`);
    this.toast(`${count} student(s) promoted to ${toName}!`,'success');
    this.closeModal('m-receipt');
  },

  openExpenseModal(id=null){
    ['exp-id','exp-desc','exp-paidto','exp-approved','exp-ref','exp-notes'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('exp-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('exp-amount').value='';
    document.getElementById('exp-category').value='';
    document.getElementById('exp-err').style.display='none';
    document.getElementById('expense-modal-title').textContent='Add Expense';
    if(id){
      const ex=DB.get('expenses',[]).find(x=>x.id===id); if(!ex) return;
      document.getElementById('exp-id').value=ex.id;
      document.getElementById('exp-date').value=ex.date;
      document.getElementById('exp-category').value=ex.category;
      document.getElementById('exp-desc').value=ex.desc;
      document.getElementById('exp-amount').value=ex.amount;
      document.getElementById('exp-paidto').value=ex.paidTo;
      document.getElementById('exp-approved').value=ex.approvedBy;
      document.getElementById('exp-notes').value=ex.notes||'';
      document.getElementById('expense-modal-title').textContent='Edit Expense';
    }
    document.getElementById('save-expense-btn').onclick=()=>this.saveExpense();
    this.openModal('m-expense');
  },

  saveExpense(){
    if(!this.hasRole('admin','accountant')){ this.toast('You do not have permission to perform this action','error'); return; }
    const date=document.getElementById('exp-date').value;
    const category=document.getElementById('exp-category').value;
    const desc=document.getElementById('exp-desc').value.trim();
    const amount=+document.getElementById('exp-amount').value;
    const paidTo=document.getElementById('exp-paidto').value.trim();
    const errEl=document.getElementById('exp-err');
    if(!date||!category||!desc||!amount||!paidTo){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const expenses=DB.get('expenses',[]);
    const existId=document.getElementById('exp-id').value;
    const data={date,category,desc,amount,paidTo,approvedBy:document.getElementById('exp-approved').value.trim()||this.currentUser.name,ref:document.getElementById('exp-ref').value,notes:document.getElementById('exp-notes').value};
    if(existId){ const i=expenses.findIndex(e=>e.id===existId); if(i>-1){ expenses[i]={...expenses[i],...data}; DB.set('expenses',expenses); this.toast('Expense updated','success'); this.audit('Edit Expense','edit',`Updated: ${desc} — ${fmt(amount)}`); } }
    else { expenses.push({id:uid('e'),...data}); DB.set('expenses',expenses); this.audit('Add Expense','create',`New expense: ${desc} — ${fmt(amount)} (${category})`); this.toast(`Expense of ${fmt(amount)} recorded!`,'success'); }
    this.closeModal('m-expense'); this.renderExpenses();
  },

  // ══ HOMEWORK FORM ══
  openHomeworkModal(id=null){
    const classes=DB.get('classes',[]); const subjects=DB.get('subjects',[]);
    const sel=document.getElementById('hw-class-sel');
    if(sel) sel.innerHTML='<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    const ssel=document.getElementById('hw-subject-sel');
    if(ssel) ssel.innerHTML='<option value="">— Select Subject —</option>'+subjects.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join('');
    ['hw-id','hw-title','hw-desc'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('hw-due').value='';
    document.getElementById('hw-status-sel').value='pending';
    document.getElementById('hw-err').style.display='none';
    document.getElementById('hw-modal-title').textContent=id?'Edit Homework':'Assign Homework';
    if(id){
      const hw=DB.get('homework',[]).find(x=>x.id===id); if(!hw) return;
      document.getElementById('hw-id').value=hw.id; document.getElementById('hw-title').value=hw.title;
      document.getElementById('hw-class-sel').value=hw.classId; document.getElementById('hw-subject-sel').value=hw.subjectId||'';
      document.getElementById('hw-due').value=hw.dueDate; document.getElementById('hw-status-sel').value=hw.status;
      document.getElementById('hw-desc').value=hw.desc||'';
    }
    document.getElementById('hw-class-sel').onchange=()=>{ const cid=document.getElementById('hw-class-sel').value; const filtered=subjects.filter(s=>!cid||s.classId===cid); document.getElementById('hw-subject-sel').innerHTML='<option value="">— Select Subject —</option>'+filtered.map(s=>`<option value="${s.id}">${sanitize(s.name)}</option>`).join(''); };
    document.getElementById('save-hw-btn').onclick=()=>this.saveHomework();
    this.openModal('m-homework');
  },

  saveHomework(){
    if(!this.hasRole('admin','teacher')){ this.toast('You do not have permission to perform this action','error'); return; }
    const title=document.getElementById('hw-title').value.trim(); const classId=document.getElementById('hw-class-sel').value; const dueDate=document.getElementById('hw-due').value;
    const errEl=document.getElementById('hw-err');
    if(!title||!classId||!dueDate){ errEl.style.display='block'; errEl.textContent='Title, class, and due date are required.'; return; }
    errEl.style.display='none';
    const hw=DB.get('homework',[]); const existId=document.getElementById('hw-id').value;
    const data={title,classId,subjectId:document.getElementById('hw-subject-sel').value,dueDate,status:document.getElementById('hw-status-sel').value,desc:document.getElementById('hw-desc').value,assignedBy:this.currentUser.id};
    if(existId){ const i=hw.findIndex(h=>h.id===existId); if(i>-1){ hw[i]={...hw[i],...data}; DB.set('homework',hw); this.toast('Homework updated','success'); this.audit('Edit Homework','edit',`Updated: ${title}`); } }
    else { hw.push({id:uid('hw'),...data,assignedDate:new Date().toISOString()}); DB.set('homework',hw); this.audit('Assign Homework','create',`New homework: ${title} — Due: ${dueDate}`); this.toast('Homework assigned!','success'); }
    this.closeModal('m-homework'); this.renderHomework();
  },

  deleteHomework(id){ DB.set('homework',DB.get('homework',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'homework',id).catch(()=>{}); this.toast('Homework deleted','warn'); this.renderHomework(); },

  // ══ LEAVE FORM ══
  openLeaveModal(){
    const staff=DB.get('staff',[]);
    const sel=document.getElementById('lv-staff');
    if(sel) sel.innerHTML='<option value="">— Select Staff —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} (${sanitize(s.role)})</option>`).join('');
    ['lv-id','lv-reason'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('lv-from').value=''; document.getElementById('lv-to').value='';
    document.getElementById('lv-type').value='Annual'; document.getElementById('lv-err').style.display='none';
    document.getElementById('lv-days-preview').style.display='none';
    const calcDays=()=>{ const from=document.getElementById('lv-from').value, to=document.getElementById('lv-to').value; const prev=document.getElementById('lv-days-preview'); if(from&&to){ const days=Math.ceil((new Date(to)-new Date(from))/86400000)+1; if(days>0){ prev.style.display='block'; prev.textContent=`Duration: ${days} day(s) — from ${fmtDate(from)} to ${fmtDate(to)}`; } else prev.style.display='none'; } };
    document.getElementById('lv-from').onchange=calcDays; document.getElementById('lv-to').onchange=calcDays;
    document.getElementById('save-leave-btn').onclick=()=>this.saveLeave();
    this.openModal('m-leave');
  },

  saveLeave(){
    const staffId=document.getElementById('lv-staff').value; const type=document.getElementById('lv-type').value;
    const from=document.getElementById('lv-from').value; const to=document.getElementById('lv-to').value;
    const reason=document.getElementById('lv-reason').value.trim();
    const errEl=document.getElementById('lv-err');
    if(!staffId||!from||!to||!reason){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    if(new Date(to)<new Date(from)){ errEl.style.display='block'; errEl.textContent='End date must be on or after start date.'; return; }
    errEl.style.display='none';
    const days=Math.ceil((new Date(to)-new Date(from))/86400000)+1;
    const leaves=DB.get('leaves',[]);
    leaves.push({id:uid('l'),staffId,type,from,to,days,reason,status:'pending',appliedDate:new Date().toISOString()});
    DB.set('leaves',leaves);
    const s=DB.get('staff',[]).find(x=>x.id===staffId);
    this.audit('Leave Application','create',`${s?.fname} ${s?.lname} applied for ${type} leave (${days} days)`);
    this.toast(`Leave application submitted for ${s?.fname} ${s?.lname}`,'success');
    this.closeModal('m-leave'); this.renderLeave();
  },

  // ══ BOOK FORM ══
  openBookModal(id=null){
    ['bk-id','bk-isbn','bk-title','bk-author','bk-publisher','bk-location'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('bk-copies').value='1'; document.getElementById('bk-cat').value=''; document.getElementById('bk-err').style.display='none';
    document.getElementById('book-modal-title').textContent=id?'Edit Book':'Add Book';
    if(id){ const b=DB.get('books',[]).find(x=>x.id===id); if(!b) return; document.getElementById('bk-id').value=b.id; document.getElementById('bk-isbn').value=b.isbn||''; document.getElementById('bk-title').value=b.title; document.getElementById('bk-author').value=b.author; document.getElementById('bk-publisher').value=b.publisher||''; document.getElementById('bk-cat').value=b.category; document.getElementById('bk-copies').value=b.copies; document.getElementById('bk-location').value=b.location||''; }
    document.getElementById('save-book-btn').onclick=()=>this.saveBook();
    this.openModal('m-book');
  },

  saveBook(){
    if(!this.hasRole('admin','librarian')){ this.toast('You do not have permission to perform this action','error'); return; }
    const title=document.getElementById('bk-title').value.trim(); const author=document.getElementById('bk-author').value.trim(); const category=document.getElementById('bk-cat').value; const copies=+document.getElementById('bk-copies').value||1;
    const errEl=document.getElementById('bk-err');
    if(!title||!author||!category){ errEl.style.display='block'; errEl.textContent='Title, author, and category are required.'; return; }
    errEl.style.display='none';
    const books=DB.get('books',[]); const existId=document.getElementById('bk-id').value;
    const data={isbn:document.getElementById('bk-isbn').value,title,author,publisher:document.getElementById('bk-publisher').value,category,copies,location:document.getElementById('bk-location').value};
    if(existId){ const i=books.findIndex(b=>b.id===existId); if(i>-1){ const old=books[i]; const diff=copies-old.copies; books[i]={...old,...data,available:Math.max(0,old.available+diff)}; DB.set('books',books); this.toast('Book updated','success'); this.audit('Edit Book','edit',`Updated: ${title}`); } }
    else { books.push({id:uid('b'),...data,available:copies}); DB.set('books',books); this.audit('Add Book','create',`New book: ${title} by ${author} (${copies} copies)`); this.toast(`"${title}" added to library!`,'success'); }
    this.closeModal('m-book'); this.loadLibrary();
  },

  openBookIssueModal(preselect=null){
    const books=DB.get('books',[]); const students=DB.get('students',[]).filter(s=>s.status==='active'); const staff=DB.get('staff',[]); const issues=DB.get('bookIssues',[]).filter(i=>!i.returnedDate);
    const avail=books.filter(b=>b.available>0);
    const bkSel=document.getElementById('issue-book'); if(bkSel) bkSel.innerHTML='<option value="">— Select Book —</option>'+avail.map(b=>`<option value="${b.id}">${sanitize(b.title)} (${b.available} avail.)</option>`).join('');
    if(preselect&&bkSel) bkSel.value=preselect;
    const stSel=document.getElementById('issue-student'); if(stSel) stSel.innerHTML='<option value="">— Select Student —</option>'+students.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)} — ${this.className(s.classId)}</option>`).join('');
    const sfSel=document.getElementById('issue-staff-mem'); if(sfSel) sfSel.innerHTML='<option value="">— Select Staff —</option>'+staff.map(s=>`<option value="${s.id}">${sanitize(s.fname)} ${sanitize(s.lname)}</option>`).join('');
    document.getElementById('issue-date').value=new Date().toISOString().split('T')[0];
    const due=new Date(); due.setDate(due.getDate()+14); document.getElementById('issue-due').value=due.toISOString().split('T')[0];
    document.getElementById('issue-err').style.display='none';
    const retSel=document.getElementById('return-issue-sel');
    if(retSel) retSel.innerHTML='<option value="">— Select Record —</option>'+issues.map(i=>{ const b=DB.get('books',[]).find(x=>x.id===i.bookId); const borrower=i.borrowerType==='student'?students.find(x=>x.id===i.borrowerId):staff.find(x=>x.id===i.borrowerId); return `<option value="${i.id}">${sanitize(b?.title||'Book')} — ${borrower?sanitize(borrower.fname)+' '+sanitize(borrower.lname):'Unknown'} (Due: ${fmtDate(i.dueDate)})</option>`; }).join('');
    document.getElementById('return-preview').style.display='none';
    document.getElementById('return-issue-sel').onchange=()=>this.previewReturn();
    document.getElementById('confirm-issue-btn').onclick=()=>this.issueBook();
    document.getElementById('confirm-return-btn').onclick=()=>this.returnBook();
    this.openModal('m-book-issue');
  },

  toggleBorrowerType(){ const t=document.getElementById('issue-borrower-type')?.value; document.getElementById('issue-student-wrap').style.display=t==='student'?'block':'none'; document.getElementById('issue-staff-wrap').style.display=t==='staff'?'block':'none'; },

  issueBook(){
    const bookId=document.getElementById('issue-book').value; const borrowerType=document.getElementById('issue-borrower-type').value;
    const borrowerId=borrowerType==='student'?document.getElementById('issue-student').value:document.getElementById('issue-staff-mem').value;
    const issueDate=document.getElementById('issue-date').value; const dueDate=document.getElementById('issue-due').value;
    const errEl=document.getElementById('issue-err');
    if(!bookId||!borrowerId||!issueDate||!dueDate){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const books=DB.get('books',[]); const bi=books.findIndex(b=>b.id===bookId);
    if(bi>-1&&books[bi].available>0){ books[bi].available--; DB.set('books',books); } else { errEl.style.display='block'; errEl.textContent='Book is not available.'; return; }
    const issues=DB.get('bookIssues',[]); issues.push({id:uid('bi'),bookId,borrowerType,borrowerId,issueDate,dueDate,issuedBy:this.currentUser.id,returnedDate:null}); DB.set('bookIssues',issues);
    const b=books.find(x=>x.id===bookId); this.audit('Issue Book','create',`Issued: "${b?.title}" — due ${fmtDate(dueDate)}`);
    this.toast(`Book issued! Due: ${fmtDate(dueDate)}`,'success'); this.closeModal('m-book-issue'); this.loadLibrary();
  },

  previewReturn(){ const id=document.getElementById('return-issue-sel').value; const prev=document.getElementById('return-preview'); if(!id){ prev.style.display='none'; return; } const issue=DB.get('bookIssues',[]).find(x=>x.id===id); if(!issue){ prev.style.display='none'; return; } const b=DB.get('books',[]).find(x=>x.id===issue.bookId); const borrower=issue.borrowerType==='student'?DB.get('students',[]).find(x=>x.id===issue.borrowerId):DB.get('staff',[]).find(x=>x.id===issue.borrowerId); const overdue=new Date()>new Date(issue.dueDate); prev.style.display='block'; prev.innerHTML=`<div style="font-weight:700;margin-bottom:.35rem">${sanitize(b?.title||'—')}</div><div>Borrower: <strong>${borrower?sanitize(borrower.fname)+' '+sanitize(borrower.lname):'Unknown'}</strong></div><div>Issued: ${fmtDate(issue.issueDate)} · Due: <span style="color:${overdue?'var(--danger)':'var(--success)'};font-weight:700">${fmtDate(issue.dueDate)}${overdue?' ⚠ OVERDUE':''}</span></div>`; },

  returnBook(){ const id=document.getElementById('return-issue-sel').value; if(!id){ this.toast('Select a borrowing record','warn'); return; } const issues=DB.get('bookIssues',[]); const idx=issues.findIndex(x=>x.id===id); if(idx>-1){ issues[idx].returnedDate=new Date().toISOString(); DB.set('bookIssues',issues); const books=DB.get('books',[]); const bi=books.findIndex(b=>b.id===issues[idx].bookId); if(bi>-1){ books[bi].available=Math.min(books[bi].copies,books[bi].available+1); DB.set('books',books); } const b=books.find(x=>x.id===issues[idx].bookId); this.audit('Return Book','edit',`Returned: "${b?.title}"`); this.toast('Book returned successfully!','success'); this.closeModal('m-book-issue'); this.loadLibrary(); } },

  // ══ FEE STRUCTURE EDITOR ══
  openFeeStructModal(classId=null){
    const classes=DB.get('classes',[]); const feeStr=DB.get('feeStructure',[]);
    if(!classId){ document.getElementById('receipt-title').textContent='Select Class to Edit Fees'; document.getElementById('receipt-body').innerHTML=`<div style="margin-bottom:.75rem;font-size:.85rem;color:var(--t3)">Choose a class to edit its fee structure:</div><div style="display:flex;gap:.75rem;flex-wrap:wrap">${classes.map(c=>`<button class="btn btn-secondary btn-sm" onclick="SMS.openFeeStructModal('${c.id}');SMS.closeModal('m-receipt')">${sanitize(c.name)}</button>`).join('')}</div>`; this.openModal('m-receipt'); return; }
    const cls=classes.find(c=>c.id===classId); const fs=feeStr.find(f=>f.classId===classId)||{term1:0,term2:0,term3:0};
    document.getElementById('fs-class-id').value=classId; document.getElementById('fs-class-name').value=cls?.name||'';
    document.getElementById('fs-term1').value=fs.term1||''; document.getElementById('fs-term2').value=fs.term2||''; document.getElementById('fs-term3').value=fs.term3||'';
    document.getElementById('fs-includes').value=fs.includes||'Tuition, Books, Activities'; document.getElementById('fs-err').style.display='none';
    const titleEl=document.getElementById('fs-struct-modal-title')||document.querySelector('#m-fee-struct .modal-title'); if(titleEl) titleEl.textContent=`Fee Structure — ${cls?.name}`;
    const updatePreview=()=>{ const t1=+document.getElementById('fs-term1').value||0, t2=+document.getElementById('fs-term2').value||0, t3=+document.getElementById('fs-term3').value||0; document.getElementById('fs-total-preview').textContent=`Annual Total: ${fmt(t1+t2+t3)} (${fmt(t1)} + ${fmt(t2)} + ${fmt(t3)})`; };
    ['fs-term1','fs-term2','fs-term3'].forEach(id=>document.getElementById(id).oninput=updatePreview); updatePreview();
    document.getElementById('save-fee-struct-btn').onclick=()=>this.saveFeeStruct();
    this.openModal('m-fee-struct');
  },

  saveFeeStruct(){
    if(!this.hasRole('admin','accountant')){ this.toast('You do not have permission to perform this action','error'); return; }
    const classId=document.getElementById('fs-class-id').value; const t1=+document.getElementById('fs-term1').value; const t2=+document.getElementById('fs-term2').value; const t3=+document.getElementById('fs-term3').value;
    const errEl=document.getElementById('fs-err'); if(!classId||(!t1&&!t2&&!t3)){ errEl.style.display='block'; errEl.textContent='Please enter at least one term fee.'; return; } errEl.style.display='none';
    const feeStr=DB.get('feeStructure',[]); const i=feeStr.findIndex(f=>f.classId===classId);
    const data={classId,term1:t1,term2:t2,term3:t3,includes:document.getElementById('fs-includes').value};
    if(i>-1) feeStr[i]={...feeStr[i],...data}; else feeStr.push({id:uid('fs'),...data}); DB.set('feeStructure',feeStr);
    this.audit('Fee Structure','edit',`Updated fees for ${this.className(classId)}: T1=${fmt(t1)}, T2=${fmt(t2)}, T3=${fmt(t3)}`);
    this.toast(`Fee structure saved for ${this.className(classId)}!`,'success');
    this.closeModal('m-fee-struct'); this.renderFeeStructure(); this.renderFeesKpis(); this.renderDefaulters(); this.renderStudents();
  },

  // ══════════════════════════════════════════
  //  TIMETABLE DESIGNER
  // ══════════════════════════════════════════

  // Default structure — used when no custom one is saved
  _defaultTTStructure(){
    return {
      days: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
      periods: [
        {id:'p1', label:'Period 1', from:'07:30', to:'08:30', isBreak:false},
        {id:'p2', label:'Period 2', from:'08:30', to:'09:30', isBreak:false},
        {id:'p3', label:'Period 3', from:'09:30', to:'10:30', isBreak:false},
        {id:'pb', label:'Break',    from:'10:30', to:'11:00', isBreak:true},
        {id:'p4', label:'Period 4', from:'11:00', to:'12:00', isBreak:false},
        {id:'p5', label:'Period 5', from:'12:00', to:'13:00', isBreak:false},
        {id:'p6', label:'Period 6', from:'13:00', to:'14:00', isBreak:false},
      ]
    };
  },

  getTTStructure(){
    return DB.get('ttStructure', null) || this._defaultTTStructure();
  },

  openTimetableDesigner(){
    const classes = DB.get('classes',[]);
    // Populate class selects in tabs 2 & 3
    const opts = '<option value="">— Select Class —</option>' + classes.map(c=>`<option value="${c.id}">${sanitize(c.name)}</option>`).join('');
    document.getElementById('tt-fill-class').innerHTML = opts;
    document.getElementById('tt-preview-class').innerHTML = opts;

    // Reset to tab 1
    this._ttTab('structure', document.querySelector('#m-tt-designer .mtab'));

    this._renderTTDays();
    this._renderTTPeriods();
    this.openModal('m-tt-designer');
  },

  _ttTab(name, btn){
    document.querySelectorAll('#m-tt-designer .modal-tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('#m-tt-designer .mtab').forEach(b=>b.classList.remove('active'));
    document.getElementById('tt-tab-'+name).classList.add('active');
    if(btn) btn.classList.add('active');
    // Save button only relevant on tab 1
    document.getElementById('tt-save-structure-btn').style.display = name==='structure'?'':'none';
    if(name==='slots') this.renderTTFillGrid();
    if(name==='preview') this.renderTTPreview();
  },

  _renderTTDays(){
    const struct = this.getTTStructure();
    const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    document.getElementById('tt-days-list').innerHTML = allDays.map(d=>`
      <label style="display:flex;align-items:center;gap:.6rem;padding:.45rem .6rem;border-radius:7px;cursor:pointer;background:var(--surface-2);font-size:.85rem;font-weight:500;color:var(--t1)">
        <input type="checkbox" id="ttd-${d}" value="${d}" ${struct.days.includes(d)?'checked':''} onchange="SMS._syncTTDays()" style="width:16px;height:16px;accent-color:var(--brand)">
        ${d}
      </label>`).join('');
  },

  _syncTTDays(){
    // No-op — days read on save. Just visual feedback.
  },

  _renderTTPeriods(){
    const struct = this.getTTStructure();
    const list = document.getElementById('tt-periods-list');
    list.innerHTML = struct.periods.map((p,i)=>`
      <div id="tt-period-row-${p.id}" style="display:grid;grid-template-columns:auto 1fr 80px 80px auto auto;gap:.4rem;align-items:center;background:${p.isBreak?'rgba(245,158,11,.08)':'var(--surface-2)'};border:1px solid ${p.isBreak?'rgba(245,158,11,.35)':'var(--border)'};border-radius:8px;padding:.5rem .6rem">
        <div style="cursor:grab;color:var(--t4);padding:0 .2rem" title="Drag to reorder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
        <input class="form-input" style="height:32px;font-size:.82rem;padding:.2rem .5rem" value="${p.label}" id="ttpl-${p.id}" placeholder="Label (e.g. Period 1)">
        <input type="time" class="form-input" style="height:32px;font-size:.79rem;padding:.2rem .4rem" value="${p.from}" id="ttpf-${p.id}">
        <input type="time" class="form-input" style="height:32px;font-size:.79rem;padding:.2rem .4rem" value="${p.to}" id="ttpt-${p.id}">
        <label style="display:flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:600;color:var(--warn);white-space:nowrap;cursor:pointer" title="Mark as break (non-editable row)">
          <input type="checkbox" id="ttpb-${p.id}" ${p.isBreak?'checked':''} onchange="SMS._renderTTPeriods()" style="accent-color:var(--warn)"> Break
        </label>
        <button onclick="SMS.ttRemovePeriod('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--danger);padding:.2rem .3rem;border-radius:4px;display:flex;align-items:center" title="Remove period"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>`).join('');

    // Enable drag-to-reorder
    this._initPeriodDrag();
  },

  _initPeriodDrag(){
    const list = document.getElementById('tt-periods-list');
    let dragging = null;
    list.querySelectorAll('[style*="cursor:grab"]').forEach(handle=>{
      const row = handle.closest('[id^="tt-period-row-"]');
      row.setAttribute('draggable','true');
      row.addEventListener('dragstart',()=>{ dragging=row; row.style.opacity='.4'; });
      row.addEventListener('dragend',()=>{ row.style.opacity='1'; dragging=null; });
      row.addEventListener('dragover',e=>{ e.preventDefault(); if(dragging&&dragging!==row){ const after=row.getBoundingClientRect().top+row.offsetHeight/2>e.clientY; list.insertBefore(dragging,after?row:row.nextSibling); } });
    });
  },

  ttAddPeriod(){
    const struct = this.getTTStructure();
    const newId = 'p'+Date.now();
    // Suggest next time from last period
    const last = struct.periods[struct.periods.length-1];
    const nextFrom = last?.to || '07:30';
    const [h,m] = nextFrom.split(':').map(Number);
    const nextTo = `${String(h+(m===30?1:0)).padStart(2,'0')}:${m===30?'00':'30'}`;
    struct.periods.push({id:newId, label:`Period ${struct.periods.filter(p=>!p.isBreak).length+1}`, from:nextFrom, to:nextTo, isBreak:false});
    DB.set('ttStructure',struct);
    this._renderTTPeriods();
    // Scroll to bottom
    setTimeout(()=>{ const el=document.getElementById('tt-periods-list'); el.scrollTop=el.scrollHeight; },50);
  },

  ttRemovePeriod(id){
    const struct = this.getTTStructure();
    struct.periods = struct.periods.filter(p=>p.id!==id);
    DB.set('ttStructure',struct);
    this._renderTTPeriods();
  },

  saveTTStructure(){
    // Read days
    const allDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const days = allDays.filter(d=>document.getElementById('ttd-'+d)?.checked);
    if(days.length===0){ this.toast('Select at least one day','warn'); return; }

    // Read periods from DOM (in current drag order)
    const rows = document.querySelectorAll('#tt-periods-list > div[id^="tt-period-row-"]');
    const periods = [];
    rows.forEach(row=>{
      const id = row.id.replace('tt-period-row-','');
      const label = document.getElementById('ttpl-'+id)?.value.trim() || 'Period';
      const from  = document.getElementById('ttpf-'+id)?.value || '00:00';
      const to    = document.getElementById('ttpt-'+id)?.value || '00:00';
      const isBreak = document.getElementById('ttpb-'+id)?.checked || false;
      periods.push({id, label, from, to, isBreak});
    });
    if(periods.length===0){ this.toast('Add at least one period','warn'); return; }

    DB.set('ttStructure',{days,periods});
    this.toast('Timetable structure saved!','success');
    this.renderTimetable(); // Refresh main view
    this._ttTab('slots', document.querySelectorAll('#m-tt-designer .mtab')[1]);
  },

  // ── Fill Subjects Grid (Tab 2) ──
  renderTTFillGrid(){
    const classId = document.getElementById('tt-fill-class').value;
    const grid = document.getElementById('tt-fill-grid');
    if(!classId){ grid.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--t4);font-size:.85rem">Select a class to fill in subjects</div>'; return; }

    const struct = this.getTTStructure();
    const timetable = DB.get('timetable',{});
    const classData = timetable[classId]||{};
    const subjects = DB.get('subjects',[]).filter(s=>!s.classId||s.classId===classId);
    const staff = DB.get('staff',[]);

    const subjOpts = subjects.map(s=>`<option value="${sanitize(s.name)}">`).join('');
    const staffOpts = staff.map(s=>`<option value="${s.fname+' '+s.lname}">`).join('');
    const datalists = `<datalist id="ttf-subj-dl">${subjOpts}</datalist><datalist id="ttf-staff-dl">${staffOpts}</datalist>`;

    let html = datalists + `<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:var(--surface-2)">
        <th style="padding:.5rem .7rem;font-weight:700;color:var(--t2);text-align:left;white-space:nowrap;border:1px solid var(--border);min-width:120px">Period</th>
        ${struct.days.map(d=>`<th style="padding:.5rem .7rem;font-weight:700;color:var(--t2);text-align:center;border:1px solid var(--border);min-width:140px">${d}</th>`).join('')}
      </tr></thead><tbody>`;

    struct.periods.forEach(p=>{
      const label = p.label + (p.from&&p.to ? `<div style="font-size:.7rem;font-weight:400;color:var(--t3)">${p.from}–${p.to}</div>` : '');
      if(p.isBreak){
        html += `<tr><td style="padding:.4rem .7rem;background:var(--surface-2);font-weight:600;font-size:.75rem;color:var(--warn);text-align:center;border:1px solid var(--border)">${p.label}</td>
          ${struct.days.map(()=>`<td style="background:var(--surface-2);border:1px solid var(--border);text-align:center;color:var(--t4);font-size:.72rem;letter-spacing:.05em">BREAK</td>`).join('')}</tr>`;
        return;
      }
      html += `<tr><td style="padding:.4rem .7rem;border:1px solid var(--border);background:var(--surface-2)">${label}</td>`;
      struct.days.forEach(day=>{
        const slot = classData[day]?.[p.id]||{};
        html += `<td style="padding:.3rem;border:1px solid var(--border);vertical-align:top">
          <input list="ttf-subj-dl" class="form-input" style="height:28px;font-size:.75rem;padding:.15rem .4rem;margin-bottom:.25rem" placeholder="Subject…" value="${slot.subject||''}" id="ttf-subj-${classId}-${day.slice(0,3)}-${p.id}" oninput="SMS._ttAutoSaveSlot('${classId}','${day}','${p.id}')">
          <input list="ttf-staff-dl" class="form-input" style="height:26px;font-size:.72rem;padding:.12rem .4rem;color:var(--t3)" placeholder="Teacher…" value="${slot.teacher||''}" id="ttf-tchr-${classId}-${day.slice(0,3)}-${p.id}" oninput="SMS._ttAutoSaveSlot('${classId}','${day}','${p.id}')">
        </td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    grid.innerHTML = html;
  },

  _ttAutoSaveSlot(classId, day, periodId){
    const subjEl = document.getElementById(`ttf-subj-${classId}-${day.slice(0,3)}-${periodId}`);
    const tchrEl = document.getElementById(`ttf-tchr-${classId}-${day.slice(0,3)}-${periodId}`);
    if(!subjEl) return;
    const subj = subjEl.value.trim();
    const tchr = tchrEl?.value.trim()||'';
    const timetable = DB.get('timetable',{});
    if(!timetable[classId]) timetable[classId]={};
    if(!timetable[classId][day]) timetable[classId][day]={};
    if(subj) timetable[classId][day][periodId]={subject:subj,teacher:tchr};
    else delete timetable[classId][day][periodId];
    DB.set('timetable',timetable);
  },

  ttClearSlots(){
    const classId = document.getElementById('tt-fill-class').value;
    if(!classId){ this.toast('Select a class first','warn'); return; }
    this.confirmDelete(`Clear all timetable slots for ${this.className(classId)}?`,()=>{
      const timetable = DB.get('timetable',{});
      delete timetable[classId];
      DB.set('timetable',timetable);
      this.renderTTFillGrid();
      this.renderTimetable();
      this.toast('Slots cleared','warn');
    });
  },

  // ── Preview (Tab 3) ──
  renderTTPreview(){
    const classId = document.getElementById('tt-preview-class').value;
    const grid = document.getElementById('tt-preview-grid');
    if(!classId){ grid.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--t4);font-size:.85rem">Select a class to preview</div>'; return; }
    grid.innerHTML = this._buildTTTable(classId, false);
  },

  // ── Main timetable grid renderer ──
  _buildTTTable(classId, editable=true){
    const struct = this.getTTStructure();
    const timetable = DB.get('timetable',{});
    const classData = timetable[classId]||{};

    if(!classId) return '<div style="padding:2rem;text-align:center;color:var(--t4)">Select a class to view timetable</div>';

    const cls = DB.get('classes',[]).find(c=>c.id===classId);
    const teachingPeriods = struct.periods.filter(p=>!p.isBreak).length;

    let html = `<div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
      <div>
        <div style="font-size:.95rem;font-weight:700;color:var(--t1)">${cls?.name||''} &mdash; Weekly Schedule</div>
        <div style="font-size:.75rem;color:var(--t3);margin-top:.2rem">${struct.days.length} day${struct.days.length!==1?'s':''} &middot; ${teachingPeriods} teaching period${teachingPeriods!==1?'s':''}</div>
      </div>
      ${editable?`<div style="font-size:.75rem;color:var(--t3);display:flex;align-items:center;gap:.3rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Click any cell to assign a subject</div>`:''}
    </div>
    <div style="overflow-x:auto">
    <table class="tt-table">
      <thead><tr>
        <th style="text-align:left">Period</th>
        ${struct.days.map(d=>`<th>${d}</th>`).join('')}
      </tr></thead><tbody>`;

    struct.periods.forEach(p=>{
      const timeLabel = p.from&&p.to ? `<div style="font-size:.68rem;font-weight:400;color:var(--t3);margin-top:.15rem">${p.from}&ndash;${p.to}</div>` : '';
      if(p.isBreak){
        html += `<tr>
          <td class="tt-time-col" style="background:rgba(245,158,11,.06);color:var(--warn)">${p.label}${timeLabel}</td>
          ${struct.days.map(()=>`<td style="background:rgba(245,158,11,.05);text-align:center"><span style="font-size:.7rem;font-weight:700;color:var(--warn);letter-spacing:.09em;text-transform:uppercase">Break</span></td>`).join('')}
        </tr>`;
        return;
      }
      html += `<tr><td class="tt-time-col">${p.label}${timeLabel}</td>`;
      struct.days.forEach(day=>{
        const slot = classData[day]?.[p.id];
        const penc = encodeURIComponent(p.id);
        if(editable){
          if(slot?.subject){
            html += `<td style="padding:.35rem" onclick="SMS.openTimetableSlot('${classId}','${day}','${penc}')" style="cursor:pointer">
              <div class="tt-slot-card">
                <div class="subj">${slot.subject}</div>
                ${slot.teacher?`<div class="tchr">${slot.teacher}</div>`:''}
              </div></td>`;
          } else {
            html += `<td style="padding:.3rem;text-align:center"><button class="tt-empty-slot" onclick="SMS.openTimetableSlot('${classId}','${day}','${penc}')" title="Assign subject">+</button></td>`;
          }
        } else {
          if(slot?.subject){
            html += `<td style="padding:.45rem .6rem">
              <div style="font-weight:700;font-size:.8rem;color:var(--t1)">${slot.subject}</div>
              ${slot.teacher?`<div style="font-size:.68rem;color:var(--t3);margin-top:.1rem">${slot.teacher}</div>`:''}
            </td>`;
          } else {
            html += `<td></td>`;
          }
        }
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
  },

});