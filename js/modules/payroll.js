// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Payroll — loadPayroll · renderPayroll · processPayroll · export
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadPayroll(){ this.renderPayroll(); },

  renderPayroll(){
    const staff=DB.get('staff',[]); const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const saved=DB.get('payroll',[]).filter(p=>p.month==month&&p.year==year);
    const totalBasic=staff.reduce((s,x)=>s+(+x.salary||0),0);
    document.getElementById('payroll-kpis').innerHTML=[
      {icon:'staff',val:staff.length,lbl:'Staff Members',color:'blue'},
      {icon:'fees',val:fmt(totalBasic),lbl:'Total Basic Salary',color:'teal'},
      {icon:'check',val:saved.length,lbl:'Processed This Month',color:'green'},
      {icon:'pending',val:staff.length-saved.length,lbl:'Pending',color:'amber'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
    document.getElementById('payroll-tbody').innerHTML=staff.map(s=>{
      const p=saved.find(x=>x.staffId===s.id);
      const basic=+s.salary||0, allow=basic*0.15, deduct=basic*0.05, net=basic+allow-deduct;
      return `<tr>
        <td style="font-weight:600">${sanitize(s.fname)} ${sanitize(s.lname)}</td>
        <td><span class="badge badge-info">${sanitize(s.role)}</span></td>
        <td>${fmt(basic)}</td>
        <td>${fmt(allow)}</td>
        <td style="color:var(--danger)">${fmt(deduct)}</td>
        <td style="font-weight:800;color:var(--brand)">${fmt(net)}</td>
        <td>${p?statusBadge('active'):`<span class="badge badge-warn">Pending</span>`}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="SMS.payStaff('${s.id}',${net},'${month}','${year}')" style="padding:.3rem .6rem">${p?'Paid':'Pay'}</button></td>
      </tr>`;
    }).join('')||SMS._emptyState('staff','No Staff Found','Add staff members to run payroll.','');
  },

  processPayroll(){
    if(!this.hasRole('admin','accountant')){ this.toast('You do not have permission to perform this action','error'); return; }
    const staff=DB.get('staff',[]); const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const payroll=DB.get('payroll',[]); let count=0;
    staff.forEach(s=>{ if(!payroll.find(p=>p.staffId===s.id&&p.month==month&&p.year==year)){ const basic=+s.salary||0,allow=basic*0.15,deduct=basic*0.05,net=basic+allow-deduct; payroll.push({id:uid('pr'),staffId:s.id,month,year,basic,allowances:allow,deductions:deduct,net,date:new Date().toISOString(),paidBy:this.currentUser.id}); count++; } });
    DB.set('payroll',payroll); this.audit('Payroll','create',`Processed payroll for ${month}/${year}: ${count} staff`); this.toast(`Payroll processed for ${count} staff!`,'success'); this.renderPayroll();
  },

  payStaff(staffId,net,month,year){
    const payroll=DB.get('payroll',[]); if(payroll.find(p=>p.staffId===staffId&&p.month==month&&p.year==year)){ this.toast('Already processed for this month','warn'); return; }
    const s=DB.get('staff',[]).find(x=>x.id===staffId); const basic=+s.salary||0,allow=basic*0.15,deduct=basic*0.05;
    payroll.push({id:uid('pr'),staffId,month,year,basic,allowances:allow,deductions:deduct,net,date:new Date().toISOString(),paidBy:this.currentUser.id});
    DB.set('payroll',payroll); this.audit('Payroll','create',`Paid ${sanitize(s.fname)} ${sanitize(s.lname)}: ${fmt(net)}`); this.toast(`${s.fname} paid ${fmt(net)}`,'success'); this.renderPayroll();
  },

  exportPayroll(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const staff=DB.get('staff',[]); const payroll=DB.get('payroll',[]);
    const month=document.getElementById('pay-month')?.value; const year=document.getElementById('pay-year')?.value;
    const saved=payroll.filter(p=>p.month==month&&p.year==year);
    const data=saved.map(p=>{ const s=staff.find(x=>x.id===p.staffId); return {'Staff Name':s?s.fname+' '+s.lname:'Unknown','Role':s?.role||'—','Department':s?.dept||'—','Basic Salary':p.basic,'Allowances':p.allowances,'Deductions':p.deductions,'Net Pay':p.net,'Month':p.month,'Year':p.year,'Date Paid':p.date?new Date(p.date).toLocaleDateString():'—'}; });
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Payroll');
    XLSX.writeFile(wb,`Payroll_${month}_${year}.xlsx`);
    this.audit('Payroll Export','settings',`Payroll exported for ${month}/${year}`);
    this.toast('Payroll exported!','success');
  },

  // ══ LEAVE ══
});
