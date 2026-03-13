// ══════════════════════════════════════════
//  EDUFORMIUM SMS — Library
//  loadLibrary · renderLibrary · books · issuing
// ══════════════════════════════════════════

Object.assign(SMS, {
  loadLibrary(){
    const cats=[...new Set(DB.get('books',[]).map(b=>b.category).filter(Boolean))];
    const cf=document.getElementById('lib-cat-f'); if(cf) cf.innerHTML='<option value="">All Categories</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
    this.renderLibStats(); this.renderLibrary();
  },

  renderLibStats(){
    const books=DB.get('books',[]); const total=books.reduce((s,b)=>s+(+b.copies||0),0); const avail=books.reduce((s,b)=>s+(+b.available||0),0);
    document.getElementById('lib-stats').innerHTML=[{val:books.length,lbl:'Book Titles'},{val:total,lbl:'Total Copies'},{val:avail,lbl:'Available'},{val:total-avail,lbl:'Borrowed'}].map(s=>`<div class="stat-pill"><div><div class="stat-pill-val">${s.val}</div><div class="stat-pill-lbl">${s.lbl}</div></div></div>`).join('');
  },

  renderLibrary(){
    const books=DB.get('books',[]); const q=(document.getElementById('lib-search')?.value||'').toLowerCase();
    const cf=document.getElementById('lib-cat-f')?.value||''; const sf=document.getElementById('lib-status-f')?.value||'';
    let filtered=books.filter(b=>{ if(cf&&b.category!==cf) return false; if(sf==='available'&&b.available<1) return false; if(sf==='borrowed'&&b.available>0) return false; if(q&&!`${sanitize(b.title)} ${sanitize(b.author)} ${sanitize(b.isbn)}`.toLowerCase().includes(q)) return false; return true; });
    document.getElementById('lib-tbody').innerHTML=filtered.map(b=>`<tr>
      <td style="font-family:monospace;font-size:.73rem;color:var(--t3)">${b.isbn||'—'}</td>
      <td style="font-weight:600">${sanitize(b.title)}</td>
      <td>${sanitize(b.author)}</td>
      <td><span class="badge badge-neutral">${b.category}</span></td>
      <td style="text-align:center">${b.copies}</td>
      <td style="text-align:center;font-weight:700;color:${b.available>0?'var(--success)':'var(--danger)'}">${b.available}</td>
      <td>${b.available>0?statusBadge('available'):statusBadge('borrowed')}</td>
      <td style="display:flex;gap:.3rem">${SMS.hasRole('admin','librarian')?`<button class="btn btn-ghost btn-sm" onclick="SMS.openBookModal('${b.id}')" style="color:var(--brand);padding:.3rem .5rem" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>${b.available>0?`<button class="btn btn-ghost btn-sm" onclick="SMS.openBookIssueModal('${b.id}')" style="color:var(--teal);padding:.3rem .5rem;font-size:.7rem;font-weight:600">Issue</button>`:''}<button class="btn btn-ghost btn-sm" onclick="SMS.confirmDelete('Delete this book?',()=>SMS.deleteBook('${b.id}'))" style="color:var(--danger);padding:.3rem .5rem" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>`:`<span></span>`}</td>
    </tr>`).join('')||SMS._emptyState('books','No Books Found','Try a different search or category filter.','');
  },


});
