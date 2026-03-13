// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Staff — loadStaff · renderStaff · save · delete · export
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadStaff(){
    const depts=[...new Set(DB.get('staff',[]).map(s=>s.dept).filter(Boolean))];
    const df=document.getElementById('staff-dept-f'); if(df) df.innerHTML='<option value="">All Departments</option>'+depts.map(d=>`<option value="${sanitize(d)}">${sanitize(d)}</option>`).join('');
    this.renderStaffStats(); this.renderStaff();
  },

  renderStaffStats(){
    const staff=DB.get('staff',[]);
    const stats=[{val:staff.length,lbl:'Total Staff'},{val:staff.filter(s=>s.role==='teacher').length,lbl:'Teachers'},{val:staff.filter(s=>s.role==='admin').length,lbl:'Admin'},{val:staff.filter(s=>s.status==='active').length,lbl:'Active'}];
    document.getElementById('staff-stats').innerHTML=stats.map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderStaff(){
    const staff=DB.get('staff',[]);
    const q=(document.getElementById('staff-search')?.value||'').toLowerCase();
    const df=document.getElementById('staff-dept-f')?.value||'';
    const rf=document.getElementById('staff-role-f')?.value||'';
    let filtered=staff.filter(s=>{ if(df&&s.dept!==df) return false; if(rf&&s.role!==rf) return false; if(q&&!`${sanitize(s.fname)} ${sanitize(s.lname)} ${s.subjects||''}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('staff-tbody').innerHTML=filtered.map(s=>`<tr>
      <td style="font-family:monospace;font-size:.75rem;color:var(--t3)">${s.id.toUpperCase()}</td>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${s.fname[0]}${s.lname[0]}</div><div><div style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</div><div style="font-size:.73rem;color:var(--t4)">${s.qualification||''}</div></div></div></td>
      <td><span class="badge badge-info">${sanitize(s.role)}</span></td>
      <td>${s.dept||'—'}</td>
      <td style="font-size:.78rem;color:var(--t3)">${s.subjects||'—'}</td>
      <td>${sanitize(s.phone)}</td>
      <td style="font-weight:600;color:var(--brand)">${fmt(s.salary)}</td>
      <td>${statusBadge(s.status||'active')}</td>
      <td><div style="display:flex;gap:.3rem">${SMS.hasRole('admin')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openStaffModal('${s.id}')" style="padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Remove staff member ${sanitize(s.fname)} ${sanitize(s.lname)}?',()=>SMS.deleteStaff('${s.id}'))" style="padding:.3rem .5rem;color:var(--danger)" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:''}</div></td>
    </tr>`).join('')||SMS._emptyState('staff','No Staff Members Found','Add your first staff member or adjust your search filters.','+ Add Staff',"SMS.openStaffModal()");
  },

  openStaffModal(id=null){
    const classes=DB.get('classes',[]); // for class teacher dropdown in class modal
    ['stf-id','stf-fname','stf-lname','stf-id-no','stf-dept','stf-subjects','stf-phone','stf-email','stf-salary','stf-qual','stf-nid','stf-addr','stf-dob','stf-join'].forEach(f=>{ const e=document.getElementById(f); if(e) e.value=''; });
    document.getElementById('stf-role').value=''; document.getElementById('stf-gender').value='';
    document.getElementById('stf-err').style.display='none';
    document.getElementById('staff-modal-title').textContent='Add Staff Member';
    document.getElementById('save-staff-btn').textContent='Save Staff';
    document.getElementById('stf-join').value=new Date().toISOString().split('T')[0];
    if(id){
      const s=DB.get('staff',[]).find(x=>x.id===id); if(!s) return;
      document.getElementById('stf-id').value=s.id;
      ['fname','lname','dept','subjects','phone','email','qualification','nid','addr','dob'].forEach(f=>{ const e=document.getElementById('stf-'+f); if(e) e.value=s[f]||''; });
      document.getElementById('stf-id-no').value=s.id;
      document.getElementById('stf-salary').value=s.salary||'';
      document.getElementById('stf-role').value=s.role||'';
      document.getElementById('stf-gender').value=s.gender||'';
      document.getElementById('stf-join').value=s.joinDate||'';
      document.getElementById('staff-modal-title').textContent='Edit Staff';
      document.getElementById('save-staff-btn').textContent='Save Changes';
    }
    this.openModal('m-staff');
  },

  saveStaff(){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; }
    const fname=document.getElementById('stf-fname').value.trim();
    const lname=document.getElementById('stf-lname').value.trim();
    const role=document.getElementById('stf-role').value;
    const phone=document.getElementById('stf-phone').value.trim();
    const join=document.getElementById('stf-join').value;
    const errEl=document.getElementById('stf-err');
    if(!fname||!lname||!role||!phone||!join){ errEl.style.display='block'; errEl.textContent='Please fill in all required fields.'; return; }
    errEl.style.display='none';
    const staff=DB.get('staff',[]);
    const existingId=document.getElementById('stf-id').value;
    const data={fname,lname,role,dept:document.getElementById('stf-dept').value,subjects:document.getElementById('stf-subjects').value,phone,email:document.getElementById('stf-email').value,salary:+document.getElementById('stf-salary').value||0,qualification:document.getElementById('stf-qual').value,nid:document.getElementById('stf-nid').value,addr:document.getElementById('stf-addr').value,dob:document.getElementById('stf-dob').value,joinDate:join,gender:document.getElementById('stf-gender').value,status:'active'};
    if(existingId){ const i=staff.findIndex(s=>s.id===existingId); if(i>-1){ staff[i]={...staff[i],...data}; DB.set('staff',staff); this.audit('Edit Staff','edit',`Updated: ${fname} ${lname}`); this.toast('Staff updated','success'); } }
    else { const ns={id:uid('stf'),...data}; staff.push(ns); DB.set('staff',staff); this.audit('Add Staff','create',`New staff: ${fname} ${lname} (${role})`); this.toast(`${fname} ${lname} added to staff`,'success'); }
    this.closeModal('m-staff'); this.renderStaff(); this.renderStaffStats();
  },

  deleteStaff(id){
    if(!this.hasRole('admin')){ this.toast('You do not have permission to perform this action','error'); return; } const staff=DB.get('staff',[]); const s=staff.find(x=>x.id===id); DB.set('staff',staff.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'staff',id).catch(()=>{}); this.audit('Delete Staff','delete',`Removed: ${s?.fname} ${s?.lname}`); this.toast('Staff removed','warn'); this.renderStaff(); },

  exportStaff(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const staff=DB.get('staff',[]);
    const data=staff.map(s=>({'Staff ID':s.id,'First Name':s.fname,'Last Name':s.lname,'Role':s.role,'Department':s.dept,'Subjects':s.subjects,'Phone':s.phone,'Email':s.email,'Salary':s.salary,'Join Date':s.joinDate,'Status':s.status}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Staff');
    XLSX.writeFile(wb,`Staff_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Staff exported','success');
  },

  // ══ CLASSES ══
});
