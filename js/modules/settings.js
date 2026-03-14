// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Settings — school · profile · academic · appearance · SMS · fees history
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadSettings(){
    // Non-admins default to Profile tab (not School Info)
    if(!this.hasRole('admin')){
      document.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.spane').forEach(p=>p.classList.remove('active'));
      const pt=document.querySelector('.stab[data-stab="profile"]');
      const pp=document.getElementById('sp-profile');
      if(pt) pt.classList.add('active');
      if(pp) pp.classList.add('active');
    }
    this.loadSchoolSettings(); this.loadProfileSettings(); this.loadAcademicSettings(); this.loadAppearanceSettings();
    // Clear password fields on every visit for security
    ['pw-old','pw-new','pw-confirm'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    const pwErr=document.getElementById('pw-err'); if(pwErr){ pwErr.style.display='none'; pwErr.textContent=''; }
    // Refresh SMS badge state even if user doesn't click that tab
    const _smsS=DB.get('smsSettings',{}); this._updateSmsBadge(_smsS);
  },

  loadSchoolSettings(){
    const school=DB.get('school',{});
    document.getElementById('sc-name').value=school.name||'';
    document.getElementById('sc-motto').value=school.motto||'';
    document.getElementById('sc-phone').value=school.phone||'';
    document.getElementById('sc-email').value=school.email||'';
    document.getElementById('sc-web').value=school.website||'';
    document.getElementById('sc-address').value=school.address||'';
    document.getElementById('sc-country').value=school.country||'GH';
    // Restore logo preview if saved
    const logoPreview=document.getElementById('school-logo-preview');
    if(logoPreview&&school.logo){
      logoPreview.innerHTML=`<img src="${school.logo}" style="width:100%;height:100%;object-fit:contain;border-radius:50%">`;
    }
  },

  saveSchool(){
    const name=(document.getElementById('sc-name').value||'').trim();
    if(!name){ this.toast('School name is required.','danger'); document.getElementById('sc-name').focus(); return; }
    const email=(document.getElementById('sc-email').value||'').trim();
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ this.toast('Please enter a valid school email address.','danger'); document.getElementById('sc-email').focus(); return; }
    const website=(document.getElementById('sc-web').value||'').trim();
    if(website&&!/^https?:\/\/.+/.test(website)){ this.toast('Website URL must start with http:// or https://','danger'); document.getElementById('sc-web').focus(); return; }
    const school=DB.get('school',{});
    school.name=name;
    school.motto=(document.getElementById('sc-motto').value||'').trim();
    school.phone=(document.getElementById('sc-phone').value||'').trim();
    school.email=email;
    school.website=website;
    school.address=(document.getElementById('sc-address').value||'').trim();
    school.country=document.getElementById('sc-country').value;
    DB.set('school',school);
    document.getElementById('topbar-school-name') && (document.getElementById('topbar-school-name').textContent=school.name);
    document.getElementById('sb-school-name') && (document.getElementById('sb-school-name').textContent=school.name);
    this.audit('Settings','settings',`School info updated: ${school.name}`);
    this.toast('School information saved!','success');
  },

  loadProfileSettings(){
    const u=this.currentUser;
    document.getElementById('p-name').value=u.name||'';
    const emailEl=document.getElementById('p-email');
    if(emailEl){ emailEl.value=u.email||''; emailEl.readOnly=true; emailEl.title='Email cannot be changed here — contact your administrator.'; emailEl.style.opacity='0.65'; emailEl.style.cursor='not-allowed'; }
    document.getElementById('p-phone').value=u.phone||'';
    document.getElementById('p-role').value=this.roleLabel(u.role);
  },

  saveProfile(){
    const name=(document.getElementById('p-name').value||'').trim();
    if(!name){ this.toast('Name is required.','danger'); document.getElementById('p-name').focus(); return; }
    const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===this.currentUser.id);
    if(i>-1){
      users[i].name=name;
      users[i].phone=(document.getElementById('p-phone').value||'').trim();
      DB.set('users',users); this.currentUser=users[i];
      this.setupTopbar(); this.audit('Profile','edit','Profile updated');
      this.toast('Profile saved!','success');
    }
  },

  async changePassword(){
    const oldPw=document.getElementById('pw-old').value;
    const newPw=document.getElementById('pw-new').value;
    const confirmPw=document.getElementById('pw-confirm').value;
    const errEl=document.getElementById('pw-err');
    if(!oldPw){ errEl.style.display='flex'; errEl.textContent='Please enter your current password.'; return; }
    if(newPw.length<8){ errEl.style.display='flex'; errEl.textContent='New password must be at least 8 characters.'; return; }
    if(newPw!==confirmPw){ errEl.style.display='flex'; errEl.textContent='Passwords do not match.'; return; }
    errEl.style.display='none';

    // Supabase account — re-authenticate then update password
    if(window.FAuth&&FAuth._isSupabaseSession()){
      try{
        await FAuth.changePassword(oldPw,newPw);
        this.audit('Security','settings','Password changed');
        this.toast('Password updated!','success');
        ['pw-old','pw-new','pw-confirm'].forEach(id=>document.getElementById(id).value='');
      }catch(e){
        errEl.style.display='flex';
        if(e.message==='wrong-password') errEl.textContent='Current password is incorrect.';
        else { errEl.textContent='Error: '+e.message; errEl.style.display='flex'; }
      }
      return;
    }

    // Local/demo account — use verifyPassword to handle both PBKDF2 and legacy hashes
    const cu=this.currentUser;
    const valid=await verifyPassword(oldPw, cu.passwordHash || cu.password || '');
    if(!valid){ errEl.style.display='flex'; errEl.textContent='Current password is incorrect.'; return; }
    const newHash=await hashPassword(newPw);
    const users=DB.get('users',[]); const i=users.findIndex(u=>u.id===cu.id);
    if(i>-1){ users[i].passwordHash=newHash; delete users[i].password; DB.set('users',users); this.currentUser=users[i]; }
    this.audit('Security','settings','Password changed');
    this.toast('Password updated!','success');
    ['pw-old','pw-new','pw-confirm'].forEach(id=>document.getElementById(id).value='');
  },

  loadAcademicSettings(){
    const school=DB.get('school',{});
    document.getElementById('ac-year').value=school.academicYear||'2025/2026';
    document.getElementById('ac-term').value=school.currentTerm||'2';
    document.getElementById('ac-grade-sys').value=school.gradeSystem||'percentage';
    document.getElementById('ac-pass').value=school.passMark||50;
    document.getElementById('ac-currency').value=school.currency||'GHS';
    document.getElementById('ac-type').value=school.type||'k12';
    // Populate term dates from current year's academicYears entry
    const _curYrEntry=(school.academicYears||[]).find(y=>y.year===(school.academicYear||_academicYear))||{};
    ['t1','t2','t3'].forEach(t=>{
      const s=document.getElementById(`ac-${t}-start`); const e=document.getElementById(`ac-${t}-end`);
      if(s) s.value=_curYrEntry[`${t}Start`]||'';
      if(e) e.value=_curYrEntry[`${t}End`]||'';
    });
    this.renderAcademicYearHistory();
  },

  saveAcademic(){
    const school=DB.get('school',{});
    const yearVal=(document.getElementById('ac-year').value||'').trim();
    if(!yearVal||!/^\d{4}\/\d{4}$/.test(yearVal)){
      this.toast('Academic year must be in format YYYY/YYYY (e.g. 2025/2026)','danger');
      document.getElementById('ac-year').focus(); return;
    }
    const [yStart,yEnd]=yearVal.split('/').map(Number);
    if(yEnd!==yStart+1){ this.toast('Academic year end must be exactly 1 year after start (e.g. 2025/2026)','danger'); document.getElementById('ac-year').focus(); return; }
    const passVal=+document.getElementById('ac-pass').value;
    if(isNaN(passVal)||passVal<0||passVal>100){ this.toast('Pass mark must be between 0 and 100.','danger'); document.getElementById('ac-pass').focus(); return; }
    school.academicYear=yearVal;
    school.currentTerm=document.getElementById('ac-term').value;
    school.gradeSystem=document.getElementById('ac-grade-sys').value;
    school.passMark=passVal;
    school.currency=document.getElementById('ac-currency').value;
    school.type=document.getElementById('ac-type').value;
    _currency=school.currency;
    _currentTerm=school.currentTerm;
    _academicYear=school.academicYear;
    _passMark=school.passMark;
    _gradeSystem=school.gradeSystem;
    // Ensure this year is in academicYears list
    if(!school.academicYears) school.academicYears=[];
    if(!school.academicYears.find(y=>y.year===school.academicYear)){
      school.academicYears.push({year:school.academicYear,isCurrent:true,label:school.academicYear});
    }
    // Mark current year
    school.academicYears.forEach(y=>y.isCurrent=(y.year===school.academicYear));
    // Save term dates into the current year's academicYears entry
    const _ayEntry=school.academicYears.find(y=>y.year===school.academicYear);
    if(_ayEntry){
      ['t1','t2','t3'].forEach(t=>{
        const sv=document.getElementById(`ac-${t}-start`)?.value||'';
        const ev=document.getElementById(`ac-${t}-end`)?.value||'';
        if(sv) _ayEntry[`${t}Start`]=sv; else delete _ayEntry[`${t}Start`];
        if(ev) _ayEntry[`${t}End`]=ev; else delete _ayEntry[`${t}End`];
      });
    }
    DB.set('school',school);
    // Ensure fee structure exists for new year
    const fs=DB.get('feeStructure',[]);
    const classes=DB.get('classes',[]);
    let fsChanged=false;
    classes.forEach(c=>{
      if(!fs.find(f=>f.classId===c.id&&f.year===school.academicYear)){
        // Copy from most recent year for this class
        const prev=fs.filter(f=>f.classId===c.id).sort((a,b)=>(b.year||'').localeCompare(a.year||''))[0];
        fs.push({id:uid('fs'),classId:c.id,year:school.academicYear,term1:prev?.term1||0,term2:prev?.term2||0,term3:prev?.term3||0});
        fsChanged=true;
      }
    });
    if(fsChanged) DB.set('feeStructure',fs);
    this.audit('Settings','settings','Academic settings updated — Year: '+school.academicYear+' Term: '+school.currentTerm);
    this.toast('Academic settings saved!','success');
    // Refresh hero stats and dashboard
    this.setupTopbar();
    if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard();
    this.renderAcademicYearHistory();
  },

  renderAcademicYearHistory(){
    const el=document.getElementById('ac-year-history'); if(!el) return;
    const school=DB.get('school',{});
    const years=getAllAcademicYears();
    const classes=DB.get('classes',[]);
    el.innerHTML=years.map(y=>{
      const isCurrent=y.year===school.academicYear;
      const payments=DB.get('feePayments',[]).filter(p=>p.academicYear===y.year);
      const totalCollected=payments.reduce((s,p)=>s+(+p.amount||0),0);
      const structCount=DB.get('feeStructure',[]).filter(f=>f.year===y.year).length;
      const _termRows=[1,2,3].filter(t=>y[`t${t}Start`]||y[`t${t}End`]).map(t=>`<div class="ay-meta-item"><svg class="ay-meta-icon ay-meta-icon--term" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span class="ay-term-tag">T${t}</span>${y[`t${t}Start`]?fmtDate(y[`t${t}Start`]):'?'} &rarr; ${y[`t${t}End`]?fmtDate(y[`t${t}End`]):'?'}</div>`).join('');
      const _calSvg=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      const _trashSvg=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
      return `<div class="ay-card${isCurrent?' ay-card-current':''}">
        <div class="ay-card-header">
          <div class="ay-card-left">
            <div class="ay-year-badge${isCurrent?' ay-year-badge-current':''}">${y.year}</div>
            ${isCurrent?'<span class="badge badge-success ay-current-badge">Current</span>':''}
          </div>
          <div class="ay-card-actions">
            ${!isCurrent?`<button class="btn btn-secondary btn-sm ay-btn-setcurrent" onclick="SMS.setCurrentYear('${y.year}')" title="Set as active year">Set Current</button>`:''}
            <button class="btn btn-secondary btn-sm ay-btn-termdates" onclick="SMS.openEditTermDatesModal('${y.year}')" title="Set term start and end dates">${_calSvg} <span class="ay-btn-label">Term Dates</span></button>
            <button class="btn btn-secondary btn-sm ay-btn-feestruct" onclick="SMS.openFeeStructureForYear('${y.year}')" title="Edit fee structure"><span class="ay-btn-label">Fee Structure</span></button>
            <button class="btn btn-primary btn-sm ay-btn-enterdata" onclick="SMS.openHistoricalFeeEntry('${y.year}')" title="Enter or review payments"><span class="ay-btn-label">Enter Fee Data</span></button>
            ${!isCurrent?`<button class="btn btn-ghost btn-sm ay-delete-btn" onclick="SMS.deleteAcademicYear('${y.year}')" title="Delete this year">${_trashSvg}</button>`:''}
          </div>
        </div>
        <div class="ay-card-body">
          <div class="ay-meta-group">
            <div class="ay-meta-item"><svg class="ay-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> <span class="ay-meta-label">Academic Year</span>${y.startDate?fmtDate(y.startDate):'—'} &rarr; ${y.endDate?fmtDate(y.endDate):'—'}</div>
          </div>
          <div class="ay-meta-group">
            ${_termRows||`<div class="ay-meta-item ay-meta-warn"><svg class="ay-meta-icon ay-meta-icon--warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Term dates not set &mdash; using estimated thirds</div>`}
          </div>
          <div class="ay-meta-group ay-meta-stats">
            <div class="ay-stat-chip"><svg class="ay-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> ${structCount}/${classes.length} fee structures</div>
            <div class="ay-stat-chip"><svg class="ay-meta-icon ay-meta-icon--fee" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> ${fmt(totalCollected)} collected (${payments.length} payment${payments.length!==1?'s':''})</div>
          </div>
        </div>
      </div>`;
    }).join('')||'<div style="color:var(--t4);font-size:.85rem;padding:1rem">No academic years configured yet.</div>';
  },

  setCurrentYear(year){
    const school=DB.get('school',{});
    school.academicYear=year;
    // Set term 1 as default when switching years
    school.currentTerm='1';
    school.academicYears=(school.academicYears||[]).map(y=>({...y,isCurrent:y.year===year}));
    _academicYear=year; _currentTerm='1';
    _passMark=school.passMark||50;
    _gradeSystem=school.gradeSystem||'percentage';
    DB.set('school',school);
    document.getElementById('ac-year').value=year;
    document.getElementById('ac-term').value='1';
    // Refresh term date inputs to show the switched year's dates
    const yEntry=(school.academicYears||[]).find(y=>y.year===year)||{};
    ['t1','t2','t3'].forEach(t=>{
      const s=document.getElementById(`ac-${t}-start`); const e=document.getElementById(`ac-${t}-end`);
      if(s) s.value=yEntry[`${t}Start`]||'';
      if(e) e.value=yEntry[`${t}End`]||'';
    });
    this.toast(`Switched to ${year} — Term 1`,'success');
    this.setupTopbar();
    this.renderAcademicYearHistory();
    if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard();
    this.audit('Settings','settings','Academic year switched to '+year);
  },
  openEditTermDatesModal(year){
    const school=DB.get('school',{});
    const yEntry=(school.academicYears||[]).find(y=>y.year===year)||{};
    document.getElementById('etd-year-title').textContent=year;
    document.getElementById('etd-year-key').value=year;
    // Populate existing term dates
    ['t1','t2','t3'].forEach(t=>{
      const si=document.getElementById(`etd-${t}-start`);
      const ei=document.getElementById(`etd-${t}-end`);
      if(si) si.value=yEntry[`${t}Start`]||'';
      if(ei) ei.value=yEntry[`${t}End`]||'';
    });
    this.openModal('m-edit-term-dates');
  },

  saveTermDates(){
    const year=document.getElementById('etd-year-key').value;
    const errEl=document.getElementById('etd-err');
    errEl.style.display='none';
    if(!year){ errEl.style.display='block'; errEl.textContent='Invalid academic year. Please close and reopen.'; return; }
    // Read all 6 date inputs
    const dates={};
    ['t1','t2','t3'].forEach(t=>{
      dates[`${t}Start`]=document.getElementById(`etd-${t}-start`)?.value||'';
      dates[`${t}End`]=document.getElementById(`etd-${t}-end`)?.value||'';
    });
    // Validate: if both dates given for a term, start must be before end
    for(let t=1;t<=3;t++){
      const s=dates[`t${t}Start`], e=dates[`t${t}End`];
      if(s&&e&&new Date(s)>=new Date(e)){
        errEl.style.display='block';
        errEl.textContent=`Term ${t}: Start date must be before End date.`;
        return;
      }
    }
    // Validate: terms must not overlap
    const ranges=[];
    for(let t=1;t<=3;t++){
      const s=dates[`t${t}Start`], e=dates[`t${t}End`];
      if(s&&e) ranges.push({t,s:new Date(s),e:new Date(e+'T23:59:59')});
    }
    for(let i=0;i<ranges.length;i++){
      for(let j=i+1;j<ranges.length;j++){
        if(ranges[i].s<=ranges[j].e&&ranges[j].s<=ranges[i].e){
          errEl.style.display='block';
          errEl.textContent=`Term ${ranges[i].t} and Term ${ranges[j].t} dates overlap. Please fix before saving.`;
          return;
        }
      }
    }
    // Save into academicYears entry
    const school=DB.get('school',{});
    if(!school.academicYears) school.academicYears=[];
    let yEntry=school.academicYears.find(y=>y.year===year);
    if(!yEntry){ yEntry={year,label:year,isCurrent:false}; school.academicYears.push(yEntry); }
    ['t1','t2','t3'].forEach(t=>{
      if(dates[`${t}Start`]) yEntry[`${t}Start`]=dates[`${t}Start`]; else delete yEntry[`${t}Start`];
      if(dates[`${t}End`]) yEntry[`${t}End`]=dates[`${t}End`]; else delete yEntry[`${t}End`];
    });
    DB.set('school',school);
    // ── Re-derive enrollTerm for every student admitted in this academic year ──
    // Only re-derive students admitted within the year's overall date range (or all if no range set)
    const yearStart=yEntry.startDate?new Date(yEntry.startDate+'T00:00:00'):null;
    const yearEnd=yEntry.endDate?new Date(yEntry.endDate+'T23:59:59'):null;
    const students=DB.get('students',[]);
    let rederived=0;
    students.forEach(s=>{
      if(!s.admitDate) return;
      const admitMs=new Date(s.admitDate+'T00:00:00');
      // Only re-derive students whose admit date falls within this academic year's range
      const inYear=(!yearStart||admitMs>=yearStart)&&(!yearEnd||admitMs<=yearEnd);
      if(!inYear) return;
      const newTerm=getEnrollTermFromDate(s.admitDate,year);
      if(String(s.enrollTerm)!==String(newTerm)){
        s.enrollTerm=newTerm;
        rederived++;
      }
    });
    if(rederived>0) DB.set('students',students);
    // Update settings form if this is the active year
    if(year===school.academicYear||year===_academicYear){
      ['t1','t2','t3'].forEach(t=>{
        const si=document.getElementById(`ac-${t}-start`);
        const ei=document.getElementById(`ac-${t}-end`);
        if(si) si.value=yEntry[`${t}Start`]||'';
        if(ei) ei.value=yEntry[`${t}End`]||'';
      });
    }
    this.closeModal('m-edit-term-dates');
    this.renderAcademicYearHistory();
    this.audit('Settings','settings',`Term dates updated for ${year} — ${rederived} student enrol terms recalculated`);
    if(rederived>0){
      this.toast(`Term dates saved. ${rederived} student enrolment term${rederived!==1?'s':''} recalculated based on admission dates.`,'success');
      // Refresh dashboard and fees if visible
      if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard();
      if(document.getElementById('page-fees')?.classList.contains('active')) this.loadFees();
    } else {
      this.toast(`Term dates saved for ${year}.`,'success');
    }
  },


  openAddYearModal(){
    const allYears=getAllAcademicYears();
    const school=DB.get('school',{});
    let suggestStart, suggestEnd;
    if(allYears.length>0){
      // Suggest the year AFTER the latest recorded year (adding next year is the most common need)
      const latest=allYears[0]?.year||school.academicYear||'2025/2026';
      const parts=latest.split('/');
      suggestStart=+parts[0]+1; suggestEnd=+parts[1]+1;
    } else {
      const cur=school.academicYear||'2025/2026';
      const parts=cur.split('/');
      suggestStart=+parts[0]-1; suggestEnd=+parts[1]-1;
    }
    const suggested=`${suggestStart}/${suggestEnd}`;
    document.getElementById('new-ay-year').value=suggested;
    document.getElementById('new-ay-start').value=`${suggestStart}-09-01`;
    document.getElementById('new-ay-end').value=`${suggestEnd}-07-31`;
    document.getElementById('new-ay-err').style.display='none';
    this.openModal('m-add-year');
  },

  saveNewYear(){
    const year=document.getElementById('new-ay-year').value.trim();
    const startDate=document.getElementById('new-ay-start').value;
    const endDate=document.getElementById('new-ay-end').value;
    const errEl=document.getElementById('new-ay-err');
    if(!year||!/^\d{4}\/\d{4}$/.test(year)){
      errEl.style.display='block'; errEl.textContent='Year must be in format YYYY/YYYY (e.g. 2023/2024)'; return;
    }
    const [ys,ye]=year.split('/').map(Number);
    if(ye!==ys+1){ errEl.style.display='block'; errEl.textContent='End year must be exactly 1 year after start year (e.g. 2024/2025).'; return; }
    if(startDate&&endDate&&new Date(startDate)>=new Date(endDate)){ errEl.style.display='block'; errEl.textContent='Year start date must be before end date.'; return; }
    const school=DB.get('school',{});
    if(!school.academicYears) school.academicYears=[];
    if(school.academicYears.find(y=>y.year===year)){
      errEl.style.display='block'; errEl.textContent=`${year} already exists.`; return;
    }
    const _nt1s=document.getElementById('new-t1-start')?.value||'';
    const _nt1e=document.getElementById('new-t1-end')?.value||'';
    const _nt2s=document.getElementById('new-t2-start')?.value||'';
    const _nt2e=document.getElementById('new-t2-end')?.value||'';
    const _nt3s=document.getElementById('new-t3-start')?.value||'';
    const _nt3e=document.getElementById('new-t3-end')?.value||'';
    const _newYrEntry={year,isCurrent:false,label:year,startDate,endDate};
    if(_nt1s) _newYrEntry.t1Start=_nt1s; if(_nt1e) _newYrEntry.t1End=_nt1e;
    if(_nt2s) _newYrEntry.t2Start=_nt2s; if(_nt2e) _newYrEntry.t2End=_nt2e;
    if(_nt3s) _newYrEntry.t3Start=_nt3s; if(_nt3e) _newYrEntry.t3End=_nt3e;
    school.academicYears.push(_newYrEntry);
    DB.set('school',school);
    // Auto-create fee structure for this year based on current year's rates
    const fs=DB.get('feeStructure',[]); const classes=DB.get('classes',[]);
    const copyFrom=school.academicYear||_academicYear;
    classes.forEach(c=>{
      if(!fs.find(f=>f.classId===c.id&&f.year===year)){
        const prev=fs.find(f=>f.classId===c.id&&f.year===copyFrom)||fs.filter(f=>f.classId===c.id).sort((a,b)=>(b.year||'').localeCompare(a.year||''))[0];
        fs.push({id:uid('fs'),classId:c.id,year,term1:prev?.term1||0,term2:prev?.term2||0,term3:prev?.term3||0});
      }
    });
    DB.set('feeStructure',fs);
    this.closeModal('m-add-year');
    this.renderAcademicYearHistory();
    this.audit('Settings','settings','Academic year added: '+year);
    this.toast(`${year} added! Adjust its fee structure and enter historical payments.`,'success');
  },

  deleteAcademicYear(year){
    this.confirmDelete(`Delete academic year ${year}? This will also remove all fee payments and fee structures recorded for this year.`,()=>{
    const school=DB.get('school',{});
    school.academicYears=(school.academicYears||[]).filter(y=>y.year!==year);
    DB.set('school',school);
    // Remove fee payments for that year
    DB.set('feePayments',DB.get('feePayments',[]).filter(p=>p.academicYear!==year));
    // Remove fee structures for that year
    DB.set('feeStructure',DB.get('feeStructure',[]).filter(f=>f.year!==year));
    // Remove from students' feesPaid
    const students=DB.get('students',[]);
    students.forEach(s=>{ if(s.feesPaid&&s.feesPaid[year]){ delete s.feesPaid[year]; } });
    DB.set('students',students);
    this.renderAcademicYearHistory();
    this.toast(`${year} deleted.`,'info');
    });
  },

  openFeeStructureForYear(year){
    // Open the fee structure modal pre-filtered to the selected year
    const school=DB.get('school',{});
    const prev=school.academicYear;
    // Temporarily switch year filter to show that year's structure
    document.getElementById('fee-year-f') && (document.getElementById('fee-year-f').value=year);
    SMS.nav('fees');
    // Switch to fee structure tab
    setTimeout(()=>{
      document.querySelectorAll('.fee-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.fee-pane').forEach(p=>p.classList.remove('active'));
      const structTab=document.querySelector('.fee-tab[data-pane="structure"]');
      const structPane=document.getElementById('fee-pane-structure');
      if(structTab) structTab.classList.add('active');
      if(structPane) structPane.classList.add('active');
      this.renderFeeStructure();
    },100);
  },

  openHistoricalFeeEntry(year){
    const students=DB.get('students',[]).filter(s=>s.status==='active');
    const classes=DB.get('classes',[]);
    const fs=DB.get('feeStructure',[]).filter(f=>f.year===year);
    document.getElementById('hist-fee-year-title').textContent=year;
    document.getElementById('hist-fee-year-input').value=year;
    const tbody=document.getElementById('hist-fee-tbody');
    if(!tbody) return;
    tbody.innerHTML=students.map(s=>{
      const fss=fs.find(f=>f.classId===s.classId);
      const yf=getYearFees(s,year);
      const t1due=+(fss?.term1||0), t2due=+(fss?.term2||0), t3due=+(fss?.term3||0);
      const p1=+(yf.term1||0), p2=+(yf.term2||0), p3=+(yf.term3||0);
      const cls=classes.find(c=>c.id===s.classId);
      const rowClass=p1+p2+p3>0?'hist-row-has-data':'';
      return `<tr class="${rowClass}" id="hist-row-${s.id}">
        <td><div style="font-weight:600;font-size:.82rem">${sanitize(s.fname)} ${sanitize(s.lname)}</div>
          <div style="font-size:.7rem;color:var(--t4)">${sanitize(cls?.name||'—')} · ${s.studentId}</div></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t1due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p1||''}" placeholder="0.00" data-sid="${s.id}" data-term="term1" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t2due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p2||''}" placeholder="0.00" data-sid="${s.id}" data-term="term2" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td style="font-size:.72rem;color:var(--t3)">${fss?fmt(t3due):'—'}</td>
        <td><input type="number" class="form-input hist-amt" style="width:90px;padding:.3rem .5rem;font-size:.8rem" min="0" step="0.01" value="${p3||''}" placeholder="0.00" data-sid="${s.id}" data-term="term3" onchange="SMS._histRowUpdate('${s.id}','${year}')"></td>
        <td class="hist-balance-cell" id="hist-bal-${s.id}" style="font-weight:700;font-size:.8rem;white-space:nowrap">${this._histBalance(p1,p2,p3,t1due,t2due,t3due)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="8" class="tbl-empty">No active students found.</td></tr>';
    this.openModal('m-hist-fees');
  },

  _histBalance(p1,p2,p3,t1,t2,t3){
    const total=(+t1||0)+(+t2||0)+(+t3||0);
    const paid=(+p1||0)+(+p2||0)+(+p3||0);
    const owed=Math.max(0,total-paid);
    if(!total) return '<span style="color:var(--t4)">No structure</span>';
    if(owed===0) return `<span style="color:var(--success)">✓ ${fmt(paid)}</span>`;
    return `<span style="color:var(--danger)">${fmt(owed)} owed</span>`;
  },

  _histRowUpdate(sid,year){
    const s=DB.get('students',[]).find(x=>x.id===sid); if(!s) return;
    const fss=getYearStructure(s.classId,year)||{term1:0,term2:0,term3:0};
    const p1=+document.querySelector(`[data-sid="${sid}"][data-term="term1"]`)?.value||0;
    const p2=+document.querySelector(`[data-sid="${sid}"][data-term="term2"]`)?.value||0;
    const p3=+document.querySelector(`[data-sid="${sid}"][data-term="term3"]`)?.value||0;
    const balEl=document.getElementById('hist-bal-'+sid);
    if(balEl) balEl.innerHTML=this._histBalance(p1,p2,p3,fss.term1,fss.term2,fss.term3);
    const row=document.getElementById('hist-row-'+sid);
    if(row) row.classList.toggle('hist-row-has-data',(p1+p2+p3)>0);
  },

  saveHistoricalFees(){
    const year=document.getElementById('hist-fee-year-input')?.value;
    if(!year){ this.toast('No year selected','danger'); return; }
    const inputs=document.querySelectorAll('.hist-amt');
    const students=DB.get('students',[]);
    const payments=DB.get('feePayments',[]);
    let savedCount=0;
    const byStudent={};
    inputs.forEach(inp=>{
      const sid=inp.dataset.sid, term=inp.dataset.term, amount=+(inp.value||0);
      if(!sid) return;
      if(!byStudent[sid]) byStudent[sid]={};
      byStudent[sid][term]=amount;
    });
    Object.entries(byStudent).forEach(([sid,terms])=>{
      const si=students.findIndex(s=>s.id===sid); if(si<0) return;
      if(!students[si].feesPaid||typeof students[si].feesPaid.term1==='number') students[si].feesPaid={};
      const prev=students[si].feesPaid[year]||{term1:0,term2:0,term3:0};
      students[si].feesPaid[year]={term1:+(terms.term1||0),term2:+(terms.term2||0),term3:+(terms.term3||0)};
      // Sync feePayments: remove old historical payments for this student/year, re-add as single records
      const filtered=payments.filter(p=>!(p.studentId===sid&&p.academicYear===year&&p.ref==='historical-entry'));
      const s=students[si];
      ['term1','term2','term3'].forEach((t,ti)=>{
        const amt=+(terms[t]||0); if(amt<=0) return;
        const maxRec=filtered.reduce((mx,p)=>{ const n=parseInt((p.receiptNo||'').replace('REC-','')||0); return n>mx?n:mx; },0);
        filtered.push({id:uid('fp'),studentId:sid,term:String(ti+1),amount:amt,method:'historical',date:year.split('/')[0]+'-09-01',by:this.currentUser.name,receiptNo:'REC-'+String(maxRec+1).padStart(4,'0'),academicYear:year,ref:'historical-entry'});
        savedCount++;
      });
      payments.length=0; filtered.forEach(p=>payments.push(p));
    });
    DB.set('students',students);
    DB.set('feePayments',[...payments]);
    this.closeModal('m-hist-fees');
    this.audit('Historical Fees','create',`Historical fee data saved for ${year} — ${savedCount} term records`);
    this.toast(`Historical fees saved for ${year}!`,'success');
    this.renderAcademicYearHistory();
  },

});