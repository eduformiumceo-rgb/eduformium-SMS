// EDUFORMIUM SMS — Supabase Integration (replaces firebase.js)
// Uses Supabase JS v2 UMD from CDN — plain script, no ES modules

const _isDev = window.location.hostname.startsWith('dev-') ||
               window.location.hostname.includes('localhost') ||
               window.location.hostname.includes('127.0.0.1');

console.log(_isDev ? '🧪 DEV Supabase' : '🚀 PROD Supabase');

// ⚠️ Fill in your actual Supabase URLs + anon keys
const _devConfig  = { url:'https://yayfpzjvdckyeaimvbwu.supabase.co',  anonKey:'sb_publishable_IE2Apab4IxvlVH5wTKg4EA_aCwelmGX'  };
const _prodConfig = { url:'https://czfhqqqnjprxwrlwmkox.supabase.co', anonKey:'sb_publishable_XsyjpHMOg-3VcAr-XC75Xg_nHkgO9ru' };
const _config = _isDev ? _devConfig : _prodConfig;

const _supabase = window.supabase.createClient(_config.url, _config.anonKey, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true },
});

// app.js uses camelCase; Supabase tables use snake_case
const _tableMap = { feePayments:'fee_payments', feeStructure:'fee_structure', auditLog:'audit_log' };
const _tbl = (n) => _tableMap[n] || n;

// All data tables: { id text, school_id text, data jsonb, created_at, updated_at }
// Schools table:   { id text, data jsonb, updated_at }
const _unpack = (row) => row ? { ...row.data, id:row.id } : null;

const FDB = {
  async getAll(sid, col) {
    try {
      const {data,error} = await _supabase.from(_tbl(col)).select('id,data').eq('school_id',sid);
      if(error) throw error;
      return (data||[]).map(_unpack);
    } catch(e){ console.error('FDB.getAll',col,e); return []; }
  },

  async set(sid, col, docId, payload) {
    try {
      const now = new Date().toISOString();
      const {error} = await _supabase.from(_tbl(col))
        .upsert({id:docId, school_id:sid, data:{...payload,updatedAt:now}, updated_at:now});
      if(error) throw error; return true;
    } catch(e){ console.error('FDB.set',col,e); return false; }
  },

  async add(sid, col, payload) {
    try {
      const now = new Date().toISOString();
      const {data:rows,error} = await _supabase.from(_tbl(col))
        .insert({school_id:sid, data:{...payload,createdAt:now}, created_at:now, updated_at:now})
        .select('id').single();
      if(error) throw error; return rows?.id||null;
    } catch(e){ return null; }
  },

  async delete(sid, col, docId) {
    try {
      const {error} = await _supabase.from(_tbl(col)).delete().eq('id',docId).eq('school_id',sid);
      if(error) throw error; return true;
    } catch(e){ return false; }
  },

  async saveSchoolProfile(sid, payload) {
    try {
      const {error} = await _supabase.from('schools')
        .upsert({id:sid, data:{...payload,updatedAt:new Date().toISOString()}, updated_at:new Date().toISOString()});
      if(error) throw error; return true;
    } catch(e){ console.error('FDB.saveSchoolProfile',e); return false; }
  },

  async getSchoolProfile(sid) {
    try {
      const {data,error} = await _supabase.from('schools').select('id,data').eq('id',sid).maybeSingle();
      if(error) throw error;
      return data ? {...data.data,id:data.id} : null;
    } catch(e){ return null; }
  },

  async setUserIndex(email, schoolId, userId, passwordHash, name, role) {
    try {
      const {error} = await _supabase.from('user_index')
        .upsert({email:email.toLowerCase(), school_id:schoolId, user_id:userId,
                 password_hash:passwordHash, name, role, updated_at:new Date().toISOString()});
      if(error) throw error; return true;
    } catch(e){ console.error('FDB.setUserIndex',e); return false; }
  },

  async getUserIndex(email) {
    try {
      const {data,error} = await _supabase.from('user_index').select('*')
        .eq('email',email.toLowerCase()).maybeSingle();
      if(error){ console.error('getUserIndex RLS/error:', error.message, '| email:', email); return null; }
      if(!data){ console.warn('getUserIndex: no row found for', email); return null; }
      return {email:data.email, schoolId:data.school_id, userId:data.user_id,
              passwordHash:data.password_hash, name:data.name, role:data.role};
    } catch(e){ console.error('getUserIndex exception:', e.message); return null; }
  },

  async deleteUserIndex(email) {
    try {
      const {error} = await _supabase.from('user_index').delete().eq('email',email.toLowerCase());
      if(error) throw error; return true;
    } catch(e){ return false; }
  },

  async batchWrite(sid, colName, items) {
    if(!items||!items.length) return true;
    try {
      const CHUNK=400; const now=new Date().toISOString();
      for(let i=0;i<items.length;i+=CHUNK){
        const rows=items.slice(i,i+CHUNK).map(item=>{
          const {id,...rest}=item;
          return {id:String(id||''), school_id:sid, data:{...rest,id:String(id||''),updatedAt:now}, updated_at:now};
        });
        const {error}=await _supabase.from(_tbl(colName)).upsert(rows);
        if(error) throw error;
      }
      return true;
    } catch(e){ console.error('FDB.batchWrite',colName,e); return false; }
  },
};

const FAuth = {
  _currentUser: null,
  _isSupabaseSession(){ return !!this._currentUser; },

  async register(schoolName, adminName, email, password) {
    try {
      const {data,error} = await _supabase.auth.signUp({email,password});
      if(error) throw error;
      const uid = data.user.id;
      await FDB.saveSchoolProfile(uid,{
        name:schoolName, motto:'Excellence in All Things', email,
        currency:'GHS', academicYear:'2025/2026', currentTerm:'2',
        gradeSystem:'percentage', passMark:50, type:'k12',
        adminName, adminEmail:email, status:'pending', createdAt:new Date().toISOString(),
      });
      await FDB.set(uid,'users',uid,{id:uid,name:adminName,email,role:'admin',phone:'',createdAt:new Date().toISOString()});
      return {success:true,uid,user:{uid,email}};
    } catch(e){ return {success:false,error:this._err(e)}; }
  },

  async login(email, password) {
    try {
      const {data,error} = await _supabase.auth.signInWithPassword({email,password});
      if(error) throw error;
      return {success:true,uid:data.user.id,user:{uid:data.user.id,email:data.user.email}};
    } catch(e){ return {success:false,error:this._err(e)}; }
  },

  // Uses Edge Function so admin session is NOT signed out
  async createSubUser(email, password) {
    try {
      // Get fresh session to ensure token is valid
      const {data:{session}, error:sessErr} = await _supabase.auth.getSession();
      if(sessErr || !session?.access_token) throw new Error('No active session — please log in again.');
      const res = await fetch(_config.url+'/functions/v1/create-sub-user',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({email,password}),
      });
      const result = await res.json();
      if(!res.ok||result.error) throw new Error(result.error||'Failed to create user');
      return {success:true,uid:result.uid};
    } catch(e){ return {success:false,error:e.message}; }
  },

  async changePassword(oldPw, newPw) {
    const email = this._currentUser?.email;
    if(!email) throw new Error('No active session');
    const {error:signInErr} = await _supabase.auth.signInWithPassword({email,password:oldPw});
    if(signInErr) throw new Error('wrong-password');
    const {error:updateErr} = await _supabase.auth.updateUser({password:newPw});
    if(updateErr) throw new Error(updateErr.message);
    return true;
  },

  async sendPasswordReset(email) {
    try {
      const {error} = await _supabase.auth.resetPasswordForEmail(email,
        {redirectTo:window.location.origin+'/?reset=true'});
      if(error) throw error; return {success:true};
    } catch(e){ return {success:false,error:e.message}; }
  },

  async logout() {
    try { await _supabase.auth.signOut(); this._currentUser=null; return {success:true}; }
    catch(e){ return {success:false}; }
  },

  // Normalises Supabase user → {uid, email} — same shape as Firebase user
  onAuthChange(cb) {
    let _cbCalled = false;
    // getSession() handles initial page load
    _supabase.auth.getSession().then(({data:{session}})=>{
      if(_cbCalled) return; // already handled by onAuthStateChange
      _cbCalled = true;
      if(session?.user){ const u={uid:session.user.id,email:session.user.email}; FAuth._currentUser=u; cb(u); }
      else             { FAuth._currentUser=null; cb(null); }
    });
    // onAuthStateChange handles login/logout events
    _supabase.auth.onAuthStateChange((_e,session)=>{
      if(_e==='INITIAL_SESSION') return; // handled by getSession()
      // For SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED — always process
      _cbCalled = true;
      if(session?.user){ const u={uid:session.user.id,email:session.user.email}; FAuth._currentUser=u; cb(u); }
      else             { FAuth._currentUser=null; cb(null); }
    });
  },

  _err(e){
    const m=e?.message||'';
    if(m.includes('Invalid login')||m.includes('invalid_credentials')) return 'Incorrect email or password.';
    if(m.includes('already registered')) return 'This email is already registered.';
    if(m.includes('Password should be')) return 'Password must be at least 6 characters.';
    if(m.includes('rate limit'))         return 'Too many attempts. Please try again later.';
    if(m.includes('network'))            return 'Network error. Check your connection.';
    return m||'Something went wrong. Please try again.';
  },
};

const Migration = {
  async run(sid) {
    if(localStorage.getItem('sms_supabase_migrated_'+sid)) return;
    console.log('🔄 Migrating localStorage → Supabase...');
    const cols=['students','staff','classes','subjects','feePayments','feeStructure',
      'exams','grades','attendance','events','messages','leaves','homework','books','expenses','payroll','auditLog'];
    for(const col of cols){
      try{
        const raw=localStorage.getItem('sms_'+col);
        if(raw){ const items=JSON.parse(raw); if(Array.isArray(items)&&items.length) await FDB.batchWrite(sid,col,items); }
      }catch(e){}
    }
    const school=localStorage.getItem('sms_school');
    if(school){ try{ await FDB.saveSchoolProfile(sid,JSON.parse(school)); }catch(e){} }
    localStorage.setItem('sms_supabase_migrated_'+sid,'true');
    console.log('✅ Migration to Supabase complete!');
  },
};

// _auth shim — used directly in app.js (line 495: setPersistence, line 571: signOut)
window._auth = {
  setPersistence(){ return Promise.resolve(); },
  signOut()       { return _supabase.auth.signOut(); },
};

// _db shim — used in app.js: _db.collection('schools').doc(sid).onSnapshot(cb, onErr)
window._db = {
  collection(table){
    return {
      doc(id){
        return {
          onSnapshot(cb, onErr){
            _supabase.from(table).select('id,data').eq('id',id).maybeSingle()
              .then(({data})=>{ if(data) cb({exists:true,data:()=>({...data.data,id:data.id})}); });
            const channel = _supabase.channel(table+':id=eq.'+id)
              .on('postgres_changes',{event:'UPDATE',schema:'public',table,filter:'id=eq.'+id},(payload)=>{
                const row=payload.new; cb({exists:true,data:()=>({...row.data,id:row.id})});
              })
              .subscribe((s)=>{ if(s==='CHANNEL_ERROR'&&onErr) onErr(new Error('Realtime error')); });
            return ()=>_supabase.removeChannel(channel);
          },
        };
      },
    };
  },
};

window.FDB=FDB; window.FAuth=FAuth; window.Migration=Migration;