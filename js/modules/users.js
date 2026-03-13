// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Users & Backup
//  renderUsers · openUserModal · deleteUser · exportBackup · renderBackupStats
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadAppearanceSettings(){
    const dark=DB.get('darkMode',false);
    const tog=document.getElementById('dark-mode-toggle'); if(tog) tog.checked=dark;
    const savedColors=DB.get('themeColors');
    if(savedColors){
      const cp=document.getElementById('custom-primary'); if(cp) cp.value=savedColors.primary||'';
      const cph=document.getElementById('custom-primary-hex'); if(cph) cph.value=savedColors.primary||'';
      const ct=document.getElementById('custom-teal'); if(ct) ct.value=savedColors.teal||'';
      const cth=document.getElementById('custom-teal-hex'); if(cth) cth.value=savedColors.teal||'';
      const savedName=savedColors.name;
      if(savedName){ document.querySelectorAll('.swatch').forEach(sw=>sw.classList.toggle('active',sw.dataset.themeName===savedName)); }
    }
    const savedFont=DB.get('fontSize'); if(savedFont) document.querySelectorAll('.fsz-btn').forEach(b=>b.classList.toggle('active',b.dataset.size===savedFont));
  },

  loadSmsSettings(){
    const s=DB.get('smsSettings',{});
    const prov=document.getElementById('sms-provider'); if(prov&&s.provider) prov.value=s.provider;
    const sender=document.getElementById('sms-sender'); if(sender) sender.value=s.sender||'';
    const key=document.getElementById('sms-key'); if(key) key.value=s.key||'';
    const secret=document.getElementById('sms-secret'); if(secret) secret.value=s.secret||'';
    const master=document.getElementById('sms-master'); if(master) master.checked=!!s.masterEnabled;
    const toggles={admission:'smt-admission',fee:'smt-fee',reminder:'smt-reminder',results:'smt-results',attendance:'smt-attendance',events:'smt-events'};
    // admission/fee/reminder/attendance default ON; results/events default OFF
    const defaultOn=new Set(['admission','fee','reminder','attendance']);
    Object.entries(toggles).forEach(([k,id])=>{ const el=document.getElementById(id); if(!el) return; const stored=s[`notify${k.charAt(0).toUpperCase()+k.slice(1)}`]; el.checked=stored!==undefined?!!stored:defaultOn.has(k); });
    this._updateSmsBadge(s);
  },

  _updateSmsBadge(settings){
    const badge=document.getElementById('sms-status-badge');
    const testBtn=document.getElementById('test-sms-btn');
    const configured=settings&&settings.configured&&settings.key;
    const active=configured&&settings.masterEnabled;
    if(badge){
      if(active){ badge.textContent='Active'; badge.style.background='var(--success)'; badge.style.color='#fff'; }
      else if(configured){ badge.textContent='Configured'; badge.style.background='var(--warn)'; badge.style.color='#fff'; }
      else { badge.textContent='Disabled'; badge.style.background='var(--surface-3)'; badge.style.color='var(--t3)'; }
    }
    if(testBtn){
      const sp=testBtn.querySelector('.badge');
      if(configured){ if(sp){ sp.textContent='Ready'; sp.className='badge badge-success'; } testBtn.disabled=false; }
      else { if(sp){ sp.textContent='Setup Required'; sp.className='badge badge-warn'; } }
    }
  },

  renderUsers(){
    const users=DB.get('users',[]);
    const _hasFirebase=!!(window.SMS&&window.SMS.schoolId&&window.FAuth);
    document.getElementById('users-tbody').innerHTML=users.map(u=>{
      const initials=u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
      const roleBadge=u.role==='admin'?'badge-brand':u.role==='teacher'?'badge-info':u.role==='accountant'?'badge-warn':'badge-secondary';
      const roleLabel=u.role==='admin'?'Admin':u.role==='teacher'?'Teacher':u.role==='accountant'?'Accountant':u.role==='librarian'?'Librarian':'Staff';
      const isSelf=u.id===this.currentUser.id;
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:.6rem"><div class="mini-av" style="background:var(--brand-lt);color:var(--brand)">${initials}</div><div><div style="font-weight:600">${sanitize(u.name)}</div>${u.phone?`<div style="font-size:.75rem;color:var(--t4)">${sanitize(u.phone)}</div>`:''}</div></div></td>
        <td style="font-size:.8rem">${sanitize(u.email)}</td>
        <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
        <td style="font-size:.78rem;color:var(--t4)">${u.lastLogin?fmtDate(u.lastLogin):'Never'}</td>
        <td>${statusBadge(u.status||'active')}</td>
        <td><div style="display:flex;gap:.3rem;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" title="Edit user" onclick="SMS.openEditUserModal('${u.id}')" style="padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${_hasFirebase&&!isSelf?`<button class="btn btn-ghost btn-sm" title="Send password reset email" onclick="SMS.resetUserPassword('${sanitize(u.email)}')" style="padding:.3rem .5rem;color:var(--brand)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>`:''}
          ${!isSelf?`<button class="btn btn-ghost btn-sm" title="Remove user" onclick="SMS.confirmDeleteUser('${u.id}')" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:''}
        </div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--t4);padding:2rem">No users yet. Click “+ Add User” to get started.</td></tr>';
  },

  openUserModal(){
    ['uf-id','uf-name','uf-email','uf-pwd','uf-phone'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('uf-role').value='staff';
    document.getElementById('uf-err').style.display='none';
    document.getElementById('user-modal-title').textContent='Add New User';
    const emailField=document.getElementById('uf-email'); if(emailField) emailField.disabled=false;
    const pwdField=document.getElementById('uf-pwd'); if(pwdField){ pwdField.parentElement.style.display=''; pwdField.placeholder='Min. 8 characters'; }
    document.getElementById('save-user-btn').textContent='Create User';
    this.openModal('m-user');
  },

  openEditUserModal(id){
    const users=DB.get('users',[]);
    const u=users.find(x=>x.id===id);
    if(!u) return;
    document.getElementById('uf-id').value=u.id;
    document.getElementById('uf-name').value=u.name;
    document.getElementById('uf-email').value=u.email;
    if(document.getElementById('uf-phone')) document.getElementById('uf-phone').value=u.phone||'';
    document.getElementById('uf-role').value=u.role||'staff';
    document.getElementById('uf-err').style.display='none';
    document.getElementById('user-modal-title').textContent='Edit User';
    const emailField=document.getElementById('uf-email'); if(emailField) emailField.disabled=true;
    const pwdWrap=document.getElementById('uf-pwd')?.parentElement; if(pwdWrap) pwdWrap.style.display='none';
    document.getElementById('save-user-btn').textContent='Save Changes';
    this.openModal('m-user');
  },

  async resetUserPassword(email){
    if(!window.FAuth){ this.toast('Firebase not available','warn'); return; }
    const result=await FAuth.sendPasswordReset(email);
    if(result.success){
      this.toast(`Password reset email sent to ${email}`,'success');
      this.audit('Security','settings',`Password reset email sent to ${email}`);
    } else {
      this.toast(result.error||'Could not send reset email','error');
    }
  },

  async saveUser(){
    const id=document.getElementById('uf-id').value;
    const name=document.getElementById('uf-name').value.trim();
    const email=document.getElementById('uf-email').value.trim();
    const pwd=document.getElementById('uf-pwd').value;
    const role=document.getElementById('uf-role').value;
    const phone=document.getElementById('uf-phone')?.value.trim()||'';
    const errEl=document.getElementById('uf-err');
    const saveBtn=document.getElementById('save-user-btn');

    // ── EDIT MODE ──
    if(id){
      errEl.style.display='none';
      if(!name){ errEl.style.display='block'; errEl.textContent='Name is required.'; return; }
      const users=DB.get('users',[]);
      const idx=users.findIndex(u=>u.id===id);
      if(idx>-1){
        users[idx].name=name; users[idx].role=role; users[idx].phone=phone;
        DB.set('users',users);
        const _sid=window.SMS&&window.SMS.schoolId;
        if(_sid&&window.FDB){
          FDB.batchWrite(_sid,'users',[users[idx]]).catch(()=>{});
          FDB.setUserIndex(users[idx].email,_sid,users[idx].id,name,role).catch(()=>{});
        }
        this.audit('Edit User','edit',`Updated user: ${name} (${role})`);
        this.toast('User updated!','success');
        this.closeModal('m-user');
        this.renderUsers();
      }
      return;
    }

    // ── CREATE MODE ──
    if(!name||!email||!pwd){ errEl.style.display='block'; errEl.textContent='Name, email and password are required.'; return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ errEl.style.display='block'; errEl.textContent='Please enter a valid email address.'; return; }
    if(pwd.length<8){ errEl.style.display='block'; errEl.textContent='Password must be at least 8 characters.'; return; }
    const users=DB.get('users',[]);
    if(users.find(u=>u.email===email)){ errEl.style.display='block'; errEl.textContent='A user with this email already exists.'; return; }

    saveBtn.disabled=true;
    const _origLabel=saveBtn.textContent;
    saveBtn.innerHTML='<span style="display:inline-flex;align-items:center;gap:.4rem"><svg style="animation:spin 1s linear infinite;width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Creating…</span>';
    errEl.style.display='none';

    const passwordHash=await hashPassword(pwd);
    let firebaseUid=null;
    const _sid=window.SMS&&window.SMS.schoolId;

    // Try to create a real Firebase Auth account so the user can log in properly
    if(window.FAuth && _sid){
      const createResult=await FAuth.createSubUser(email,pwd);
      if(!createResult.success){
        errEl.style.display='block';
        errEl.textContent=createResult.error;
        saveBtn.disabled=false; saveBtn.textContent=_origLabel;
        return;
      }
      firebaseUid=createResult.uid;
    }

    const newUser={id:firebaseUid||uid('u'),email,passwordHash,name,role,phone,createdAt:new Date().toISOString(),lastLogin:null};
    users.push(newUser);
    DB.set('users',users);

    if(_sid&&window.FDB){
      // SECURITY: Strip passwordHash before writing to Supabase — credentials live in Supabase Auth only
      const {passwordHash:_omit,...supabaseUser}=newUser;
      FDB.batchWrite(_sid,'users',[supabaseUser]).catch(()=>{});
      FDB.setUserIndex(email,_sid,newUser.id,name,role).catch(()=>{});
    }

    saveBtn.disabled=false; saveBtn.textContent=_origLabel;
    this.audit('Add User','create',`New user: ${name} (${role})`);
    this.toast(`✓ ${name} can now log in with ${email}`,'success');
    this.closeModal('m-user');
    this.renderUsers();
  },

  confirmDeleteUser(id){ const u=DB.get('users',[]).find(x=>x.id===id); if(!u) return; this.confirmDelete(`Remove user "${sanitize(u.name)}"? This cannot be undone.`,()=>this.deleteUser(id)); },

  deleteUser(id){ const users=DB.get('users',[]); const u=users.find(x=>x.id===id); DB.set('users',users.filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB){ FDB.delete(_sid,'users',id).catch(()=>{}); if(u?.email) FDB.deleteUserIndex(u.email).catch(()=>{}); } this.audit('Delete User','delete',`Removed user: ${u?.name}`); this.toast('User removed','warn'); this.renderUsers(); },

  renderBackupStats(){
    const s=DB.get('students',[]); const st=DB.get('staff',[]); const fp=DB.get('feePayments',[]); const al=DB.get('auditLog',[]);
    document.getElementById('backup-stats').innerHTML=[{val:s.length,lbl:'Students'},{val:st.length,lbl:'Staff'},{val:fp.length,lbl:'Payments'},{val:al.length,lbl:'Audit Entries'}].map(x=>`<div class="data-stat"><div class="data-stat-val">${x.val}</div><div class="data-stat-lbl">${x.lbl}</div></div>`).join('');
  },

  exportBackup(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const wb=XLSX.utils.book_new();
    const schoolMeta={...DB.get('school',{})}; delete schoolMeta.logo;
    const sheets={
      'School Settings':[schoolMeta],
      Students:DB.get('students',[]),
      Classes:DB.get('classes',[]),
      Staff:DB.get('staff',[]),
      'Fee Payments':DB.get('feePayments',[]),
      'Fee Structure':DB.get('feeStructure',[]),
      Attendance:DB.get('attendance',[]),
      Exams:DB.get('exams',[]),
      Homework:DB.get('homework',[]),
      Timetable:DB.get('timetable',[]),
      Library:DB.get('libraryBooks',[]),
      'Leave Requests':DB.get('leaveRequests',[]),
      Events:DB.get('events',[]),
      Expenses:DB.get('expenses',[]),
      Messages:DB.get('messages',[]),
      'Audit Log':DB.get('auditLog',[]),
    };
    Object.entries(sheets).forEach(([name,data])=>{
      const rows=Array.isArray(data)?data:[data];
      const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{}]);
      XLSX.utils.book_append_sheet(wb,ws,name);
    });
    XLSX.writeFile(wb,`BackupFull_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.audit('Backup','settings','Full database backup downloaded');
    this.toast('Full backup downloaded!','success');
  },

  uploadLogo(e){ const file=e.target.files[0]; if(!file) return; if(file.size>500*1024){ this.toast('Logo file is too large — please use an image under 500 KB.','danger'); e.target.value=''; return; } const reader=new FileReader(); reader.onload=ev=>{ const preview=document.getElementById('school-logo-preview'); if(preview) preview.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:50%">`; const topbarLogo=document.getElementById('topbar-logo-img'); if(topbarLogo) topbarLogo.src=ev.target.result; const sidebarLogo=document.getElementById('sidebar-logo-img'); if(sidebarLogo) sidebarLogo.src=ev.target.result; const school=DB.get('school',{}); school.logo=ev.target.result; DB.set('school',school); this.audit('Settings','settings','School logo updated'); this.toast('Logo uploaded!','success'); }; reader.readAsDataURL(file); },

  uploadAvatar(e){ const file=e.target.files[0]; if(!file) return; if(!file.type.startsWith('image/')){ this.toast('Please upload a valid image file (PNG, JPG, etc.).','danger'); e.target.value=''; return; } if(file.size>500*1024){ this.toast('Profile photo is too large — please use an image under 500 KB.','danger'); e.target.value=''; return; } const reader=new FileReader(); reader.onload=ev=>{ const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===this.currentUser.id); if(i>-1){ users[i].avatar=ev.target.result; DB.set('users',users); this.currentUser=users[i]; } ['user-av','sb-user-av'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; }); const av=document.getElementById('av-preview'); if(av) av.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; this.toast('Profile photo updated!','success'); }; reader.readAsDataURL(file); },

  // ══ GLOBAL SEARCH ══

});