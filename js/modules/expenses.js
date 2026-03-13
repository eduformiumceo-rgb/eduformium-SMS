// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Expenses — loadExpenses · renderExpenses · openExpenseModal · saveExpense
// ══════════════════════════════════════════

Object.assign(SMS, {
  exportFees(){
    if(typeof XLSX==='undefined'){ this.toast('Export library not loaded','error'); return; }
    const payments=DB.get('feePayments',[]); const students=DB.get('students',[]);
    const data=payments.map(p=>{ const s=students.find(x=>x.id===p.studentId); return {'Receipt No':p.receiptNo,'Student':s?s.fname+' '+s.lname:'Unknown','Class':this.className(s?.classId),'Term':'Term '+p.term,'Amount':p.amount,'Method':p.method,'Date':p.date,'Reference':p.ref||'','Notes':p.notes||'','Received By':p.by}; });
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Fee Payments');
    XLSX.writeFile(wb,`FeePayments_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.toast('Fees exported','success');
  },

  // ══ EXPENSES ══
  loadExpenses(){ this.renderExpenses(); },

  renderExpenses(){
    const expenses=DB.get('expenses',[]);
    const total=expenses.reduce((s,e)=>s+(+e.amount||0),0);
    const bycat={}; expenses.forEach(e=>{ bycat[e.category]=(bycat[e.category]||0)+(+e.amount||0); });
    document.getElementById('expense-kpis').innerHTML=[
      {icon:'expenses',val:fmt(total),lbl:'Total Expenses',color:'red'},
      {icon:'transactions',val:expenses.length,lbl:'Transactions',color:'blue'},
      {icon:'category',val:Object.keys(bycat).sort((a,b)=>bycat[b]-bycat[a])[0]||'—',lbl:'Top Category',color:'amber'},
    ].map(k=>`<div class="kpi-card"><div class="kpi-icon ${k.color}">${SMS._kpiSvg(k.icon)}</div><div class="kpi-val" style="font-size:${k.val.length>8?'1.1rem':'1.65rem'}">${k.val}</div><div class="kpi-label">${k.lbl}</div></div>`).join('');
    document.getElementById('expense-tbody').innerHTML=expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr>
      <td>${fmtDate(e.date)}</td>
      <td><span class="badge badge-neutral">${e.category}</span></td>
      <td>${e.desc}</td>
      <td style="font-weight:700;color:var(--danger)">${fmt(e.amount)}</td>
      <td>${e.paidTo}</td>
      <td>${e.approvedBy}</td>
      <td style="display:flex;gap:.3rem">${SMS.hasRole('admin','accountant')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openExpenseModal('${e.id}')" style="color:var(--brand);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this expense?',()=>SMS.deleteExpense('${e.id}'))" style="color:var(--danger);padding:.3rem .5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:`<span></span>`}</td>
    </tr>`).join('')||SMS._emptyState('expenses','No Expenses Recorded','Track school expenditure here. Add your first expense entry.','');
    this.renderExpenseCharts(bycat,expenses);
  },

  deleteExpense(id){ DB.set('expenses',DB.get('expenses',[]).filter(x=>x.id!==id)); const _sid=window.SMS&&window.SMS.schoolId; if(_sid&&window.FDB) FDB.delete(_sid,'expenses',id).catch(()=>{}); this.toast('Expense deleted','warn'); this.renderExpenses(); },

  renderExpenseCharts(bycat,expenses){
    const isDark=document.documentElement.dataset.theme==='dark';
    const ctx1=document.getElementById('chart-expenses'); if(ctx1){ if(this._charts.exp) this._charts.exp.destroy(); const labels=Object.keys(bycat); const data=labels.map(k=>bycat[k]); const colors=isDark?['#93c5fd','#2dd4bf','#fbbf24','#f87171','#c4b5fd','#4ade80']:['#1a3a6b','#0d9488','#d97706','#dc2626','#7c3aed','#16a34a']; this._charts.exp=new Chart(ctx1,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors.slice(0,labels.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12,color:isDark?'#94a3b8':'#475569'}}}}}); }
    const ctx2=document.getElementById('chart-expense-trend'); if(ctx2){ if(this._charts.expTrend) this._charts.expTrend.destroy(); const months=['Jan','Feb','Mar','Apr','May']; const mData=months.map((_,i)=>expenses.filter(e=>new Date(e.date).getMonth()===i).reduce((s,e)=>s+(+e.amount||0),0)); this._charts.expTrend=new Chart(ctx2,{type:'bar',data:{labels:months,datasets:[{data:mData,backgroundColor:'rgba(224,82,82,0.75)',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'₵'+v.toLocaleString()}},x:{grid:{display:false}}}}}); }
  },

  // ══ MESSAGES ══
});
