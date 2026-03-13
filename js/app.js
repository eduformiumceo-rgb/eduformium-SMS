// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Core Application
//  init · nav · auth screens · permissions · toast · modal · theme
// ══════════════════════════════════════════

const SMS = {
  currentUser: null,
  schoolId: null,
  currentPage: 'dashboard',
  _demoMode: false,
  _formsBound: false,
  deleteCallback: null,

  // Returns array of term numbers that are currently due for a student.
  // A student only owes fees from their enrolment term up to _currentTerm.
  // e.g. enrolled Term 2, current Term 2 → [2]; current Term 3 → [2,3]
  _activeFeeTerms(student){
    const enroll = Math.min(3, Math.max(1, +(student.enrollTerm || 1)));
    const curr   = Math.min(3, Math.max(1, +_currentTerm));
    const terms  = [];
    for(let t = enroll; t <= curr; t++) terms.push(t);
    return terms;
  },

  // Returns total amount owed by a student for their active terms only.
  _studentOwed(student, yearFilter){
    const fs  = getYearStructure(student.classId, yearFilter);
    if(!fs) return 0;
    const yf  = getYearFees(student, yearFilter);
    return this._activeFeeTerms(student).reduce((sum, t) =>
      sum + Math.max(0, (+(fs['term'+t]||0)) - (+(yf['term'+t]||0))), 0);
  },

  _kpiSvg(type){
    const S='width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    const currSym=_currency==='NGN'?'₦':_currency==='KES'?'KSh':_currency==='USD'?'$':_currency==='GBP'?'£':_currency==='ZAR'?'R':_currency==='EUR'?'€':'₵';
    const icons={
      students:`<svg ${S}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.53 1.76 9.47 1.76 12 0v-5"/></svg>`,
      staff:`<svg ${S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      classes:`<svg ${S}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      fees:`<svg ${S}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
      check:`<svg ${S}><polyline points="20 6 9 17 4 12"/></svg>`,
      library:`<svg ${S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      transactions:`<svg ${S}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
      warning:`<svg ${S}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      outstanding:`<svg ${S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      trending:`<svg ${S}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      chart:`<svg ${S}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      pending:`<svg ${S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      expenses:`<svg ${S}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      category:`<svg ${S}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    };
    return icons[type]||icons['chart'];
  },

  _charts: {},
  _calYear: new Date().getFullYear(),
  _calMonth: new Date().getMonth(),
  _studPage: 1,
  _staffPage: 1,
  _auditPage: 1,
  _dashRefreshTimer: null,   // auto-refresh interval handle
  _freshTimer: null,         // freshness label interval handle
  _syncStatus: 'idle',       // 'idle' | 'syncing' | 'synced' | 'offline'

  // Minimum ms the loading screen stays visible — ensures it's seen on fast/cached loads
  _loadStart: 0,
  _MIN_LOAD_MS: 1800,
  _afterLoad(fn) {
    const elapsed = Date.now() - this._loadStart;
    const remaining = Math.max(0, this._MIN_LOAD_MS - elapsed);
    if (remaining > 0) setTimeout(fn, remaining); else fn();
  },

  init() {
    this._loadStart = Date.now();
    if(!window.FAuth){ // fallback if Firebase didn't load
      // Do NOT seed demo data here - only seed in demo mode
      const school=DB.get('school',{});
      _currency=school.currency||'GHS';
      _currentTerm=school.currentTerm||'2';
      _academicYear=school.academicYear||'2025/2026';
      _passMark=school.passMark||50;
      _gradeSystem=school.gradeSystem||'percentage';
      migrateToYearFees();
      migrateEnrollTerm();
      const session=DB.get('session');
      if(session){ const user=DB.get('users',[]).find(u=>u.id===session.userId); if(user){ this.currentUser=user; this._afterLoad(()=>this.boot()); return; } }
      this._afterLoad(()=>this.showLogin()); return;
    }
    // Keep loading overlay visible until Supabase confirms auth state
    document.getElementById('loading-overlay').style.display='flex';
    FAuth.onAuthChange(async (firebaseUser)=>{
      if(this._demoMode) return;
      if(this._registering) return; // suppress during account creation
      if(firebaseUser){
        // ── Determine if this is a school admin (uid === schoolId) or an admin-invited sub-user ──
        const _sp = await FDB.getSchoolProfile(firebaseUser.uid).catch(()=>null);

        if(_sp){
          // ══ SCHOOL ADMIN: their Firebase UID is the schoolId ══
          this.schoolId=firebaseUser.uid;
          const _demoCols=['students','staff','classes','subjects','feePayments','feeStructure',
            'exams','grades','attendance','events','messages','leaves','homework','books',
            'expenses','payroll','auditLog','timetable','school','users'];
          _demoCols.forEach(c=>{try{localStorage.removeItem('sms_'+c);}catch{}});
          DB.del('seeded');
          try{ await DB.loadFromFirestore(this.schoolId); }catch(e){}
          try{ await Migration.run(this.schoolId); }catch(e){}
          // Approval gate
          const _spStatus = _sp?.status || 'pending';
          if(_spStatus === 'suspended'){
            this._afterLoad(()=>this.showSuspendedScreen(_sp, firebaseUser.email));
            return;
          }
          if(_spStatus !== 'active'){
            this._afterLoad(()=>this.showPendingScreen(_sp || {status:'pending', name:'', adminEmail:firebaseUser.email}, firebaseUser.email));
            return;
          }
          const school=DB.get('school',{});
          _currency=school.currency||'GHS';
          _currentTerm=school.currentTerm||'2';
          _academicYear=school.academicYear||'2025/2026';
          _passMark=school.passMark||50;
          _gradeSystem=school.gradeSystem||'percentage';
          migrateToYearFees();
          migrateEnrollTerm();
          const users=DB.get('users',[]);
          this.currentUser=users.find(u=>u.id===this.schoolId)||{id:this.schoolId,name:school.adminName||firebaseUser.email,email:firebaseUser.email,role:'admin'};
          this._afterLoad(()=>this.boot());
        } else {
          // ══ SUB-USER: look up their schoolId via the userIndex collection ══
          const _idx = await FDB.getUserIndex(firebaseUser.email).catch(()=>null);
          if(_idx && _idx.schoolId){
            this.schoolId=_idx.schoolId;
            try{ await DB.loadFromFirestore(this.schoolId); }catch(e){}
            // Check the school's approval status
            const _schoolProfile = await FDB.getSchoolProfile(this.schoolId).catch(()=>null);
            const _schoolStatus = _schoolProfile?.status || 'pending';
            if(_schoolStatus === 'suspended'){
              this._afterLoad(()=>this.showSuspendedScreen(_schoolProfile, firebaseUser.email));
              return;
            }
            if(_schoolStatus !== 'active'){
              this._afterLoad(()=>this.showPendingScreen(_schoolProfile||{status:'pending',name:'',adminEmail:firebaseUser.email}, firebaseUser.email));
              return;
            }
            const school=DB.get('school',{});
            _currency=school.currency||'GHS';
            _currentTerm=school.currentTerm||'2';
            _academicYear=school.academicYear||'2025/2026';
            _passMark=school.passMark||50;
            _gradeSystem=school.gradeSystem||'percentage';
            migrateToYearFees();
            migrateEnrollTerm();
            // Find or build the sub-user record from the school's users collection
            const _subUsers=DB.get('users',[]);
            let _subUser=_subUsers.find(u=>u.email===firebaseUser.email||u.id===firebaseUser.uid);
            if(!_subUser){ _subUser={id:firebaseUser.uid,email:firebaseUser.email,name:_idx.name||firebaseUser.email,role:_idx.role||'staff',phone:''}; }
            _subUser.lastLogin=new Date().toISOString();
            const _updatedSubUsers=_subUsers.find(u=>u.id===_subUser.id)?_subUsers.map(u=>u.id===_subUser.id?_subUser:u):[..._subUsers,_subUser];
            DB.set('users',_updatedSubUsers);
            DB.set('session',{userId:_subUser.id});
            this.currentUser=_subUser;
            this._afterLoad(()=>this.boot());
          } else {
            // Unknown Firebase account (not a school admin, not a sub-user) — sign out
            await FAuth.logout().catch(()=>{});
            this._afterLoad(()=>this.showLogin());
          }
        }
      } else {
        this.schoolId=null; this.currentUser=null;
        // Only show login if pending/suspended screen is not already visible
        const _ps = document.getElementById('pending-screen');
        const _ss = document.getElementById('suspended-screen');
        const _psVisible = _ps && _ps.style.display !== 'none' && _ps.style.display !== '';
        const _ssVisible = _ss && _ss.style.display !== 'none' && _ss.style.display !== '';
        if(!_psVisible && !_ssVisible) {
          this._afterLoad(()=>this.showLogin());
        }
      }
    });
  },

  showLogin(){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('pending-screen').style.display='none';
    document.getElementById('suspended-screen').style.display='none';
    this.bindForms(); // bind login/register buttons
    PWABanner.tryShow();
  },

  showPendingScreen(profile, email){
    if(profile?.status === 'suspended') return this.showSuspendedScreen(profile, email);

    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='none';
    document.getElementById('suspended-screen').style.display='none';
    const ps = document.getElementById('pending-screen');
    ps.style.display='block';
    ps.className = '';

    // Populate school info
    const schoolName = profile?.name || 'Your School';
    const adminEmail = profile?.adminEmail || profile?.email || email || '';
    document.getElementById('ps-school-name-display').textContent = schoolName;
    document.getElementById('ps-school-email-display').textContent = adminEmail;
    document.getElementById('ps-school-avatar').textContent = schoolName.charAt(0).toUpperCase();

    const waBtn = document.getElementById('ps-wa-btn');
    if(waBtn) waBtn.href = 'https://wa.me/233553774541?text=' + encodeURIComponent('Hello Eduformium, I just registered my school on Eduformium SMS and I am requesting account activation. School: ' + schoolName + '. Email: ' + adminEmail);

    const emailLinks = ps.querySelectorAll('a[href^="mailto"]');
    emailLinks.forEach(a => {
      a.href = 'mailto:eduformium.ceo@gmail.com?subject=' + encodeURIComponent('Account Activation Request - ' + schoolName) + '&body=' + encodeURIComponent('Hello,\n\nI would like to request activation for my school account.\nSchool: ' + schoolName + '\nEmail: ' + adminEmail);
    });

    const soBtn = document.getElementById('ps-signout-btn');
    if(soBtn) soBtn.onclick = ()=>{ if(window.FAuth) FAuth.logout(); ps.style.display='none'; this.showLogin(); };

    // Watch for status changes while user is on pending screen (poll Supabase every 10s)
    if(this._pendingUnsub) { clearInterval(this._pendingUnsub); this._pendingUnsub=null; }
    if(this.schoolId){
      this._pendingUnsub = setInterval(async ()=>{
        try{
          const profile = await FDB.getSchoolProfile(this.schoolId);
          if(profile?.status === 'active'){ clearInterval(this._pendingUnsub); this._pendingUnsub=null; location.reload(); }
          else if(profile?.status === 'suspended'){ clearInterval(this._pendingUnsub); this._pendingUnsub=null; this.showSuspendedScreen(profile, email); }
        }catch(e){}
      }, 10000);
    }
  },

  showSuspendedScreen(profile, email){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('pending-screen').style.display='none';
    document.getElementById('app').style.display='none';
    const ss = document.getElementById('suspended-screen');
    ss.style.display='block';

    // Populate school info
    const schoolName = profile?.name || 'Your School';
    const adminEmail = profile?.adminEmail || profile?.email || email || '';
    const nameEl = document.getElementById('ss-school-name');
    const emailEl = document.getElementById('ss-school-email');
    const avatarEl = document.getElementById('ss-school-avatar');
    if(nameEl) nameEl.textContent = schoolName;
    if(emailEl) emailEl.textContent = adminEmail;
    if(avatarEl) avatarEl.textContent = schoolName.charAt(0).toUpperCase();

    // WhatsApp button
    const waBtn = document.getElementById('ss-wa-btn');
    if(waBtn){
      const msg = encodeURIComponent('Hello Eduformium, my school account has been suspended on Eduformium SMS. School: ' + schoolName + '. Email: ' + adminEmail + '. Please help me restore access.');
      waBtn.href = 'https://wa.me/233553774541?text=' + msg;
    }

    // Email button
    const emailBtn = document.getElementById('ss-email-btn');
    if(emailBtn){
      const subj = 'Account Suspension - ' + schoolName;
      const body = 'Hello,\n\nMy school account has been suspended.\nSchool: ' + schoolName + '\nEmail: ' + adminEmail + '\n\nPlease help me restore access.';
      emailBtn.href = 'mailto:eduformium.ceo@gmail.com?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
    }

    // Sign out button
    const soBtn = document.getElementById('ss-signout-btn');
    if(soBtn) soBtn.onclick = ()=>{ if(window.FAuth) FAuth.logout(); ss.style.display='none'; this.showLogin(); };
  },

  boot(){
    document.getElementById('loading-overlay').style.display='none';
    document.getElementById('login-screen').style.display='none';
    const app=document.getElementById('app');
    app.style.display='grid';
    const syncEl=document.getElementById('sync-status');
    if(syncEl) syncEl.style.display=this._demoMode?'none':'inline-flex';
    this.setupTopbar();
    if(!this._navBound){ this.bindNav(); this._navBound=true; }
    if(!this._formsBound){ this.bindForms(); this._formsBound=true; }
    this._startSessionWatch();
    this.loadTheme();
    this.applyRolePermissions();
    // Navigate to first accessible page for this role
    const _firstPage = Object.keys(this.PERMISSIONS.nav).find(p=>this.canAccess(p))||'dashboard';
    this.nav(_firstPage);
    this.loadNotifications();
    // ── Status listener — poll Supabase every 30s ──
    if(this._statusUnsub) { clearInterval(this._statusUnsub); this._statusUnsub=null; }
    if(this.schoolId){
      this._statusUnsub = setInterval(async ()=>{
        try{
          const profile = await FDB.getSchoolProfile(this.schoolId);
          if(profile && profile.status && profile.status !== 'active'){
            clearInterval(this._statusUnsub); this._statusUnsub=null;
            if(profile.status === 'suspended') this.showSuspendedScreen(profile, this.currentUser?.email||'');
            else this.showPendingScreen(profile, this.currentUser?.email||'');
          }
        }catch(e){}
      }, 30000);
    }
  },

  setupTopbar(){
    const school=DB.get('school',{});
    document.getElementById('topbar-school-name') && (document.getElementById('topbar-school-name').textContent=school.name||'School');
    document.getElementById('sb-school-name') && (document.getElementById('sb-school-name').textContent=school.name||'School');
    const topbarLogo=document.getElementById('topbar-logo-img'); if(topbarLogo&&school.logo) topbarLogo.src=school.logo; const sidebarLogo=document.getElementById('sidebar-logo-img'); if(sidebarLogo&&school.logo) sidebarLogo.src=school.logo;
    const u=this.currentUser;
    const initials=(u.name||'User').split(' ').map(n=>n[0]||'').join('').slice(0,2).toUpperCase()||'U';
    ['user-av','sb-user-av'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.textContent=initials; if(u.avatar){ el.innerHTML=`<img src="${u.avatar}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; } }});
    const el=document.getElementById('user-chip-name'); if(el) el.textContent=(u.name||'User').split(' ')[0]||'User';
    const er=document.getElementById('user-chip-role'); if(er) er.textContent=this.roleLabel(u.role);
    const sn=document.getElementById('sb-user-name'); if(sn) sn.textContent=u.name;
    const sr=document.getElementById('sb-user-role'); if(sr) sr.textContent=this.roleLabel(u.role);
    const av=document.getElementById('av-preview'); if(av){ av.textContent=initials; if(u.avatar) av.innerHTML=`<img src="${u.avatar}" style="width:100%;height:100%;border-radius:99px;object-fit:cover">`; }
    const h=new Date().getHours();
    const g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    const dw=document.getElementById('dash-welcome'); if(dw) dw.textContent=`${g}, ${(u.name||'User').split(' ')[0]||'User'}! Here's your school overview.`;
    const heroToday=document.getElementById('dash-hero-today'); if(heroToday){ const dn=new Date(); heroToday.textContent=dn.toLocaleDateString('default',{day:'numeric',month:'short'}); } // legacy fallback
    // New hero elements — reuse school already fetched above
    const _dn=new Date();
    const hsn=document.getElementById('dash-hero-school-name'); if(hsn) hsn.textContent=school.name||'Eduformium SMS';
    const htf=document.getElementById('dash-hero-today-full'); if(htf) htf.textContent=_dn.toLocaleDateString('default',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
    const hyr=document.getElementById('dash-hero-year'); if(hyr) hyr.textContent=school.academicYear||'—';
    const htr=document.getElementById('dash-hero-term'); if(htr) htr.textContent=school.currentTerm||'—';
  },

  roleLabel(r){ return {admin:'Administrator',teacher:'Teacher',accountant:'Accountant',librarian:'Librarian',staff:'Staff'}[r]||r; },

  // ══ ROLE-BASED ACCESS CONTROL ══
  // Single source of truth for all permissions across the app.
  // Roles: admin | teacher | accountant | librarian | staff

  PERMISSIONS: {
    nav: {
      dashboard:  ['admin','teacher','accountant','librarian','staff'],
      students:   ['admin','teacher','accountant'],
      classes:    ['admin','teacher'],
      attendance: ['admin','teacher'],
      exams:      ['admin','teacher'],
      timetable:  ['admin','teacher'],
      homework:   ['admin','teacher'],
      staff:      ['admin'],
      payroll:    ['admin','accountant'],
      leave:      ['admin','teacher','accountant','librarian','staff'],
      fees:       ['admin','accountant'],
      expenses:   ['admin','accountant'],
      messages:   ['admin','teacher','accountant','librarian','staff'],
      library:    ['admin','teacher','librarian'],
      events:     ['admin','teacher','accountant','librarian','staff'],
      reports:    ['admin','teacher','accountant'],
      audit:      ['admin'],
      settings:   ['admin','teacher','accountant','librarian','staff'],
    },
    buttons: {
      // Students
      'add-student-btn':     ['admin'],
      'import-students-btn': ['admin'],
      'promote-btn':         ['admin'],
      'exp-students-btn':    ['admin'],
      'send-reminder-btn':   ['admin','accountant'],
      // Classes
      'add-class-btn':       ['admin'],
      'add-subject-btn':     ['admin'],
      // Attendance
      'take-att-btn':        ['admin','teacher'],
      'save-attendance-btn': ['admin','teacher'],
      'print-att-btn':       ['admin','teacher'],
      // Exams
      'add-exam-btn':        ['admin','teacher'],
      'save-grades-btn':     ['admin','teacher'],
      // Timetable
      'tt-design-btn':       ['admin'],
      'edit-tt-btn':         ['admin'],
      // Homework
      'add-hw-btn':          ['admin','teacher'],
      // Staff
      'add-staff-btn':       ['admin'],
      'exp-staff-btn':       ['admin'],
      // Payroll
      'process-payroll-btn': ['admin','accountant'],
      'exp-payroll-btn':     ['admin','accountant'],
      // Leave
      'add-leave-btn':       ['admin','teacher','accountant','librarian','staff'],
      // Fees
      'add-fee-btn':         ['admin','accountant'],
      'add-fee-struct-btn':  ['admin','accountant'],
      'exp-fees-btn':        ['admin','accountant'],
      // Expenses
      'add-expense-btn':     ['admin','accountant'],
      // Messages
      'compose-btn':         ['admin','teacher','accountant','librarian','staff'],
      // Library
      'add-book-btn':        ['admin','librarian'],
      'borrow-btn':          ['admin','librarian','teacher'],
      // Events
      'add-event-btn':       ['admin'],
      // Audit
      'clear-audit-btn':     ['admin'],
      'exp-audit-btn':       ['admin'],
      // Settings
      'add-user-btn':        ['admin'],
      'backup-btn':          ['admin'],
      'save-school-btn':     ['admin'],
      'save-academic-btn':   ['admin'],
    },
    settingsTabs: {
      school:     ['admin','teacher','accountant','librarian','staff'],
      profile:    ['admin','teacher','accountant','librarian','staff'],
      security:   ['admin','teacher','accountant','librarian','staff'],
      appearance: ['admin','teacher','accountant','librarian','staff'],
      academic:   ['admin'],
      users:      ['admin'],
      'sms-notif':['admin'],
      data:       ['admin'],
    },
  },

  // Check if current user has one of the given roles
  hasRole(...roles){ return roles.includes(this.currentUser?.role||'staff'); },

  // Check if current user can access a nav page
  canAccess(page){
    const allowed = this.PERMISSIONS.nav[page];
    return !allowed || allowed.includes(this.currentUser?.role||'staff');
  },

  // Apply all role-based permissions (sidebar, buttons, settings tabs)
  applyRolePermissions(){
    const role = this.currentUser?.role || 'staff';

    // ── 1. Sidebar navigation items ──
    document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
      const page = el.dataset.page;
      const allowed = this.PERMISSIONS.nav[page];
      el.style.display = (!allowed || allowed.includes(role)) ? '' : 'none';
    });
    // Hide empty nav group labels
    document.querySelectorAll('.nav-group').forEach(group=>{
      const items = group.querySelectorAll('.nav-item[data-page]');
      const anyVisible = Array.from(items).some(i=>i.style.display!=='none');
      const label = group.querySelector('.nav-label');
      if(label) label.style.display = anyVisible ? '' : 'none';
    });

    // ── 2. Action buttons ──
    Object.entries(this.PERMISSIONS.buttons).forEach(([id, roles])=>{
      const el = document.getElementById(id);
      if(el) el.style.display = roles.includes(role) ? '' : 'none';
    });

    // ── 3. Legacy admin-only elements not in the buttons map ──
    document.querySelectorAll('.admin-only').forEach(el=>{
      // Only apply if not already controlled by the buttons map above
      if(!el.id || !this.PERMISSIONS.buttons[el.id]){
        el.style.display = role==='admin' ? '' : 'none';
      }
    });

    // ── 4. Settings tabs ──
    document.querySelectorAll('.stab[data-stab]').forEach(tab=>{
      const stab = tab.dataset.stab;
      const allowed = this.PERMISSIONS.settingsTabs[stab];
      tab.style.display = (!allowed || allowed.includes(role)) ? '' : 'none';
    });
  },

  nav(page){
    // Guard: redirect unauthorized access to first allowed page
    if(this.currentUser && !this.canAccess(page)){
      const _fallback=Object.keys(this.PERMISSIONS.nav).find(p=>this.canAccess(p))||'dashboard';
      this.toast(`You don't have access to that page`,'warn');
      page=_fallback;
    }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const pe=document.getElementById('page-'+page); if(pe) pe.classList.add('active');
    const ne=document.querySelector(`.nav-item[data-page="${page}"]`); if(ne) ne.classList.add('active');
    const tt=document.getElementById('topbar-title'); if(tt) tt.textContent=ne?.textContent.trim()||page;
    const schoolName=DB.get('school',{}).name||'Eduformium SMS';
    const pageName=ne?.textContent.trim()||page.charAt(0).toUpperCase()+page.slice(1);
    document.title=`${pageName} — ${schoolName}`;
    // Stop dashboard auto-refresh when leaving the dashboard page
    if(page !== 'dashboard' && this._dashRefreshTimer){
      clearInterval(this._dashRefreshTimer);
      this._dashRefreshTimer = null;
    }
    if(page !== 'dashboard' && this._freshTimer){
      clearInterval(this._freshTimer);
      this._freshTimer = null;
    }
    this.currentPage=page;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
    document.body.classList.remove('sidebar-open');
    const loaders={dashboard:()=>this.loadDashboard(),students:()=>this.loadStudents(),classes:()=>this.loadClasses(),attendance:()=>this.loadAttendance(),exams:()=>this.loadExams(),timetable:()=>this.loadTimetable(),homework:()=>this.loadHomework(),staff:()=>this.loadStaff(),payroll:()=>this.loadPayroll(),leave:()=>this.loadLeave(),fees:()=>this.loadFees(),expenses:()=>this.loadExpenses(),messages:()=>this.loadMessages(),library:()=>this.loadLibrary(),events:()=>this.loadEvents(),reports:()=>{},audit:()=>this.renderAudit(),settings:()=>this.loadSettings()};
    if(loaders[page]) loaders[page]();
  },

  bindNav(){
    // ── Sidebar: unified open/close for all screen sizes ──
    const _openSidebar = () => {
      const sb = document.getElementById('sidebar');
      sb.classList.add('open');
      document.body.classList.add('sidebar-open');
      let ov = document.getElementById('sidebar-overlay');
      if(!ov){
        ov = document.createElement('div');
        ov.id = 'sidebar-overlay';
        ov.className = 'sidebar-overlay';
        document.body.appendChild(ov);
      }
      ov.classList.add('show');
      ov.onclick = _closeSidebar;
    };
    const _closeSidebar = () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('show');
      document.body.classList.remove('sidebar-open');
    };

    document.querySelectorAll('.nav-item[data-page]').forEach(item => item.addEventListener('click', () => {
      this.nav(item.dataset.page);
      _closeSidebar();
    }));
    document.getElementById('menu-btn')?.addEventListener('click', () => {
      const isOpen = document.getElementById('sidebar')?.classList.contains('open');
      isOpen ? _closeSidebar() : _openSidebar();
    });
    document.getElementById('sb-close')?.addEventListener('click', _closeSidebar);
    document.getElementById('user-chip')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('sb-user-card')?.addEventListener('click',()=>this.nav('settings'));
    document.getElementById('logout-btn')?.addEventListener('click',()=>this.logout());
    document.getElementById('sb-logout')?.addEventListener('click',()=>this.logout());
    document.getElementById('theme-btn')?.addEventListener('click',()=>this.toggleTheme());
    document.getElementById('search-btn')?.addEventListener('click',()=>{ const so=document.getElementById('search-overlay'); so.style.display='flex'; document.getElementById('global-search-input').focus(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ const so=document.getElementById('search-overlay'); if(so&&so.style.display!=='none') so.style.display='none'; } });
    document.getElementById('global-search-input')?.addEventListener('input',e=>this.globalSearch(e.target.value));
    document.getElementById('notif-btn')?.addEventListener('click',()=>{ const p=document.getElementById('notif-panel'); p.style.display=p.style.display==='none'?'block':'none'; });
    document.getElementById('notif-clear')?.addEventListener('click',()=>this.clearAllNotifs());
    document.addEventListener('click',e=>{ if(!document.getElementById('notif-wrap')?.contains(e.target)) document.getElementById('notif-panel').style.display='none'; });
    document.querySelectorAll('.stab').forEach(t=>t.addEventListener('click',()=>{ document.querySelectorAll('.stab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.spane').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const p=document.getElementById('sp-'+t.dataset.stab); if(p) p.classList.add('active'); if(t.dataset.stab==='users') this.renderUsers(); if(t.dataset.stab==='data') this.renderBackupStats(); if(t.dataset.stab==='school') this.loadSchoolSettings(); if(t.dataset.stab==='appearance') this.loadAppearanceSettings(); if(t.dataset.stab==='sms-notif') this.loadSmsSettings(); if(t.dataset.stab==='profile') this.loadProfileSettings(); if(t.dataset.stab==='academic') this.loadAcademicSettings(); }));
    document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{ const g=t.closest('.tabs'); if(!g) return; g.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const panes=t.closest('.page')?.querySelectorAll('.tab-pane'); panes?.forEach(p=>{ p.classList.remove('active'); if(p.id===t.dataset.tab) p.classList.add('active'); }); }));
    document.querySelectorAll('.mtab').forEach(t=>t.addEventListener('click',()=>{ const mb=t.closest('.modal-body'); mb?.querySelectorAll('.mtab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); mb?.querySelectorAll('.modal-tab-pane').forEach(p=>{ p.classList.remove('active'); if(p.id===t.dataset.mtab) p.classList.add('active'); }); }));
    document.querySelectorAll('.msg-tab').forEach(t=>t.addEventListener('click',()=>{ document.querySelectorAll('.msg-tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); this.renderMessages(t.dataset.mtab); }));
    document.getElementById('del-confirm-btn')?.addEventListener('click',()=>{ if(this.deleteCallback){ this.deleteCallback(); this.deleteCallback=null; } this.closeModal('m-delete'); });
  },

  // ── Session timeout: auto logout after 8 hours of inactivity ──
  _sessionTimer: null,
  _resetSessionTimer(){
    clearTimeout(this._sessionTimer);
    const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
    this._sessionTimer = setTimeout(()=>{
      if(this.currentUser){
        this.toast('Session expired. Please sign in again.','warn');
        setTimeout(()=>this.logout(), 2000);
      }
    }, SESSION_TIMEOUT);
  },
  _startSessionWatch(){
    ['click','keydown','touchstart','mousemove'].forEach(evt=>{
      document.addEventListener(evt, ()=>this._resetSessionTimer(), {passive:true});
    });
    this._resetSessionTimer();
  },

  async logout(){
    clearTimeout(this._sessionTimer);
    this.audit('Logout','login',`${this.currentUser.name} signed out`);
    if(window.FAuth) await FAuth.logout();
    DB.del('session'); this.currentUser=null; this.schoolId=null;
    const syncEl=document.getElementById('sync-status');
    if(syncEl) syncEl.style.display='none';
    if(this._demoMode){
      const _dc=['students','staff','classes','subjects','feePayments','feeStructure',
        'exams','grades','attendance','events','messages','leaves','homework','books',
        'expenses','payroll','auditLog','timetable','school','users'];
      _dc.forEach(c=>{try{localStorage.removeItem('sms_'+c);}catch{}});
      DB.del('seeded');
    }
    this._demoMode=false;
    document.getElementById('app').style.display='none';
    document.getElementById('login-screen').style.display='flex';
    const lu=document.getElementById('l-user'); if(lu) lu.value='';
    const lp=document.getElementById('l-pass'); if(lp) lp.value='';
  },


  // ── Core UI utilities ──
  toast(msg,type='success'){
    const t=document.getElementById('toast'); const m=document.getElementById('toast-msg');
    t.className='toast '+type; m.textContent=msg; t.classList.add('show');
    clearTimeout(this._toastTimer); this._toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
  },

  audit(action,type,details){
    const log=DB.get('auditLog',[]); log.push({id:uid('al'),action,type,user:this.currentUser?.name||'System',details,time:new Date().toISOString()});
    if(log.length>500) log.splice(0,log.length-500);
    DB.set('auditLog',log);
    this.loadNotifications(); // keep badge fresh after every action
  },

  openModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display='flex';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    document.body.style.overflow='hidden';
    // Focus first focusable element
    requestAnimationFrame(()=>{
      const focusable = modal.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if(focusable.length) focusable[0].focus();
    });
    // Trap focus within modal
    modal._trapFocus = (e)=>{
      if(e.key!=='Tab') return;
      const focusable = [...modal.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length) return;
      const first=focusable[0], last=focusable[focusable.length-1];
      if(e.shiftKey){ if(document.activeElement===first){ last.focus(); e.preventDefault(); } }
      else { if(document.activeElement===last){ first.focus(); e.preventDefault(); } }
    };
    modal._escClose = (e)=>{ if(e.key==='Escape') this.closeModal(id); };
    document.addEventListener('keydown', modal._trapFocus);
    document.addEventListener('keydown', modal._escClose);
  },
  closeModal(id){
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display='none';
    document.body.style.overflow='';
    if(modal._trapFocus) document.removeEventListener('keydown', modal._trapFocus);
    if(modal._escClose) document.removeEventListener('keydown', modal._escClose);
  },

  confirmDelete(msg,callback){
    document.getElementById('del-msg').textContent=msg;
    this.deleteCallback=callback;
    this.openModal('m-delete');
  },

  loadTheme(){
    const dark=DB.get('darkMode',false);
    if(dark){ document.documentElement.dataset.theme='dark'; const sun=document.querySelector('.icon-sun'), moon=document.querySelector('.icon-moon'); if(sun) sun.style.display='none'; if(moon) moon.style.display=''; }
    const saved=DB.get('themeColors'); if(saved) this.applyThemeColors(saved.primary,saved.teal,false);
    const sz=DB.get('fontSize'); if(sz){ const sizes={small:'13px',medium:'15px',large:'17px'}; document.documentElement.style.fontSize=sizes[sz]; }
  },

  applyThemeColors(primary,teal,save=true,name=null){
    // Validate hex colors before applying to avoid broken CSS variables
    const hexRe=/^#[0-9a-fA-F]{6}$/;
    if(!hexRe.test(primary)||!hexRe.test(teal)){ console.warn('applyThemeColors: invalid hex',primary,teal); return; }
    const isDark=document.documentElement.dataset.theme==='dark';
    // In dark mode, brand color must be lightened so text using var(--brand) is visible on dark backgrounds
    const brandDisplay=isDark?this.lighten(primary,0.55):primary;
    const tealDisplay=isDark?this.lighten(teal,0.35):teal;
    document.documentElement.style.setProperty('--brand',brandDisplay);
    document.documentElement.style.setProperty('--brand-dk',isDark?this.darken(brandDisplay,0.1):this.darken(primary,0.15));
    document.documentElement.style.setProperty('--brand-teal',tealDisplay);
    document.documentElement.style.setProperty('--brand-teal-dk',isDark?this.darken(tealDisplay,0.1):this.darken(teal,0.15));
    document.documentElement.style.setProperty('--brand-lt',this.hexToRgba(isDark?primary:primary,isDark?0.15:0.08));
    document.documentElement.style.setProperty('--brand-lt2',this.hexToRgba(primary,isDark?0.25:0.15));
    document.documentElement.style.setProperty('--brand-teal-lt',this.hexToRgba(teal,isDark?0.15:0.08));
    // Store the original base colors (not the lightened display colors)
    document.documentElement.style.setProperty('--brand-base',primary);
    document.documentElement.style.setProperty('--brand-teal-base',teal);
    if(save) DB.set('themeColors',{primary,teal,name:name||null});
    this._dashDataFingerprint=null;
  },

  applyCustomTheme(){ const p=document.getElementById('custom-primary-hex')?.value?.trim(); const t=document.getElementById('custom-teal-hex')?.value?.trim(); const hexRe=/^#[0-9a-fA-F]{6}$/; if(!hexRe.test(p)||!hexRe.test(t)){ this.toast('Please enter valid 6-digit hex colors (e.g. #1a3a6b).','danger'); return; } document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active')); this.applyThemeColors(p,t,true,null); this.toast('Custom theme applied!','success'); },

  toggleTheme(){ const isDark=document.documentElement.dataset.theme==='dark'; document.documentElement.dataset.theme=isDark?'light':'dark'; DB.set('darkMode',!isDark); const sun=document.querySelector('.icon-sun'), moon=document.querySelector('.icon-moon'); if(sun) sun.style.display=isDark?'':'none'; if(moon) moon.style.display=isDark?'none':''; const tog=document.getElementById('dark-mode-toggle'); if(tog){ tog.checked=!isDark; tog.dispatchEvent(new Event('change')); } if(this.currentPage&&['expenses','events'].includes(this.currentPage)){ this.nav(this.currentPage); }
    // Re-apply theme colors now that the theme has switched, so --brand adapts correctly
    const saved=DB.get('themeColors'); if(saved) this.applyThemeColors(saved.primary,saved.teal,false); },

  darken(hex,pct){ hex=hex.replace('#',''); let r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); r=Math.max(0,Math.floor(r*(1-pct))); g=Math.max(0,Math.floor(g*(1-pct))); b=Math.max(0,Math.floor(b*(1-pct))); return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); },

  lighten(hex,pct){ hex=hex.replace('#',''); let r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); r=Math.min(255,Math.round(r+(255-r)*pct)); g=Math.min(255,Math.round(g+(255-g)*pct)); b=Math.min(255,Math.round(b+(255-b)*pct)); return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); },



  hexToRgba(hex,a){ hex=hex.replace('#',''); const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); return `rgba(${r},${g},${b},${a})`; },

};


// ── BOOT ──
document.addEventListener('DOMContentLoaded',()=>SMS.init());
window.SMS=SMS;

// ── PWA INSTALL BANNER ──
const PWABanner = (() => {
  const DISMISSED_KEY = 'sms_pwa_banner_dismissed';
  let _prompt = null;
  let _ready  = false;
  let _login  = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }

  function isDismissed() {
    // If currently running as installed PWA, don't show the banner
    if (isStandalone()) return true;
    return localStorage.getItem(DISMISSED_KEY) === 'session';
  }

  function show() {
    if (isDismissed()) return;
    const el = document.getElementById('pwa-banner');
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = 'translateY(100%)';
    el.style.display    = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform .38s cubic-bezier(.34,1.4,.64,1)';
      el.style.transform  = 'translateY(0)';
    }));
  }

  function hide(permanent) {
    const el = document.getElementById('pwa-banner');
    if (el) {
      el.style.transition = 'transform .28s ease-in';
      el.style.transform  = 'translateY(100%)';
      setTimeout(() => { el.style.display = 'none'; }, 290);
    }
    // 'session' = hide for this tab only; clears on next page load
    // We never permanently block — uninstalling should restore the banner
    if (permanent) localStorage.setItem(DISMISSED_KEY, 'session');
  }

  function tryShow() {
    _login = true;
    if (_ready) show();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Clear any leftover session dismiss so the banner can show again
    localStorage.removeItem(DISMISSED_KEY);
    _prompt = e;
    _ready  = true;
    if (_login) show();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#pwa-install-btn')) {
      if (!_prompt) return;
      _prompt.prompt();
      _prompt.userChoice.then(({ outcome }) => {
        hide(outcome === 'accepted');
        _prompt = null;
      });
    }
    if (e.target.closest('#pwa-close-btn')) {
      hide(true); // session-dismiss on X
    }
  });

  // Once installed, the browser stops firing beforeinstallprompt
  // so no need to do anything special here
  window.addEventListener('appinstalled', () => {
    const el = document.getElementById('pwa-banner');
    if (el) el.style.display = 'none';
  });

  return { tryShow };
})();

// ══════════════════════════════════════════════════════
//  OFFLINE LAUNCH SCREEN CONTROLLER
//  • Shows ONLY if the page loads with no internet
//  • Does NOT show if internet drops during an active session
//  • Auto-reloads when connection is restored
// ══════════════════════════════════════════════════════
const offlineScreen = (() => {
  const SCREEN   = 'offline-screen';
  const RETRY_BTN  = 'offs-retry-btn';
  const RETRY_ICON = 'offs-retry-icon';
  const RETRY_SPIN = 'offs-spin';
  const RETRY_LBL  = 'offs-retry-label';
  const CARD       = 'offs-card';

  // Was the app launched offline? Latched at boot.
  let _launchOffline = false;
  let _retryTimer    = null;

  function _getEl(id) { return document.getElementById(id); }

  function show() {
    const el = _getEl(SCREEN);
    if (!el) return;
    el.style.display = 'flex';
    _resetBtn();
  }

  function hide() {
    const el = _getEl(SCREEN);
    if (el) el.style.display = 'none';
    clearTimeout(_retryTimer);
    _launchOffline = false; // screen cleared — no longer in launch-offline state
  }

  function _resetBtn() {
    const btn  = _getEl(RETRY_BTN);
    const icon = _getEl(RETRY_ICON);
    const spin = _getEl(RETRY_SPIN);
    const lbl  = _getEl(RETRY_LBL);
    if (btn)  { btn.disabled = false; }
    if (icon) { icon.style.display = ''; }
    if (spin) { spin.style.display = 'none'; }
    if (lbl)  { lbl.textContent = 'Try Again'; }
  }

  function _shakeFail() {
    const card = _getEl(CARD);
    if (!card) return;
    card.classList.remove('offs-shaking');
    // Force reflow then re-add
    void card.offsetWidth;
    card.classList.add('offs-shaking');
    card.addEventListener('animationend', () => card.classList.remove('offs-shaking'), { once: true });
  }

  // ── Called by onclick on the Try Again button ──
  function retry() {
    const btn  = _getEl(RETRY_BTN);
    const icon = _getEl(RETRY_ICON);
    const spin = _getEl(RETRY_SPIN);
    const lbl  = _getEl(RETRY_LBL);
    if (btn)  { btn.disabled = true; }
    if (icon) { icon.style.display = 'none'; }
    if (spin) { spin.style.display = 'block'; }
    if (lbl)  { lbl.textContent = 'Checking…'; }

    clearTimeout(_retryTimer);
    _retryTimer = setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        _resetBtn();
        _shakeFail();
      }
    }, 2200);
  }

  // ── Called by onclick on the Exit App button ──
  function quit() {
    window.close();
    // Fallback: blank goodbye page if close() was blocked
    setTimeout(() => {
      document.body.innerHTML = `
        <div style="
          min-height:100dvh;display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          background:#07111f;color:rgba(140,175,210,.6);
          font-family:'DM Sans',sans-serif;
          text-align:center;padding:2rem;gap:1.2rem
        ">
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="rgba(13,148,136,.35)" stroke-width="2"/>
            <path d="M22 32h20M36 26l6 6-6 6" stroke="#0d9488" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p style="font-size:1rem;font-weight:700;color:rgba(220,235,248,.7);margin:0">You've closed Eduformium SMS</p>
          <p style="font-size:.8rem;margin:0">Come back when you have an internet connection.</p>
        </div>`;
    }, 400);
  }

  // ════════════════════════════════════════
  //  BOOT — only show on LAUNCH without internet
  // ════════════════════════════════════════
  function _boot() {
    if (!navigator.onLine) {
      _launchOffline = true;
      show();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    setTimeout(_boot, 100); // let DOM settle
  }

  // Auto-hide & reload once connection restores — ONLY if we launched offline
  window.addEventListener('online', () => {
    if (!_launchOffline) return; // user was already logged in — do nothing
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 900);
  });

  // NOTE: 'offline' event is intentionally NOT wired to show()
  // Active sessions handle connectivity gracefully without a blocking screen.

  return { show, hide, retry, quit };
})();

// ── Global helpers called from HTML onclick attributes ──
function offlineScreenRetry() { offlineScreen.retry(); }
