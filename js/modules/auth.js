// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Auth — bindForms · login · register · OTP
// ══════════════════════════════════════════

Object.assign(SMS, {
  // ── AUTH ──
  bindForms(){
    if(this._formsBound) return;
    this._formsBound = true;
    document.getElementById('try-demo-btn')?.addEventListener('click',()=>{
      this._demoMode = true;
      // Force reseed so demo credentials always exist regardless of prior state
      DB.set('seeded', false);
      seedData();
      const users = DB.get('users',[]);
      const demoUser = users.find(u=>u.email==='demo@brightfutureacademy.edu.gh');
      if(demoUser){
        demoUser.lastLogin = new Date().toISOString();
        DB.set('users', users);
        DB.set('session', {userId: demoUser.id});
        this.currentUser = demoUser;
        this.boot();
      } else {
        this._demoMode = false;
        this.toast('Demo account could not be loaded. Please refresh and try again.','danger');
      }
    });
    document.getElementById('login-btn')?.addEventListener('click',()=>this.login());
    document.getElementById('l-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') this.login(); });
    document.getElementById('l-pass-toggle')?.addEventListener('click',function(){ const i=document.getElementById('l-pass'); const on=this.querySelector('.eye-on'),off=this.querySelector('.eye-off'); if(i.type==='password'){ i.type='text'; on.style.display='none'; off.style.display=''; }else{ i.type='password'; on.style.display=''; off.style.display='none'; } });
    document.getElementById('forgot-pw-btn')?.addEventListener('click',()=>{
      const email=document.getElementById('l-user').value.trim();
      if(!email){ this.toast('Please enter your email address first.','warn'); return; }
      if(window.FAuth){
        FAuth.sendPasswordReset(email).then(r=>{
          if(r.success) this.toast('Password reset email sent. Please check your inbox.','success');
          else this.toast('Could not send reset email. Please contact your administrator.','danger');
        });
      } else {
        this.toast('Please contact your school administrator to reset your password.','info');
      }
    });
    document.getElementById('go-register')?.addEventListener('click',()=>{ document.getElementById('auth-signin').style.display='none'; document.getElementById('auth-register').style.display='block'; });
    document.getElementById('go-signin')?.addEventListener('click',()=>{ document.getElementById('auth-register').style.display='none'; document.getElementById('auth-signin').style.display='block'; });
    document.getElementById('register-btn')?.addEventListener('click',()=>this.startOTPFlow());
    // OTP screen listeners
    document.getElementById('otp-verify-btn')?.addEventListener('click',()=>this.verifyOTP());
    document.getElementById('otp-resend-btn')?.addEventListener('click',()=>this.resendOTP());
    document.getElementById('otp-back-btn')?.addEventListener('click',()=>{ document.getElementById('auth-otp').style.display='none'; document.getElementById('auth-register').style.display='block'; this.clearOTPState(); });
    this.initOTPBoxes();
    document.getElementById('add-student-btn')?.addEventListener('click',()=>this.openStudentModal());
    document.getElementById('save-student-btn')?.addEventListener('click',()=>this.saveStudent());
    ['s-search','s-class-f','s-status-f','s-gender-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderStudents()));
    document.getElementById('s-search')?.addEventListener('input',()=>this.renderStudents());
    document.getElementById('s-reset')?.addEventListener('click',()=>{ ['s-search','s-class-f','s-status-f','s-gender-f'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; }); this.renderStudents(); });
    document.getElementById('exp-students-btn')?.addEventListener('click',()=>this.exportStudents());
    document.getElementById('add-staff-btn')?.addEventListener('click',()=>this.openStaffModal());
    document.getElementById('save-staff-btn')?.addEventListener('click',()=>this.saveStaff());
    document.getElementById('staff-search')?.addEventListener('input',()=>this.renderStaff());
    ['staff-dept-f','staff-role-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderStaff()));
    document.getElementById('exp-staff-btn')?.addEventListener('click',()=>this.exportStaff());
    document.getElementById('add-class-btn')?.addEventListener('click',()=>this.openClassModal());
    document.getElementById('save-class-btn')?.addEventListener('click',()=>this.saveClass());
    document.getElementById('add-subject-btn')?.addEventListener('click',()=>this.openSubjectModal());
    document.getElementById('save-subject-btn')?.addEventListener('click',()=>this.saveSubject());
    document.getElementById('take-att-btn')?.addEventListener('click',()=>this.openAttendanceForm());
    document.getElementById('att-all-present')?.addEventListener('click',()=>this.markAllAtt('present'));
    document.getElementById('att-all-absent')?.addEventListener('click',()=>this.markAllAtt('absent'));
    document.getElementById('save-attendance-btn')?.addEventListener('click',()=>this.saveAttendance());
    document.getElementById('att-filter-btn')?.addEventListener('click',()=>this.renderAttendanceRecords());
    document.getElementById('add-exam-btn')?.addEventListener('click',()=>this.openExamModal());
    document.getElementById('save-exam-btn')?.addEventListener('click',()=>this.saveExam());
    document.getElementById('load-grade-btn')?.addEventListener('click',()=>this.loadGradeEntry());
    document.getElementById('save-grades-btn')?.addEventListener('click',()=>this.saveGrades());
    document.getElementById('load-results-btn')?.addEventListener('click',()=>this.loadResults());
    document.getElementById('report-card-btn')?.addEventListener('click',()=>this.showReportCards());
    document.getElementById('tt-class-sel')?.addEventListener('change',()=>this.renderTimetable());
    document.getElementById('add-fee-btn')?.addEventListener('click',()=>this.openFeeModal());
    document.getElementById('save-fee-btn')?.addEventListener('click',()=>this.saveFee());
    document.getElementById('fee-search')?.addEventListener('input',()=>this.renderFees());
    ['fee-class-f','fee-term-f','fee-year-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{ this.renderFeesKpis(); this.renderFees(); this.renderFeeStructure(); this.renderDefaulters(); }));
    document.getElementById('exp-fees-btn')?.addEventListener('click',()=>this.exportFees());
    document.getElementById('add-fee-struct-btn')?.addEventListener('click',()=>this.openFeeStructModal());
    document.getElementById('add-expense-btn')?.addEventListener('click',()=>this.openExpenseModal());
    document.getElementById('add-event-btn')?.addEventListener('click',()=>this.openEventModal());
    document.getElementById('save-event-btn')?.addEventListener('click',()=>this.saveEvent());
    document.getElementById('compose-btn')?.addEventListener('click',()=>this.openComposeModal());
    document.getElementById('send-msg-btn')?.addEventListener('click',()=>this.sendMessage());
    document.getElementById('msg-to')?.addEventListener('change',e=>{ document.getElementById('msg-class-field').style.display=e.target.value==='specific-class'?'block':'none'; });
    document.getElementById('add-book-btn')?.addEventListener('click',()=>this.openBookModal());
    document.getElementById('borrow-btn')?.addEventListener('click',()=>this.openBookIssueModal());
    document.getElementById('lib-search')?.addEventListener('input',()=>this.renderLibrary());
    ['lib-cat-f','lib-status-f'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>this.renderLibrary()));
    document.getElementById('add-hw-btn')?.addEventListener('click',()=>this.openHomeworkModal());
    document.getElementById('add-leave-btn')?.addEventListener('click',()=>this.openLeaveModal());
    document.getElementById('process-payroll-btn')?.addEventListener('click',()=>this.processPayroll());
    document.getElementById('exp-audit-btn')?.addEventListener('click',()=>this.exportAudit());
    document.getElementById('exp-payroll-btn')?.addEventListener('click',()=>this.exportPayroll());
    document.getElementById('send-reminder-btn')?.addEventListener('click',()=>this.sendBulkReminders());
    document.getElementById('promote-btn')?.addEventListener('click',()=>this.openPromoteModal());
    document.getElementById('import-students-btn')?.addEventListener('click',()=>this.openImportModal());
    document.getElementById('print-att-btn')?.addEventListener('click',()=>this.printAttendanceSheet());
    document.getElementById('dash-refresh-btn')?.addEventListener('click',()=>this.refreshDashboard());
    document.getElementById('clear-audit-btn')?.addEventListener('click',()=>{ DB.set('auditLog',[]); this.renderAudit(); this.toast('Audit log cleared','warn'); });
    document.getElementById('audit-q')?.addEventListener('input',()=>this.renderAudit());
    document.getElementById('audit-type')?.addEventListener('change',()=>this.renderAudit());
    document.getElementById('gen-report-btn')?.addEventListener('click',()=>this.toast('Select a report type from the cards below','warn'));
    document.getElementById('save-school-btn')?.addEventListener('click',()=>this.saveSchool());
    document.getElementById('save-profile-btn')?.addEventListener('click',()=>this.saveProfile());
    document.getElementById('save-pw-btn')?.addEventListener('click',()=>this.changePassword());
    document.getElementById('save-academic-btn')?.addEventListener('click',()=>this.saveAcademic());
    document.getElementById('apply-custom-theme')?.addEventListener('click',()=>this.applyCustomTheme());
    document.getElementById('dark-mode-toggle')?.addEventListener('change',e=>{ document.documentElement.dataset.theme=e.target.checked?'dark':'light'; DB.set('darkMode',e.target.checked); const sun=document.querySelector('.icon-sun'),moon=document.querySelector('.icon-moon'); if(sun) sun.style.display=e.target.checked?'none':''; if(moon) moon.style.display=e.target.checked?'':'none'; this._dashDataFingerprint=null; if(document.getElementById('page-dashboard')?.classList.contains('active')) this.loadDashboard(); });
    document.querySelectorAll('.swatch[data-primary]').forEach(s=>s.addEventListener('click',()=>{ document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active')); s.classList.add('active'); this.applyThemeColors(s.dataset.primary,s.dataset.teal,true,s.dataset.themeName); }));
    document.getElementById('custom-primary')?.addEventListener('input',e=>{ document.getElementById('custom-primary-hex').value=e.target.value; });
    document.getElementById('custom-teal')?.addEventListener('input',e=>{ document.getElementById('custom-teal-hex').value=e.target.value; });
    document.getElementById('custom-primary-hex')?.addEventListener('input',e=>{ const v=e.target.value; if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('custom-primary').value=v; });
    document.getElementById('custom-teal-hex')?.addEventListener('input',e=>{ const v=e.target.value; if(/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('custom-teal').value=v; });
    document.querySelectorAll('.fsz-btn').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.fsz-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const sizes={small:'13px',medium:'15px',large:'17px'}; document.documentElement.style.fontSize=sizes[b.dataset.size]; DB.set('fontSize',b.dataset.size); }));
    document.getElementById('add-user-btn')?.addEventListener('click',()=>this.openUserModal());
    document.getElementById('save-user-btn')?.addEventListener('click',()=>this.saveUser());
    document.getElementById('save-sms-btn')?.addEventListener('click',()=>{
      const key=(document.getElementById('sms-key')?.value||'').trim();
      const settings=DB.get('smsSettings',{});
      settings.provider=document.getElementById('sms-provider')?.value||'hubtel';
      settings.sender=(document.getElementById('sms-sender')?.value||'').trim();
      settings.key=key;
      settings.secret=(document.getElementById('sms-secret')?.value||'').trim();
      settings.configured=!!(key);
      settings.masterEnabled=document.getElementById('sms-master')?.checked||false;
      settings.notifyAdmission=document.getElementById('smt-admission')?.checked||false;
      settings.notifyFee=document.getElementById('smt-fee')?.checked||false;
      settings.notifyReminder=document.getElementById('smt-reminder')?.checked||false;
      settings.notifyResults=document.getElementById('smt-results')?.checked||false;
      settings.notifyAttendance=document.getElementById('smt-attendance')?.checked||false;
      settings.notifyEvents=document.getElementById('smt-events')?.checked||false;
      DB.set('smsSettings',settings);
      this._updateSmsBadge(settings);
      this.audit('Settings','settings','SMS notification settings updated');
      this.toast('SMS settings saved','success');
    });
    document.getElementById('test-sms-btn')?.addEventListener('click',()=>{
      const s=DB.get('smsSettings',{});
      if(!s.configured||!s.key){ this.toast('SMS gateway not configured — enter your API key and save first.','warn'); return; }
      this.toast(`Test SMS would be sent via ${s.provider||'your provider'} (live sending not yet active in this build).`,'info');
    });
    document.getElementById('backup-btn')?.addEventListener('click',()=>this.exportBackup());
    document.getElementById('upload-logo-btn')?.addEventListener('click',()=>document.getElementById('logo-file').click());
    document.getElementById('logo-file')?.addEventListener('change',e=>this.uploadLogo(e));
    document.getElementById('upload-av-btn')?.addEventListener('click',()=>document.getElementById('av-file').click());
    document.getElementById('av-file')?.addEventListener('change',e=>this.uploadAvatar(e));
    document.getElementById('att-date').value=new Date().toISOString().split('T')[0];
    const now=new Date();
    const pm=document.getElementById('pay-month'); if(pm){ ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach((m,i)=>{ pm.innerHTML+=`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`; }); }
    const py=document.getElementById('pay-year'); if(py){ for(let y=2020;y<=2030;y++) py.innerHTML+=`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`; }
  },

  // ── Login rate limiting ──
  // SECURITY NOTE (F-04): This client-side lockout (5 attempts → 15 min) is a UX
  // convenience only. It can be bypassed by clearing localStorage or opening a
  // private window. For real brute-force protection, enable server-side rate limiting
  // in your Supabase dashboard: Authentication → Rate Limits → "Sign in attempts".
  // Recommended: 5 attempts per 15 minutes. No code change needed — Supabase handles it.
  _loginAttempts: {},
  _isLoginLocked(email){
    const k = 'sms_lock_' + btoa(email);
    try {
      const d = JSON.parse(localStorage.getItem(k)||'{}');
      if(d.until && Date.now() < d.until) return Math.ceil((d.until - Date.now())/60000);
      if(d.until && Date.now() >= d.until) localStorage.removeItem(k);
    } catch(e) {}
    return 0;
  },
  _recordLoginFail(email){
    const k = 'sms_lock_' + btoa(email);
    try {
      const d = JSON.parse(localStorage.getItem(k)||'{}');
      d.count = (d.count||0) + 1;
      if(d.count >= 5){ d.until = Date.now() + 15*60*1000; d.count = 0; }
      localStorage.setItem(k, JSON.stringify(d));
      return 5 - (d.count||0);
    } catch(e) { return 5; }
  },
  _clearLoginFail(email){
    try { localStorage.removeItem('sms_lock_' + btoa(email)); } catch(e) {}
  },

  async login(){
    const email=document.getElementById('l-user').value.trim();
    const pass=document.getElementById('l-pass').value;
    const errEl=document.getElementById('l-err');
    const btn=document.getElementById('login-btn');
    if(!email||!pass){ errEl.style.display='flex'; errEl.textContent='Please enter your email and password.'; return; }

    // Lockout check
    const minsLeft = this._isLoginLocked(email);
    if(minsLeft){ errEl.style.display='flex'; errEl.textContent=`Too many failed attempts. Try again in ${minsLeft} minute${minsLeft>1?'s':''}.`; return; }

    btn.disabled=true; btn.querySelector('span').textContent='Signing in…'; errEl.style.display='none';

    // Check localStorage only for demo account (role === 'demo') — not for real Supabase users
    const users=DB.get('users',[]);
    const localUser=users.find(u=>u.email===email);
    if(localUser && (localUser.role==='demo' || !window.FAuth)){
      const ok = await verifyPassword(pass, localUser.passwordHash || localUser.password || '');
      if(!ok){ this._recordLoginFail(email); errEl.style.display='flex'; errEl.textContent='Incorrect email or password.'; btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard'; return; }
      // Upgrade legacy plain-text or SHA-256 hash to PBKDF2 on first successful login
      if(!localUser.passwordHash || !localUser.passwordHash.startsWith('pbkdf2:')){
        localUser.passwordHash = await hashPassword(pass);
        delete localUser.password;
        DB.set('users',users);
      }
      this._demoMode = true;
      this._clearLoginFail(email);
      localUser.lastLogin=new Date().toISOString(); DB.set('users',users);
      DB.set('session',{userId:localUser.id});
      this.currentUser=localUser; this.audit('Login','login',`${localUser.name} signed in`);
      this.boot(); errEl.style.display='none'; return;
    }

    // Try Firebase if available
    if(!window.FAuth){ this._recordLoginFail(email); errEl.style.display='flex'; errEl.textContent='Incorrect email or password.'; btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard'; return; }
    const result=await FAuth.login(email,pass);
    if(!result.success){
      const rem = this._recordLoginFail(email);
      const msg = rem > 0 ? `${result.error} (${rem} attempt${rem!==1?'s':''} left before lockout)` : result.error;
      errEl.style.display='flex'; errEl.textContent=msg; btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard'; return;
    }
    this._clearLoginFail(email);
    // Firebase login succeeded. The onAuthStateChanged handler will now fire and handle
    // both school admins (uid === schoolId) and sub-users (uid from userIndex).
    // We only need to intercept here for school admins who are 'suspended' or 'pending'
    // so the UI can show the right screen before onAuthStateChanged fires.
    const _profile = await FDB.getSchoolProfile(result.uid).catch(()=>null);
    if(_profile){
      // This is a school admin — check approval status
      const _status = _profile.status || 'pending';
      if(_status === 'suspended'){
        btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard';
        document.getElementById('login-screen').style.display='none';
        this.showSuspendedScreen(_profile, email);
        return;
      }
      if(_status !== 'active'){
        btn.disabled=false; btn.querySelector('span').textContent='Sign In to Dashboard';
        document.getElementById('login-screen').style.display='none';
        this.showPendingScreen(_profile || {status:'pending', name:'', adminEmail:email}, email);
        return;
      }
    }
    // For sub-users (no school profile under their uid), onAuthStateChanged will handle boot.
  },

  // ══ OTP FLOW ══
  _otpState: {},

  initOTPBoxes() {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach((box, i) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        box.value = val ? val[0] : '';
        box.classList.toggle('otp-filled', !!box.value);
        if (val && i < boxes.length - 1) boxes[i + 1].focus();
        this._checkOTPComplete();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        boxes.forEach((b, j) => { b.value = paste[j] || ''; b.classList.toggle('otp-filled', !!b.value); });
        if (paste.length >= 6) boxes[5].focus();
        else if (paste.length > 0) boxes[Math.min(paste.length, 5)].focus();
        this._checkOTPComplete();
      });
      box.addEventListener('focus', () => { box.select(); });
    });
  },

  _checkOTPComplete() {
    const boxes = document.querySelectorAll('.otp-box');
    const complete = [...boxes].every(b => b.value.length === 1);
    const btn = document.getElementById('otp-verify-btn');
    if (btn) btn.disabled = !complete;
  },

  _getOTPValue() {
    return [...document.querySelectorAll('.otp-box')].map(b => b.value).join('');
  },

  _clearOTPBoxes(error = false) {
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach(b => {
      b.value = '';
      b.classList.remove('otp-filled');
      b.classList.toggle('otp-error', error);
    });
    if (error) setTimeout(() => boxes.forEach(b => b.classList.remove('otp-error')), 600);
    const btn = document.getElementById('otp-verify-btn');
    if (btn) btn.disabled = true;
  },

  clearOTPState() {
    this._otpState = {};
    this._clearOTPBoxes();
    clearInterval(this._otpCountdownTimer);
    clearInterval(this._otpResendTimer);
    const errEl = document.getElementById('otp-err');
    const successEl = document.getElementById('otp-success');
    if (errEl) errEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  },

  async startOTPFlow() {
    const school = document.getElementById('r-school').value.trim();
    const motto  = document.getElementById('r-motto').value.trim();
    const name   = document.getElementById('r-name').value.trim();
    const email  = document.getElementById('r-email').value.trim();
    const pwd    = document.getElementById('r-pwd').value;
    const cpwd   = document.getElementById('r-cpwd').value;
    const errEl  = document.getElementById('r-err');
    const btn    = document.getElementById('register-btn');

    if (!school || !name || !email || !pwd) { errEl.textContent = 'Please fill in all required fields.'; errEl.style.display = 'flex'; return; }
    if (school.length > 100) { errEl.textContent = 'School name must be under 100 characters.'; errEl.style.display = 'flex'; return; }
    if (name.length > 80) { errEl.textContent = 'Name must be under 80 characters.'; errEl.style.display = 'flex'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'flex'; return; }
    if (pwd !== cpwd) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'flex'; return; }
    if (pwd.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'flex'; return; }
    if (pwd.length > 128) { errEl.textContent = 'Password must be under 128 characters.'; errEl.style.display = 'flex'; return; }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Sending code…';
    errEl.style.display = 'none';

    // SECURITY FIX (F-05): OTP is now generated SERVER-SIDE in the Cloudflare Worker.
    // The browser only stores registration data for use after verification.
    // The OTP hash never touches the browser — console inspection cannot bypass it.
    this._otpState = { school, motto, name, email, pwd, expiresAt: Date.now() + 10 * 60 * 1000 };

    // Ask worker to generate OTP, store its hash in KV, and email the code
    const sent = await this._sendOTPEmail(email, name);
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create School Account';

    if (!sent) { errEl.textContent = 'Could not send verification email. Check your email and try again.'; errEl.style.display = 'flex'; return; }

    // Show OTP screen
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-otp').style.display = 'block';
    document.getElementById('otp-email-display').textContent = email;
    this._clearOTPBoxes();
    this._startOTPCountdown();
    this._startResendCooldown();
    setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
  },

  // SECURITY FIX (F-05): OTP is generated server-side. Browser only sends who to email.
  async _sendOTPEmail(email, name) {
    try {
      // ── RESEND via Cloudflare Worker proxy ──────────────────────────────
      // Deploy the worker from: /cloudflare-worker/otp-worker.js
      // Then paste your worker URL below (keep trailing slash off):
      const WORKER_URL = 'https://eduformium-otp.school-management.workers.dev';
      // ────────────────────────────────────────────────────────────────────

      const res = await fetch(`${WORKER_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_name:  name.split(' ')[0],
          to_email: email,
          // NOTE: No otp_code here — the worker generates it and stores the hash in KV.
          // The browser never sees the OTP value, so it cannot be inspected from the console.
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('OTP worker error:', err);
        return false;
      }
      return true;
    } catch (e) {
      console.error('OTP send error:', e);
      return false;
    }
  },

  _startOTPCountdown() {
    clearInterval(this._otpCountdownTimer);
    const el = document.getElementById('otp-countdown');
    const row = document.querySelector('.otp-timer-row');
    const tick = () => {
      const remaining = this._otpState.expiresAt - Date.now();
      if (remaining <= 0) {
        if (el) el.textContent = '0:00';
        if (row) row.classList.add('expired');
        const btn = document.getElementById('otp-verify-btn');
        if (btn) { btn.disabled = true; }
        clearInterval(this._otpCountdownTimer);
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      if (el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (row) row.classList.remove('expired');
    };
    tick();
    this._otpCountdownTimer = setInterval(tick, 1000);
  },

  _startResendCooldown(seconds = 60) {
    const btn = document.getElementById('otp-resend-btn');
    const timerEl = document.getElementById('otp-resend-timer');
    if (!btn || !timerEl) return;
    btn.disabled = true;
    let remaining = seconds;
    timerEl.textContent = `(${remaining}s)`;
    clearInterval(this._otpResendTimer);
    this._otpResendTimer = setInterval(() => {
      remaining--;
      timerEl.textContent = `(${remaining}s)`;
      if (remaining <= 0) {
        clearInterval(this._otpResendTimer);
        btn.disabled = false;
        timerEl.textContent = '';
      }
    }, 1000);
  },

  async resendOTP() {
    const { email, name } = this._otpState;
    if (!email) return;
    const btn = document.getElementById('otp-resend-btn');
    const successEl = document.getElementById('otp-success');
    const errEl = document.getElementById('otp-err');
    btn.disabled = true;

    // SECURITY FIX (F-05/F-06): Worker generates new OTP server-side and replaces KV entry.
    // Reset client-side expiry display to match new 10-minute window.
    this._otpState.expiresAt = Date.now() + 10 * 60 * 1000;

    const sent = await this._sendOTPEmail(email, name);
    if (sent) {
      errEl.style.display = 'none';
      successEl.style.display = 'flex';
      setTimeout(() => { if (successEl) successEl.style.display = 'none'; }, 4000);
      this._clearOTPBoxes();
      this._startOTPCountdown();
      this._startResendCooldown();
      setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
    } else {
      errEl.textContent = 'Failed to resend. Please try again.';
      errEl.style.display = 'flex';
      btn.disabled = false;
    }
  },

  async verifyOTP() {
    const entered = this._getOTPValue();
    const { school, motto, name, email, pwd, expiresAt } = this._otpState;
    const errEl = document.getElementById('otp-err');
    const btn = document.getElementById('otp-verify-btn');

    // Belt-and-suspenders client-side expiry for UX (server enforces it too)
    if (Date.now() > expiresAt) {
      errEl.textContent = 'This code has expired. Please request a new one.';
      errEl.style.display = 'flex';
      this._clearOTPBoxes(true);
      return;
    }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Verifying…';
    errEl.style.display = 'none';

    // SECURITY FIX (F-05): OTP verification is now entirely server-side.
    // The browser sends the entered code to the worker; the worker checks
    // the stored hash in KV. The browser never has access to the hash.
    try {
      const WORKER_URL = 'https://eduformium-otp.school-management.workers.dev';
      const res = await fetch(`${WORKER_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: entered }),
      });
      const result = await res.json();

      if (!result.success) {
        if (result.reason === 'expired') {
          errEl.textContent = 'This code has expired. Please request a new one.';
          errEl.style.display = 'flex';
          this._clearOTPBoxes(true);
          btn.disabled = false;
          btn.querySelector('span').textContent = 'Verify & Create Account';
          return;
        }
        if (result.reason === 'too_many_attempts') {
          errEl.textContent = 'Too many attempts. Please start registration again.';
          errEl.style.display = 'flex';
          this.clearOTPState();
          document.getElementById('auth-otp').style.display = 'none';
          document.getElementById('auth-register').style.display = 'block';
          return;
        }
        // wrong_code
        const rem = result.attemptsLeft ?? 0;
        errEl.textContent = rem > 0
          ? `Incorrect code. ${rem} attempt${rem !== 1 ? 's' : ''} left.`
          : 'Too many attempts. Please start registration again.';
        errEl.style.display = 'flex';
        this._clearOTPBoxes(true);
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Verify & Create Account';
        setTimeout(() => document.getElementById('otp-0')?.focus(), 100);
        return;
      }
    } catch (e) {
      errEl.textContent = 'Could not verify code — check your connection and try again.';
      errEl.style.display = 'flex';
      this._clearOTPBoxes(true);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Verify & Create Account';
      return;
    }

    // Code verified on server! Proceed to create account.
    errEl.style.display = 'none';

    if (!window.FAuth) {
      const users = DB.get('users', []);
      if (users.find(u => u.email === email)) { errEl.textContent = 'Email already registered.'; errEl.style.display = 'flex'; btn.disabled = false; btn.querySelector('span').textContent = 'Verify & Create Account'; return; }
      const sc = DB.get('school', {}); sc.name = school; sc.motto = motto || sc.motto; DB.set('school', sc);
      const newUser = { id: uid('u'), email, passwordHash: await hashPassword(pwd), name, role: 'admin', phone: '', createdAt: new Date().toISOString(), lastLogin: null };
      users.push(newUser); DB.set('users', users); DB.set('session', { userId: newUser.id }); this.currentUser = newUser;
      this.toast(`Welcome, ${name.split(' ')[0]}!`, 'success');
      this.clearOTPState();
      this.boot(); return;
    }

    this._registering = true;
    const result = await FAuth.register(school, name, email, pwd);
    if (result.success) {
      this.schoolId = result.uid; // FIX: set schoolId so pending screen polling starts immediately
      this.clearOTPState();
      document.getElementById('auth-otp').style.display = 'none';
      this.showPendingScreen({status:'pending', name:school, adminEmail:email}, email);
      if(window.FAuth) FAuth.logout().catch(()=>{}).finally(()=>{ this._registering = false; });
      else this._registering = false;
    } else {
      this._registering = false;
      errEl.textContent = result.error;
      errEl.style.display = 'flex';
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Verify & Create Account';
    }
  },

  async register() {
    // Legacy — now handled by startOTPFlow
    await this.startOTPFlow();
  },

  // ══ DASHBOARD ══
});