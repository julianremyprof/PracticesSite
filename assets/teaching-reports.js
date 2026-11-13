(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const db = window.englishLabSupabase;
  const PAGE_SIZE = 1000;
  const state = {
    user: null, profile: null, isAdmin: false, type: 'assignments',
    profiles: [], attempts: [], activities: [], assignments: [], sessions: [],
    weaknesses: [], part5: [], favorites: [], selectedFavoriteId: null,
    rows: [], columns: [], lastGeneratedAt: null
  };

  const columnSets = {
    assignments: [
      {key:'student',label:'Student',default:true},
      {key:'prom',label:'Prom',default:false},
      {key:'group',label:'Group',default:false},
      {key:'activity',label:'Practice',default:true},
      {key:'assigned',label:'Assigned date',default:true},
      {key:'due',label:'Due date',default:true},
      {key:'status',label:'Status',default:true},
      {key:'completed',label:'Completed date',default:false},
      {key:'score',label:'Latest score',default:false},
      {key:'instructions',label:'Instructions',default:false}
    ],
    performance: [
      {key:'student',label:'Student',default:true},
      {key:'center',label:'Educational center',default:false},
      {key:'prom',label:'Prom',default:false},
      {key:'group',label:'Group',default:true},
      {key:'attempts',label:'Completed attempts',default:true},
      {key:'activities',label:'Activities completed',default:true},
      {key:'avgAccuracy',label:'Average accuracy',default:true},
      {key:'recentScore',label:'Latest score',default:false},
      {key:'lastActive',label:'Last activity',default:true},
      {key:'focusArea',label:'Priority focus',default:true},
      {key:'part5Focus',label:'Part 5 focus',default:false}
    ]
  };

  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const dateValue = value => {
    const n = value ? Date.parse(value) : 0;
    return Number.isFinite(n) ? n : 0;
  };
  const dateText = value => {
    if(!value)return '—';
    const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):new Date(value);
    return Number.isNaN(date.getTime())?'—':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  };
  const dateTimeText = value => value ? new Date(value).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
  const todayISO = () => {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const percent = value => Math.round(asNumber(value)) + '%';
  const groupOf = profile => profile?.group_code || profile?.shift || '—';
  const activityName = id => state.activityMap?.[id]?.title || id || 'Unknown practice';
  const say = (message,kind='') => {
    $('reportStatus').textContent = message;
    $('reportStatus').className = 'report-status' + (kind ? ' '+kind : '');
  };

  async function readAll(table, columns, configure) {
    const all = [];
    for (let from=0; ; from+=PAGE_SIZE) {
      let query = db.from(table).select(columns);
      if (configure) query = configure(query);
      const {data,error} = await query.range(from,from+PAGE_SIZE-1);
      if (error) throw error;
      const page = data || [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return all;
  }

  function optionMarkup(values, allLabel) {
    return '<option value="all">'+escapeHtml(allLabel)+'</option>'+values.map(value=>{
      const key = typeof value === 'object' ? value.value : value;
      const label = typeof value === 'object' ? value.label : value;
      return '<option value="'+escapeHtml(key)+'">'+escapeHtml(label)+'</option>';
    }).join('');
  }

  function fillFilters() {
    const profiles = state.profiles.slice().sort((a,b)=>(a.full_name||'').localeCompare(b.full_name||''));
    const centers = [...new Set(profiles.map(p=>p.educational_center||'Unassigned'))].sort();
    const proms = [...new Set(profiles.map(p=>Number(p.prom)).filter(Boolean))].sort((a,b)=>a-b);
    const groups = [...new Set(profiles.map(groupOf).filter(x=>x!=='—'))].sort();
    $('centerFilter').innerHTML = optionMarkup(centers,'All centers');
    $('promFilter').innerHTML = optionMarkup(proms,'All Proms');
    $('groupFilter').innerHTML = optionMarkup(groups,'All groups');
    $('studentFilter').innerHTML = optionMarkup(profiles.map(p=>({value:p.id,label:p.full_name||p.email||'Student'})),'All students');
    $('activityFilter').innerHTML = optionMarkup(state.activities.slice().sort((a,b)=>(a.title||'').localeCompare(b.title||'')).map(a=>({value:a.id,label:a.title||a.id})),'All practices');
    const today = todayISO(), from = new Date(); from.setDate(from.getDate()-90);
    $('dateTo').value = today;
    $('dateFrom').value = [from.getFullYear(),String(from.getMonth()+1).padStart(2,'0'),String(from.getDate()).padStart(2,'0')].join('-');
  }

  function selectedFilters() {
    return {
      center:$('centerFilter').value, prom:$('promFilter').value, group:$('groupFilter').value,
      student:$('studentFilter').value, activity:$('activityFilter').value,
      from:$('dateFrom').value, to:$('dateTo').value
    };
  }
  function profileMatches(profile,filters) {
    if (filters.center!=='all' && (profile.educational_center||'Unassigned')!==filters.center) return false;
    if (filters.prom!=='all' && String(profile.prom)!==filters.prom) return false;
    if (filters.group!=='all' && groupOf(profile)!==filters.group) return false;
    if (filters.student!=='all' && profile.id!==filters.student) return false;
    return true;
  }
  function inDateRange(value,filters) {
    const n = dateValue(value);
    if (!n) return false;
    if (filters.from && n < new Date(filters.from+'T00:00:00').getTime()) return false;
    if (filters.to && n > new Date(filters.to+'T23:59:59').getTime()) return false;
    return true;
  }

  function setReportType(type,shouldGenerate=true) {
    const nextType = type === 'performance' ? 'performance' : 'assignments';
    const changed = nextType !== state.type;
    state.type = nextType;
    if (changed) state.columns = columnSets[state.type].filter(c=>c.default).map(c=>c.key);
    document.querySelectorAll('[data-report-type]').forEach(button=>button.classList.toggle('active',button.dataset.reportType===state.type));
    $('reportTitle').textContent = state.type==='assignments' ? 'Assignment progress report' : 'Student performance report';
    $('reportDescription').textContent = state.type==='assignments'
      ? 'See what has been assigned, what is complete, and who needs a follow-up.'
      : 'Turn practice results into clear evidence of student progress and practical next steps.';
    renderColumnEditor();
    if (shouldGenerate && state.profiles.length) generateReport();
  }

  function renderColumnEditor() {
    const cols = columnSets[state.type];
    const chosen = new Set(state.columns.length ? state.columns : cols.filter(c=>c.default).map(c=>c.key));
    state.columns = [...chosen].filter(key=>cols.some(c=>c.key===key));
    $('columnEditor').innerHTML = cols.map(col=>'<label><input type="checkbox" data-report-column="'+escapeHtml(col.key)+'" '+(chosen.has(col.key)?'checked':'')+'> '+escapeHtml(col.label)+'</label>').join('');
  }

  function getProfileMap() {
    return Object.fromEntries(state.profiles.map(p=>[p.id,p]));
  }
  function getAttempts(studentId,activityId,afterTime=0) {
    return state.attempts.filter(a=>a.student_id===studentId && a.activity_id===activityId && dateValue(a.completed_at)>=afterTime)
      .sort((a,b)=>dateValue(b.completed_at)-dateValue(a.completed_at));
  }
  function getAssignmentStatus(assignment) {
    const assignedAt = dateValue(assignment.created_at);
    const attempts = getAttempts(assignment.student_id,assignment.activity_id,assignedAt);
    const completedAttempt = attempts[0] || null;
    if (completedAttempt) return {status:'Completed',className:'completed',attempt:completedAttempt};
    const activeSession = state.sessions.filter(s=>s.student_id===assignment.student_id && s.activity_id===assignment.activity_id &&
      ['in_progress','abandoned'].includes(s.status) && dateValue(s.started_at)>=assignedAt)
      .sort((a,b)=>dateValue(b.started_at)-dateValue(a.started_at))[0] || null;
    const overdue = assignment.due_date && assignment.due_date < todayISO();
    if (overdue && activeSession) return {status:'Overdue · in progress',className:'overdue',session:activeSession};
    if (activeSession) return {status:'In progress',className:'progress',session:activeSession};
    if (overdue) return {status:'Overdue',className:'overdue'};
    return {status:'Not started',className:'pending'};
  }

  function filteredAssignments(filters) {
    const profiles = getProfileMap();
    return state.assignments.filter(a=>{
      const profile=profiles[a.student_id];
      if(!profile||!profileMatches(profile,filters))return false;
      if(filters.activity!=='all'&&a.activity_id!==filters.activity)return false;
      return inDateRange(a.created_at,filters);
    }).map(a=>{
      const profile=profiles[a.student_id],result=getAssignmentStatus(a);
      return {
        source:a,profile,status:result.status,statusClass:result.className,completion:result.attempt||null,
        activeSession:result.session||null
      };
    }).sort((a,b)=>{
      const priority={overdue:0,progress:1,pending:2,completed:3};
      return (priority[a.statusClass]??4)-(priority[b.statusClass]??4) || dateValue(b.source.created_at)-dateValue(a.source.created_at);
    });
  }

  function assignmentRowObject(item) {
    const a=item.source,p=item.profile,attempt=item.completion;
    return {
      student:p.full_name||p.email||'Student',prom:p.prom||'—',group:groupOf(p),
      activity:activityName(a.activity_id),assigned:dateText(a.created_at),due:dateText(a.due_date),
      status:item.status,completed:dateTimeText(attempt?.completed_at),
      score:attempt?asNumber(attempt.score)+' / '+asNumber(attempt.total_questions):'—',
      instructions:a.instructions||'—'
    };
  }

  function renderMetricCards(items) {
    $('summaryCards').innerHTML=items.map(item=>'<article class="report-metric"><span>'+escapeHtml(item.label)+'</span><strong>'+escapeHtml(item.value)+'</strong><small>'+escapeHtml(item.note||'')+'</small></article>').join('');
  }
  function renderInsights(items) {
    $('insightGrid').innerHTML=items.map(item=>'<article class="report-insight"><div class="tag">'+escapeHtml(item.tag)+'</div><h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.text)+'</p></article>').join('');
  }
  function renderBars(rows) {
    if(!rows.length){$('activityBars').innerHTML='<div class="report-empty">No activity data matches the selected filters.</div>';return;}
    $('activityBars').innerHTML='<div class="report-bar-list">'+rows.map(row=>{
      const width=Math.max(0,Math.min(100,asNumber(row.rate)));
      return '<div class="report-bar-row"><strong>'+escapeHtml(row.label)+'</strong><div class="report-bar-track"><span style="width:'+width+'%"></span></div><span>'+Math.round(width)+'%</span></div>';
    }).join('')+'</div>';
  }
  function renderTable(rows,columns) {
    const columnsForType=columnSets[state.type].filter(col=>columns.includes(col.key));
    if(!rows.length){$('reportTable').innerHTML='<div class="report-empty">No records match these filters and dates. Try a wider date range or remove a filter.</div>';return;}
    const keys=columnsForType.length?columnsForType:columnSets[state.type].filter(c=>c.default);
    const head='<thead><tr>'+keys.map(c=>'<th>'+escapeHtml(c.label)+'</th>').join('')+'<th>Details</th></tr></thead>';
    const body='<tbody>'+rows.map(row=>{
      const cells=keys.map(c=>{
        let value=row[c.key]??'—';
        if(c.key==='status'){
          const item=state.currentItems?.find(x=>state.type==='assignments' && x.source.id===row.__id);
          const cls=item?.statusClass||'pending';
          value='<span class="report-pill '+cls+'">'+escapeHtml(value)+'</span>';
          return '<td>'+value+'</td>';
        }
        return '<td>'+escapeHtml(value)+'</td>';
      }).join('');
      return '<tr>'+cells+'<td>'+row.__details+'</td></tr>';
    }).join('')+'</tbody>';
    $('reportTable').innerHTML='<div class="report-table-wrap"><table class="report-table">'+head+body+'</table></div>';
  }

  function generateAssignmentReport(filters) {
    const items=filteredAssignments(filters);
    state.currentItems=items;
    const completed=items.filter(x=>x.statusClass==='completed').length;
    const inProgress=items.filter(x=>x.statusClass==='progress'||(x.statusClass==='overdue'&&x.status.includes('in progress'))).length;
    const overdue=items.filter(x=>x.statusClass==='overdue').length;
    const notStarted=items.filter(x=>x.statusClass==='pending').length;
    const rate=items.length?completed/items.length*100:0;
    const completionDays=items.filter(x=>x.completion).map(x=>(dateValue(x.completion.completed_at)-dateValue(x.source.created_at))/86400000);
    const avgDays=completionDays.length?completionDays.reduce((a,b)=>a+b,0)/completionDays.length:null;
    renderMetricCards([
      {label:'Assigned',value:items.length,note:'Individual student assignments in this report'},
      {label:'Completed',value:completed,note:percent(rate)+' completion rate'},
      {label:'In progress',value:inProgress,note:'Students with an active or resumed attempt'},
      {label:'Need follow-up',value:overdue+notStarted,note:overdue+' overdue · '+notStarted+' not started'}
    ]);
    const practiceCounts=new Map();
    items.forEach(item=>{
      const key=item.source.activity_id;
      if(!practiceCounts.has(key))practiceCounts.set(key,{total:0,complete:0});
      const group=practiceCounts.get(key);group.total++;if(item.statusClass==='completed')group.complete++;
    });
    const bars=[...practiceCounts].map(([id,v])=>({label:activityName(id),rate:v.total?v.complete/v.total*100:0,total:v.total,complete:v.complete}))
      .sort((a,b)=>a.rate-b.rate||b.total-a.total).slice(0,7);
    renderBars(bars);
    const highestRisk=items.filter(x=>x.statusClass==='overdue'||x.statusClass==='pending')
      .slice(0,4);
    const insights=[
      {tag:'Overall completion',title:percent(rate)+' complete',text:items.length?completed+' of '+items.length+' assigned practices have a completed attempt recorded after the assignment date.':'No assignments were found for the selected filters.'},
      {tag:'Follow-up priority',title:(overdue+notStarted)+' students to check',text:overdue+' assignments are overdue and '+notStarted+' have not been started. Begin with overdue work, then check in with students who have not opened the practice.'},
      {tag:'Completion pace',title:avgDays===null?'No completion data':avgDays.toFixed(1)+' days on average',text:avgDays===null?'Once students complete assigned work, the average time from assignment to completion will appear here.':'Average elapsed time from the assignment date to a recorded completion.'},
      {tag:'Action to take',title:highestRisk.length?'Review the follow-up list':'Keep the momentum',text:highestRisk.length?highestRisk.slice(0,3).map(x=>(x.profile.full_name||'Student')+' · '+x.status).join('; '):'No overdue or untouched assignments appear in this filtered report.'}
    ];
    renderInsights(insights);
    $('activityBarsTitle').textContent='Completion by practice';
    $('activityBarsNote').textContent='Practices with the lowest completion rates appear first.';
    $('tableTitle').textContent='Assignment register';
    $('tableNote').textContent='Every row represents one student assignment. Expand Details for its instructions and latest recorded outcome.';
    const rows=items.map(item=>{
      const row=assignmentRowObject(item);row.__id=item.source.id;
      row.__details='<details class="report-row-details"><summary>View details</summary><p><strong>Instructions:</strong> '+escapeHtml(item.source.instructions||'No instructions added')+'</p><p><strong>Completion:</strong> '+escapeHtml(item.completion?dateTimeText(item.completion.completed_at):'Not completed')+'</p><p><strong>Latest result:</strong> '+escapeHtml(item.completion?asNumber(item.completion.score)+' / '+asNumber(item.completion.total_questions):'No completed attempt')+'</p></details>';
      return row;
    });
    state.rows=rows;
    renderTable(rows,state.columns);
    $('reportResultCount').textContent=items.length+' assignment records';
    $('followupList').innerHTML=highestRisk.length?'<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Student</th><th>Practice</th><th>Status</th><th>Due</th></tr></thead><tbody>'+highestRisk.map(x=>'<tr><td><strong>'+escapeHtml(x.profile.full_name||'Student')+'</strong></td><td>'+escapeHtml(activityName(x.source.activity_id))+'</td><td><span class="report-pill '+x.statusClass+'">'+escapeHtml(x.status)+'</span></td><td>'+dateText(x.source.due_date)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="report-empty">No urgent follow-ups in this filtered report.</div>';
  }

  function averageAccuracy(attempts) {
    const total=attempts.reduce((sum,a)=>sum+asNumber(a.total_questions),0);
    const correct=attempts.reduce((sum,a)=>sum+asNumber(a.score),0);
    return total?correct/total*100:null;
  }
  function focusForStudent(studentId,filters) {
    const weaknesses=state.weaknesses.filter(w=>w.student_id===studentId&&asNumber(w.attempts)>=3&&
      inDateRange(w.last_practiced,filters)&&(filters.activity==='all'||w.activity_id===filters.activity))
      .sort((a,b)=>asNumber(b.error_rate)-asNumber(a.error_rate));
    if(weaknesses[0]) return topicLabel(weaknesses[0].topic)+' · '+Math.round(asNumber(weaknesses[0].error_rate))+'% errors';
    const p5=state.part5.filter(w=>w.student_id===studentId&&asNumber(w.attempts)>=3&&inDateRange(w.last_practiced,filters))
      .sort((a,b)=>asNumber(b.error_rate)-asNumber(a.error_rate));
    if(p5[0]) return topicLabel(p5[0].topic)+' · Part 5';
    return 'More evidence needed';
  }
  function topicLabel(topic) {
    return String(topic||'General').split('/').pop().replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  function performanceRows(filters) {
    const profiles=state.profiles.filter(p=>profileMatches(p,filters));
    const attempts=state.attempts.filter(a=>filters.activity==='all'||a.activity_id===filters.activity)
      .filter(a=>inDateRange(a.completed_at,filters));
    const byStudent=new Map(profiles.map(p=>[p.id,[]]));
    attempts.forEach(a=>{if(byStudent.has(a.student_id))byStudent.get(a.student_id).push(a);});
    return profiles.map(profile=>{
      const rows=(byStudent.get(profile.id)||[]).sort((a,b)=>dateValue(b.completed_at)-dateValue(a.completed_at));
      const accuracy=averageAccuracy(rows);
      const activities=new Set(rows.map(a=>a.activity_id)).size;
      const last=rows[0]||null;
      const previous=rows.slice(3,6),recent=rows.slice(0,3);
      const recentAcc=averageAccuracy(recent),previousAcc=averageAccuracy(previous);
      const change=recentAcc!==null&&previousAcc!==null?recentAcc-previousAcc:null;
      const part5Focus=state.part5.filter(w=>w.student_id===profile.id&&asNumber(w.attempts)>=3&&inDateRange(w.last_practiced,filters))
        .sort((a,b)=>asNumber(b.error_rate)-asNumber(a.error_rate))[0];
      return {
        __id:profile.id,profile,student:profile.full_name||profile.email||'Student',
        center:profile.educational_center||'Unassigned',prom:profile.prom||'—',group:groupOf(profile),
        attempts:rows.length,activities,avgAccuracy:accuracy===null?'—':percent(accuracy),
        recentScore:last?asNumber(last.score)+' / '+asNumber(last.total_questions)+' ('+percent(averageAccuracy([last]))+')':'—',
        lastActive:last?dateTimeText(last.completed_at):'No completed work',
        focusArea:focusForStudent(profile.id,filters),
        part5Focus:part5Focus?topicLabel(part5Focus.topic)+' · '+Math.round(asNumber(part5Focus.error_rate))+'% errors':'—',
        __attempts:rows,__accuracy:accuracy,__trend:change
      };
    }).sort((a,b)=>(a.__accuracy??-1)-(b.__accuracy??-1)||b.attempts-a.attempts);
  }

  function generatePerformanceReport(filters) {
    const profiles=state.profiles.filter(p=>profileMatches(p,filters));
    const attempts=state.attempts.filter(a=>(filters.activity==='all'||a.activity_id===filters.activity)&&inDateRange(a.completed_at,filters));
    const totalQuestions=attempts.reduce((sum,a)=>sum+asNumber(a.total_questions),0);
    const totalCorrect=attempts.reduce((sum,a)=>sum+asNumber(a.score),0);
    const overall=totalQuestions?totalCorrect/totalQuestions*100:null;
    const rows=performanceRows(filters);
    const activeStudents=rows.filter(r=>r.attempts>0).length;
    const atRisk=rows.filter(r=>r.__accuracy!==null&&r.__accuracy<70).length;
    renderMetricCards([
      {label:'Students in scope',value:profiles.length,note:activeStudents+' with completed practice in this period'},
      {label:'Completed attempts',value:attempts.length,note:new Set(attempts.map(a=>a.student_id)).size+' students represented'},
      {label:'Overall answer accuracy',value:overall===null?'—':percent(overall),note:totalCorrect+' correct out of '+totalQuestions+' questions'},
      {label:'Need academic support',value:atRisk,note:'Active students below 70% overall accuracy'}
    ]);
    const skillRows=state.weaknesses.filter(w=>profiles.some(p=>p.id===w.student_id)&&asNumber(w.attempts)>=3&&
      inDateRange(w.last_practiced,filters)&&(filters.activity==='all'||w.activity_id===filters.activity));
    const skillMap=new Map();
    skillRows.forEach(w=>{
      const key=w.topic||'general';
      if(!skillMap.has(key))skillMap.set(key,{attempts:0,errors:0});
      const s=skillMap.get(key);s.attempts+=asNumber(w.attempts);s.errors+=asNumber(w.incorrect_attempts);
    });
    const skillSummary=[...skillMap].map(([topic,v])=>({topic,attempts:v.attempts,errorRate:v.attempts?v.errors/v.attempts*100:0}))
      .sort((a,b)=>b.errorRate-a.errorRate);
    const highestFocus=skillSummary[0],strongest=skillSummary.slice().sort((a,b)=>a.errorRate-b.errorRate)[0];
    const bestStudent=rows.filter(r=>r.__accuracy!==null&&r.attempts>0).slice().sort((a,b)=>b.__accuracy-a.__accuracy)[0];
    const supportStudents=rows.filter(r=>r.__accuracy!==null&&r.attempts>0&&r.__accuracy<70).slice(0,3);
    const insights=[
      {tag:'Priority skill',title:highestFocus?topicLabel(highestFocus.topic):'Building evidence',text:highestFocus?Math.round(highestFocus.errorRate)+'% errors across '+highestFocus.attempts+' checked responses in this report. Plan a short reteaching activity, then assign a focused practice.':'No skill area has enough repeated evidence yet. Review again after more students complete tracked practice.'},
      {tag:'Strongest skill',title:strongest?topicLabel(strongest.topic):'Not enough data',text:strongest?Math.round(100-strongest.errorRate)+'% estimated accuracy across '+strongest.attempts+' responses. Use this as a strength to reinforce and transfer to new tasks.':'No skill area has three or more checked responses.'},
      {tag:'Student progress',title:bestStudent?bestStudent.student+' · '+percent(bestStudent.__accuracy):'No completed work',text:bestStudent?'Highest overall accuracy among students with completed attempts in this report. Compare this with each learner’s recent results before drawing conclusions.':'No completed attempts fall within the chosen dates.'},
      {tag:'Take action',title:atRisk+' students below 70%',text:supportStudents.length?supportStudents.map(s=>s.student+' ('+percent(s.__accuracy)+')').join('; ')+' — review their latest attempts and choose one clear practice goal.':'No active student in this report is below 70% overall accuracy.'}
    ];
    renderInsights(insights);
    const groupMap=new Map();
    rows.filter(r=>r.attempts).forEach(r=>{
      const key=r.center+' · Prom '+r.prom+' · '+r.group;
      if(!groupMap.has(key))groupMap.set(key,[]);
      groupMap.get(key).push(r);
    });
    const groupBars=[...groupMap].map(([label,list])=>{
      const sum=list.reduce((v,r)=>v+r.__attempts.reduce((n,a)=>n+asNumber(a.total_questions),0),0);
      const correct=list.reduce((v,r)=>v+r.__attempts.reduce((n,a)=>n+asNumber(a.score),0),0);
      return {label,rate:sum?correct/sum*100:0};
    }).sort((a,b)=>a.rate-b.rate).slice(0,7);
    renderBars(groupBars);
    $('activityBarsTitle').textContent='Accuracy by group';
    $('activityBarsNote').textContent='Based on completed answers in the selected period and filters.';
    $('tableTitle').textContent='Student performance register';
    $('tableNote').textContent='Select View details in any row to inspect recent attempts, direction of progress, and skill priorities.';
    const reportRows=rows.map(row=>{
      const item={...row};
      item.__details='<details class="report-row-details"><summary>View details</summary>'+
        '<p><strong>Recent direction:</strong> '+(row.__trend===null?'Not enough attempts to compare the latest three with the previous three':(row.__trend>=0?'Up ':'Down ')+Math.abs(row.__trend).toFixed(1)+' percentage points')+'</p>'+
        '<p><strong>Recent work:</strong> '+(row.__attempts.length?row.__attempts.slice(0,4).map(a=>escapeHtml(activityName(a.activity_id))+' — '+asNumber(a.score)+'/'+asNumber(a.total_questions)+' ('+percent(averageAccuracy([a]))+')').join('<br>'):'No completed attempts in this period')+'</p>'+
        '<p><strong>Priority:</strong> '+escapeHtml(row.focusArea)+'</p>'+
        '<p><strong>Part 5:</strong> '+escapeHtml(row.part5Focus)+'</p></details>';
      return item;
    });
    state.rows=reportRows;
    renderTable(reportRows,state.columns);
    $('reportResultCount').textContent=rows.length+' student records';
    const skillBars=skillSummary.slice(0,8);
    $('followupList').innerHTML=skillBars.length?'<div class="report-section-note">Skill areas with at least three checked responses, ordered by estimated error rate.</div><div class="report-bar-list">'+skillBars.map(s=>'<div class="report-bar-row"><strong>'+escapeHtml(topicLabel(s.topic))+'</strong><div class="report-bar-track"><span style="width:'+Math.max(0,Math.min(100,s.errorRate))+'%"></span></div><span>'+Math.round(s.errorRate)+'% errors</span></div>').join('')+'</div>':'<div class="report-empty">More checked answers are needed before skill-level priorities can be identified.</div>';
  }

  function generateReport() {
    const filters=selectedFilters();
    if(filters.from&&filters.to&&filters.from>filters.to){say('The start date must be before the end date.','error');return;}
    $('reportPreview').hidden=false;
    if(state.type==='assignments')generateAssignmentReport(filters);
    else generatePerformanceReport(filters);
    state.lastGeneratedAt=new Date();
    $('generatedAt').textContent='Generated '+dateTimeText(state.lastGeneratedAt.toISOString());
    say('Report generated. Adjust the filters or report fields and generate again.','success');
  }

  function currentConfig() {
    return {filters:selectedFilters(),columns:state.columns.slice()};
  }
  function setFilters(filters={}) {
    const fields={center:'centerFilter',prom:'promFilter',group:'groupFilter',student:'studentFilter',activity:'activityFilter',from:'dateFrom',to:'dateTo'};
    Object.entries(fields).forEach(([key,id])=>{
      if(filters[key]===undefined||filters[key]===null)return;
      const node=$(id);
      if([...node.options].some(o=>o.value===String(filters[key])))node.value=String(filters[key]);
      else if(id==='dateFrom'||id==='dateTo')node.value=String(filters[key]);
    });
  }

  function renderFavorites() {
    $('favoriteSelect').innerHTML='<option value="">Choose a saved report…</option>'+state.favorites.map(f=>'<option value="'+escapeHtml(f.id)+'">'+escapeHtml(f.name)+' · '+(f.report_type==='assignments'?'Assignments':'Performance')+'</option>').join('');
  }
  async function loadFavorites(preselectId) {
    const {data,error}=await db.from('saved_report_views')
      .select('id,user_id,name,report_type,config,created_at,updated_at')
      .eq('user_id',state.user.id).order('updated_at',{ascending:false});
    if(error)throw error;
    state.favorites=data||[];
    renderFavorites();
    if(preselectId){$('favoriteSelect').value=preselectId;state.selectedFavoriteId=preselectId;}
  }
  async function saveFavorite() {
    const name=$('favoriteName').value.trim();
    if(!name){say('Give this report a name before saving it as a favorite.','error');$('favoriteName').focus();return;}
    const payload={name,report_type:state.type,config:currentConfig(),is_favorite:true,updated_at:new Date().toISOString()};
    const button=$('saveFavoriteBtn');button.disabled=true;
    try{
      let savedId=state.selectedFavoriteId;
      if(savedId){
        const {data,error}=await db.from('saved_report_views').update(payload).eq('id',savedId).eq('user_id',state.user.id).select('id').single();
        if(error)throw error;savedId=data.id;
      }else{
        const {data,error}=await db.from('saved_report_views').insert({...payload,user_id:state.user.id}).select('id').single();
        if(error)throw error;savedId=data.id;
      }
      await loadFavorites(savedId);
      say('Favorite report saved to your account.','success');
    }catch(error){say(error.message||'Could not save this favorite report.','error');}
    finally{button.disabled=false;}
  }
  async function applyFavorite() {
    const id=$('favoriteSelect').value;
    const favorite=state.favorites.find(f=>f.id===id);
    if(!favorite){say('Choose a saved report first.','error');return;}
    state.selectedFavoriteId=favorite.id;
    $('favoriteName').value=favorite.name;
    setReportType(favorite.report_type,false);
    state.columns=Array.isArray(favorite.config?.columns)?favorite.config.columns:columnSets[state.type].filter(c=>c.default).map(c=>c.key);
    renderColumnEditor();
    setFilters(favorite.config?.filters||{});
    generateReport();
    say('Loaded favorite: '+favorite.name+'. Edit the filters or columns and save to update it.','success');
  }
  async function deleteFavorite() {
    const id=$('favoriteSelect').value;
    if(!id){say('Choose a saved favorite to delete.','error');return;}
    const favorite=state.favorites.find(f=>f.id===id);
    if(!favorite||!window.confirm('Delete the saved report "'+favorite.name+'"?'))return;
    const {error}=await db.from('saved_report_views').delete().eq('id',id).eq('user_id',state.user.id);
    if(error){say(error.message||'Could not delete the favorite.','error');return;}
    state.selectedFavoriteId=null;$('favoriteName').value='';await loadFavorites();
    say('Saved favorite deleted.','success');
  }

  function csvCell(value) {
    return '"'+String(value??'').replace(/"/g,'""')+'"';
  }
  function exportCsv() {
    const cols=columnSets[state.type].filter(c=>state.columns.includes(c.key));
    if(!state.rows.length){say('Generate a report with records before exporting.','error');return;}
    const lines=[cols.map(c=>csvCell(c.label)).join(',')];
    state.rows.forEach(row=>lines.push(cols.map(c=>csvCell(row[c.key])).join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='raisingdiamonds-'+state.type+'-report-'+todayISO()+'.csv';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    say('CSV report exported.','success');
  }

  async function loadData() {
    $('reportLoading').hidden=false;$('reportWorkspace').hidden=true;
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError||!user)throw userError||new Error('Please sign in again.');
    state.user=user;
    const {data:profile,error:profileError}=await db.from('profiles')
      .select('id,full_name,email,account_type,prom,shift,educational_center,group_code')
      .eq('id',user.id).single();
    if(profileError)throw profileError;
    state.profile=profile;
    if(!['teacher','admin'].includes(profile.account_type))throw new Error('Teaching reports are available to approved teachers and administrators.');
    const {data:access,error:accessError}=await db.from('teacher_access')
      .select('user_id,status,is_admin').eq('user_id',user.id).maybeSingle();
    if(accessError)throw accessError;
    state.isAdmin=profile.account_type==='admin'&&access?.is_admin===true;
    if(!state.isAdmin&&(!access||access.status!=='approved'))throw new Error('Your teacher access is not approved yet.');

    const results=await Promise.all([
      readAll('profiles','id,full_name,email,account_type,prom,shift,educational_center,group_code',q=>q.eq('account_type','student').order('full_name',{ascending:true})),
      readAll('attempts','student_id,activity_id,score,total_questions,accuracy,completed_at,duration_seconds,practice_session_id',q=>q.order('completed_at',{ascending:false})),
      readAll('activities','id,title,category,path,active',q=>q.order('title',{ascending:true})),
      readAll('practice_assignments','id,student_id,assigned_by,activity_id,due_date,instructions,created_at,assignment_batch_id,target_type,target_prom,target_shift,target_educational_center,target_group',q=>q.order('created_at',{ascending:false})),
      readAll('practice_sessions','id,student_id,activity_id,status,started_at,completed_at,score,total_questions,duration_seconds',q=>q.order('started_at',{ascending:false})),
      readAll('practice_student_weaknesses','*'),
      readAll('practice_student_drill_skill_insights','*')
    ]);
    [state.profiles,state.attempts,state.activities,state.assignments,state.sessions,state.weaknesses,state.part5]=results;
    state.activityMap=Object.fromEntries(state.activities.map(a=>[a.id,a]));
    fillFilters();
    state.columns=columnSets[state.type].filter(c=>c.default).map(c=>c.key);
    renderColumnEditor();
    await loadFavorites();
    $('reportLoading').hidden=true;$('reportWorkspace').hidden=false;
    $('welcomeReports').textContent='Welcome, '+(profile.full_name||'teacher')+'.';
    generateReport();
  }

  document.querySelectorAll('[data-report-type]').forEach(button=>button.addEventListener('click',()=>setReportType(button.dataset.reportType)));
  $('generateBtn').addEventListener('click',generateReport);
  $('refreshBtn').addEventListener('click',async()=>{
    $('refreshBtn').disabled=true;
    try{
      await loadData();
      say('Report data refreshed from the latest saved records.','success');
    }catch(error){
      $('reportLoading').hidden=true;
      $('reportWorkspace').hidden=false;
      say(error.message||'Could not refresh report data.','error');
    }
    finally{$('refreshBtn').disabled=false;}
  });
  $('columnEditor').addEventListener('change',event=>{
    const box=event.target.closest('[data-report-column]');
    if(!box)return;
    const key=box.dataset.reportColumn;
    if(!box.checked&&state.columns.length===1){box.checked=true;say('Keep at least one visible report column.','');return;}
    if(box.checked&&!state.columns.includes(key))state.columns.push(key);
    if(!box.checked)state.columns=state.columns.filter(x=>x!==key);
    if(state.lastGeneratedAt)generateReport();
  });
  $('saveFavoriteBtn').addEventListener('click',saveFavorite);
  $('loadFavoriteBtn').addEventListener('click',applyFavorite);
  $('deleteFavoriteBtn').addEventListener('click',deleteFavorite);
  $('favoriteSelect').addEventListener('change',()=>{
    const favorite=state.favorites.find(f=>f.id===$('favoriteSelect').value);
    // A favorite is updated only after it has been explicitly loaded.
    state.selectedFavoriteId=null;
    if(favorite)$('favoriteName').value=favorite.name;
  });
  $('newFavoriteBtn').addEventListener('click',()=>{
    state.selectedFavoriteId=null;$('favoriteSelect').value='';$('favoriteName').value='';
    $('favoriteName').focus();say('Name a new favorite report, then choose Save favorite.','');
  });
  $('exportBtn').addEventListener('click',exportCsv);
  $('printBtn').addEventListener('click',()=>window.print());
  loadData().catch(error=>{
    console.error('Teaching reports could not load:',error);
    $('reportLoading').hidden=false;
    $('reportLoading').textContent=error.message||'Teaching reports could not be loaded. Check your account permissions and try again.';
    $('reportWorkspace').hidden=true;
  });
})();