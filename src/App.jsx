import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CAMPOS = ['MJ1','MJ3','MJ4','MJ5','MJ6','MJ8','Don Roberto','La Navidad','Las Mercedes','Santa Maria','Los Vergeles']
const ACTIVIDADES = ['Aplicación','Rastrillo','Fumigación','Batanga','Transporte','Mantenimiento','Remolque','Otro']
const TIPOS_MTTO = ['Preventivo','Correctivo','Emergencia']
const COLORS = ['#1D9E75','#378ADD','#D85A30','#BA7517','#534AB7','#D4537E','#639922','#E24B4A']
const CAMPO_COLORS = {MJ1:'#1D9E75',MJ3:'#378ADD',MJ4:'#D85A30',MJ5:'#534AB7',MJ6:'#BA7517',MJ8:'#D4537E','Don Roberto':'#639922','La Navidad':'#0E7C86','Las Mercedes':'#A0522D','Santa Maria':'#C2185B','Los Vergeles':'#5C6BC0'}
const ESTADOS_AUTORIZACION = ['Pendiente','Autorizado','Rechazado']

const NAV = [
  {id:'dashboard',    label:'Dashboard',       emoji:'📊'},
  {id:'diesel',       label:'Diesel',          emoji:'⛽'},
  {id:'presupuesto',  label:'Presupuesto',     emoji:'📋'},
  {id:'reporte',      label:'Reporte',         emoji:'📑'},
  {id:'mtto',         label:'Mantenimientos',  emoji:'🔧'},
  {id:'autorizaciones',label:'Autorizaciones', emoji:'📋'},
  {id:'analisis',     label:'Análisis',        emoji:'📈'},
  {id:'flotilla',     label:'Flotilla',        emoji:'🚜'},
  {id:'qrcodes',      label:'Códigos QR',      emoji:'🔲'},
]

/* ── Upload helper ── */
async function uploadFotos(files){
  const urls=[]
  for(const file of files){
    const ext=file.name.split('.').pop()
    const path=`mtto/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const {error}=await supabase.storage.from('mtto-fotos').upload(path,file)
    if(error){ urls.push(URL.createObjectURL(file)); continue }
    const {data}=supabase.storage.from('mtto-fotos').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

/* ── UI Primitives ── */
function Badge({color='info',children}){
  const m={success:{bg:'#E1F5EE',c:'#0F6E56'},warning:{bg:'#FAEEDA',c:'#854F0B'},danger:{bg:'#FCEBEB',c:'#A32D2D'},info:{bg:'#E6F1FB',c:'#185FA5'},gray:{bg:'#F1EFE8',c:'#5F5E5A'},purple:{bg:'#EEEDFE',c:'#3C3489'}}
  const s=m[color]||m.info
  return <span style={{background:s.bg,color:s.c,fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:4,whiteSpace:'nowrap'}}>{children}</span>
}
function Stat({label,value,sub,color='#1D9E75'}){
  return <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'14px 16px',flex:1,minWidth:130}}>
    <p style={{fontSize:11,color:'var(--text2)',margin:'0 0 4px'}}>{label}</p>
    <p style={{fontSize:22,fontWeight:600,margin:0,color}}>{value}</p>
    {sub&&<p style={{fontSize:11,color:'var(--text3)',margin:'2px 0 0'}}>{sub}</p>}
  </div>
}
function Card({title,children}){
  return <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
    {title&&<p style={{margin:'0 0 12px',fontSize:13,fontWeight:600,color:'var(--text)'}}>{title}</p>}
    {children}
  </div>
}
function Modal({title,onClose,children,wide}){
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
    <div style={{background:'var(--bg)',borderRadius:14,padding:'20px 24px',width:'100%',maxWidth:wide?680:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:600}}>{title}</h3>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'var(--text2)',lineHeight:1,padding:'0 4px'}}>×</button>
      </div>
      {children}
    </div>
  </div>
}
function Field({label,children}){
  return <div style={{marginBottom:12}}>
    {label&&<label style={{display:'block',fontSize:12,color:'var(--text2)',marginBottom:4,fontWeight:500}}>{label}</label>}
    {children}
  </div>
}
function Btn({onClick,color='#1D9E75',outline,children,small,disabled}){
  return <button onClick={onClick} disabled={disabled} style={{background:outline?'transparent':color,color:outline?color:'#fff',border:`0.5px solid ${outline?color:'transparent'}`,borderRadius:8,padding:small?'5px 12px':'8px 18px',fontSize:small?12:13,fontWeight:500,opacity:disabled?0.5:1,transition:'opacity 0.15s'}}>{children}</button>
}
function Spinner(){return <div style={{display:'flex',justifyContent:'center',padding:40,color:'var(--text3)',fontSize:13}}>Cargando...</div>}
function EmptyState({msg}){return <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text3)',fontSize:13}}>🌾 {msg}</div>}

/* ── Dashboard ── */
function Dashboard({diesel,tractores,mtto}){
  const totalLts=diesel.reduce((s,r)=>s+Number(r.litros),0)
  const totalHrs=diesel.reduce((s,r)=>s+Number(r.horas||0),0)
  const totalHas=diesel.reduce((s,r)=>s+Number(r.hectareas||0),0)
  const rendHr=totalHrs>0?(totalLts/totalHrs).toFixed(1):'-'
  const rendHa=totalHas>0?(totalLts/totalHas).toFixed(1):'-'
  const costMtto=mtto.reduce((s,m)=>s+Number(m.mano_obra||0)+Number(m.refacciones||0),0)
  const byTractor=useMemo(()=>{
    const m={}
    diesel.forEach(r=>{
      if(!m[r.tractor_id])m[r.tractor_id]={litros:0,horas:0,hectareas:0}
      m[r.tractor_id].litros+=Number(r.litros)
      m[r.tractor_id].horas+=Number(r.horas||0)
      m[r.tractor_id].hectareas+=Number(r.hectareas||0)
    })
    return Object.entries(m).map(([id,d])=>({id,litros:d.litros,lts_hr:d.horas>0?+(d.litros/d.horas).toFixed(1):0,lts_ha:d.hectareas>0?+(d.litros/d.hectareas).toFixed(1):0})).sort((a,b)=>b.litros-a.litros).slice(0,12)
  },[diesel])
  const byCampo=useMemo(()=>{const m={};diesel.forEach(r=>{if(!m[r.campo])m[r.campo]=0;m[r.campo]+=Number(r.litros)});return Object.entries(m).map(([campo,litros])=>({campo,litros}))},[diesel])
  const byAct=useMemo(()=>{const m={};diesel.forEach(r=>{if(!m[r.actividad])m[r.actividad]=0;m[r.actividad]+=Number(r.litros)});return Object.entries(m).map(([name,value])=>({name,value}))},[diesel])
  const tendencia=useMemo(()=>{const m={};diesel.forEach(r=>{const k=`Sem ${r.semana}`;if(!m[k])m[k]={semana:k,litros:0,horas:0,n:r.semana};m[k].litros+=Number(r.litros);m[k].horas+=Number(r.horas||0)});return Object.values(m).sort((a,b)=>a.n-b.n)},[diesel])
  if(diesel.length===0)return <div><h2 style={{fontSize:18,fontWeight:600,margin:'0 0 20px'}}>Dashboard general</h2><EmptyState msg="Sin datos aún. Registra consumo de diesel para ver el análisis."/></div>
  return <div>
    <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 16px'}}>Dashboard general</h2>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:20}}>
      <Stat label="Total litros diesel" value={totalLts.toLocaleString()} sub="consumo registrado" color="#1D9E75"/>
      <Stat label="Total horas" value={Number(totalHrs).toFixed(0)} sub="horas trabajadas" color="#378ADD"/>
      <Stat label="Rend. lts/hr" value={rendHr} sub="promedio flotilla" color="#534AB7"/>
      <Stat label="Rend. lts/ha" value={rendHa} sub="promedio flotilla" color="#D85A30"/>
      <Stat label="Tractores activos" value={tractores.filter(t=>t.activo).length} sub={`de ${tractores.length} total`} color="#BA7517"/>
      <Stat label="Costo mantenimientos" value={`$${costMtto.toLocaleString()}`} sub="mano obra + refacciones" color="#D4537E"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
      <Card title="Consumo por tractor (lts)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byTractor} layout="vertical" margin={{left:20,right:20,top:4,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis type="number" tick={{fontSize:11}}/><YAxis dataKey="id" type="category" tick={{fontSize:11}} width={42}/>
            <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/><Bar dataKey="litros" fill="#1D9E75" radius={[0,4,4,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Rendimiento lts/hr por tractor">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={byTractor} layout="vertical" margin={{left:20,right:20,top:4,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis type="number" tick={{fontSize:11}}/><YAxis dataKey="id" type="category" tick={{fontSize:11}} width={42}/>
            <Tooltip formatter={v=>[`${v} lts/hr`,'Rend.']}/><Bar dataKey="lts_hr" fill="#378ADD" radius={[0,4,4,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16,marginBottom:16}}>
      <Card title="Tendencia semanal">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={tendencia}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
            <XAxis dataKey="semana" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Legend/>
            <Line type="monotone" dataKey="litros" stroke="#1D9E75" strokeWidth={2} dot={{r:3}} name="Litros"/>
            <Line type="monotone" dataKey="horas" stroke="#378ADD" strokeWidth={2} dot={{r:3}} name="Horas"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Consumo por actividad">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={byAct} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" label={({name,percent})=>`${name.substring(0,6)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
              {byAct.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip formatter={v=>[`${v} lts`,'']}/>
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
    <Card title="Consumo por campo">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={byCampo}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
          <XAxis dataKey="campo" tick={{fontSize:12}}/><YAxis tick={{fontSize:11}}/>
          <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/>
          <Bar dataKey="litros" radius={[4,4,0,0]}>{byCampo.map(e=><Cell key={e.campo} fill={CAMPO_COLORS[e.campo]||'#1D9E75'}/>)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  </div>
}

/* ── Presupuesto mensual de diesel ── */
function Presupuesto({tractores,diesel,presupuestos,setPresupuestos,loading}){
  const [saving,setSaving]=useState(false)
  const [mes,setMes]=useState(new Date().toISOString().substring(0,7))
  const [editId,setEditId]=useState(null)
  const [litros,setLitros]=useState('')
  const mesLabel=new Date(mes+'-02').toLocaleDateString('es-MX',{month:'long',year:'numeric'})
  const presMap=Object.fromEntries(presupuestos.filter(p=>p.mes===mes).map(p=>[p.tractor_id,p]))
  const consumoMes=useMemo(()=>{
    const m={}
    diesel.filter(r=>r.fecha?.startsWith(mes)).forEach(r=>{m[r.tractor_id]=(m[r.tractor_id]||0)+Number(r.litros||0)})
    return m
  },[diesel,mes])
  const savePres=async(tractorId)=>{
    if(!litros)return
    setSaving(true)
    const existing=presMap[tractorId]
    if(existing){
      const {error}=await supabase.from('presupuesto_diesel').update({litros_asignados:+litros}).eq('id',existing.id)
      if(!error)setPresupuestos(p=>p.map(x=>x.id===existing.id?{...x,litros_asignados:+litros}:x))
    }else{
      const {data,error}=await supabase.from('presupuesto_diesel').insert([{tractor_id:tractorId,mes,litros_asignados:+litros}]).select()
      if(!error)setPresupuestos(p=>[...p,data[0]])
    }
    setEditId(null)
    setLitros('')
    setSaving(false)
  }
  const getAlert=(consumido,asignado)=>{
    if(!asignado)return null
    const pct=consumido/asignado
    if(pct>=1)return{bar:'#E24B4A',badge:'danger',label:'Excedido'}
    if(pct>=0.8)return{bar:'#BA7517',badge:'warning',label:'Por agotarse'}
    return{bar:'#1D9E75',badge:'success',label:'Normal'}
  }
  const tractoresConRegistros=tractores.filter(t=>diesel.some(r=>r.tractor_id===t.id)||presMap[t.id])
  const todos=tractores
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Presupuesto de diesel</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0,textTransform:'capitalize'}}>{mesLabel}</p>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <label style={{fontSize:12,color:'var(--text2)'}}>Mes:</label>
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)} style={{width:'auto',padding:'6px 10px'}}/>
      </div>
    </div>
    {loading?<Spinner/>:<div style={{display:'flex',flexDirection:'column',gap:10}}>
      {todos.map(t=>{
        const pres=presMap[t.id]
        const consumido=consumoMes[t.id]||0
        const asignado=pres?.litros_asignados||0
        const pct=asignado>0?Math.min(consumido/asignado,1):0
        const alert=getAlert(consumido,asignado)
        const isEditing=editId===t.id
        return <div key={t.id} style={{background:'var(--bg)',border:`0.5px solid ${alert?alert.bar+'40':'var(--border)'}`,borderRadius:10,padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:14}}>{t.id}</span>
              <Badge color="gray">{t.campo}</Badge>
              {alert&&<Badge color={alert.badge}>{alert.label}</Badge>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:13,color:'var(--text2)'}}><strong style={{color:alert?.bar||'var(--text)'}}>{consumido.toFixed(0)}</strong>{asignado>0&&<> / {asignado} lts</>}</span>
              {isEditing?(
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input type="number" value={litros} onChange={e=>setLitros(e.target.value)} placeholder="Lts asignados" style={{width:130,padding:'4px 8px',fontSize:12}} autoFocus onKeyDown={e=>{if(e.key==='Enter')savePres(t.id)}}/>
                  <Btn small color="#1D9E75" onClick={()=>savePres(t.id)} disabled={saving}>Guardar</Btn>
                  <Btn small outline color="#888" onClick={()=>{setEditId(null);setLitros('')}}>✕</Btn>
                </div>
              ):(
                <button onClick={()=>{setEditId(t.id);setLitros(asignado||'')}} style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>
                  {asignado?'✏️ Editar':'+ Asignar litros'}
                </button>
              )}
            </div>
          </div>
          {asignado>0&&<div style={{marginTop:10}}>
            <div style={{height:8,borderRadius:4,background:'var(--bg2)',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct*100}%`,background:alert?.bar||'#1D9E75',borderRadius:4,transition:'width 0.4s'}}/>
            </div>
            <p style={{fontSize:10,color:'var(--text3)',margin:'3px 0 0',textAlign:'right'}}>{(pct*100).toFixed(0)}% consumido · {Math.max(0,asignado-consumido).toFixed(0)} lts disponibles</p>
          </div>}
        </div>
      })}
    </div>}
  </div>
}

/* ── Reporte de diesel ── */
function ReporteDiesel({diesel,tractores}){
  const [filterTractor,setFilterTractor]=useState('Todos')
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterActividad,setFilterActividad]=useState('Todos')
  const [filterDesde,setFilterDesde]=useState('')
  const [filterHasta,setFilterHasta]=useState('')
  const tractorMap=Object.fromEntries(tractores.map(t=>[t.id,t]))
  const ids=[...new Set(tractores.map(t=>t.id))].sort()
  const rows=useMemo(()=>diesel.filter(r=>{
    if(filterTractor!=='Todos'&&r.tractor_id!==filterTractor)return false
    if(filterCampo!=='Todos'&&r.campo!==filterCampo)return false
    if(filterActividad!=='Todos'&&r.actividad!==filterActividad)return false
    if(filterDesde&&r.fecha<filterDesde)return false
    if(filterHasta&&r.fecha>filterHasta)return false
    return true
  }),[diesel,filterTractor,filterCampo,filterActividad,filterDesde,filterHasta])
  const rendimiento=useMemo(()=>{
    const m={}
    rows.forEach(r=>{
      const id=r.tractor_id;if(!id)return
      if(!m[id])m[id]={id,litros:0,horas:0,hectareas:0,regs:0}
      m[id].litros+=Number(r.litros||0)
      m[id].horas+=Number(r.horas||0)
      m[id].hectareas+=Number(r.hectareas||0)
      m[id].regs++
    })
    return Object.values(m).sort((a,b)=>b.litros-a.litros).map(x=>({
      ...x,
      lts_hr:x.horas>0?(x.litros/x.horas).toFixed(1):'-',
      lts_ha:x.hectareas>0?(x.litros/x.hectareas).toFixed(1):'-',
      campo:tractorMap[x.id]?.campo||'-'
    }))
  },[rows,tractorMap])
  const totalLts=rows.reduce((s,r)=>s+Number(r.litros||0),0)
  const totalHrs=rows.reduce((s,r)=>s+Number(r.horas||0),0)
  const totalHas=rows.reduce((s,r)=>s+Number(r.hectareas||0),0)
  const exportCSV=()=>{
    const header=['Fecha','Tractor','Campo','Actividad','Litros','Horas','Hectareas','Lts/Hr','Lts/Ha','Operador','Semana','Turno']
    const data=rows.map(r=>[r.fecha,r.tractor_id,r.campo,r.actividad,r.litros||0,r.horas||0,r.hectareas||0,r.horas>0?(r.litros/r.horas).toFixed(1):'',r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'',r.operador||'',r.semana||'',r.turno||''])
    const csv=[[...header],...data,[''],['TOTALES','','','',totalLts.toFixed(0),totalHrs.toFixed(1),totalHas.toFixed(1)]].map(r=>r.join(',')).join('\n')
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download=`reporte_diesel_${new Date().toISOString().split('T')[0]}.csv`;a.click()
    URL.revokeObjectURL(url)
  }
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Reporte de diesel</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>{rows.length} registros · {totalLts.toFixed(0)} lts · {totalHrs.toFixed(1)} hrs</p>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>window.print()} style={{padding:'7px 14px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>🖨️ Imprimir</button>
        <button onClick={exportCSV} style={{padding:'7px 14px',borderRadius:8,background:'#1D9E75',color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:500}}>📥 Exportar CSV</button>
      </div>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',background:'var(--bg)',padding:'12px 14px',borderRadius:10,border:'0.5px solid var(--border)'}}>
      {[
        {label:'Tractor',val:filterTractor,set:setFilterTractor,opts:['Todos',...ids]},
        {label:'Campo',val:filterCampo,set:setFilterCampo,opts:['Todos',...CAMPOS]},
        {label:'Actividad',val:filterActividad,set:setFilterActividad,opts:['Todos',...ACTIVIDADES]},
      ].map(f=><div key={f.label} style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>{f.label}</label>
        <select value={f.val} onChange={e=>f.set(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}>
          {f.opts.map(o=><option key={o}>{o}</option>)}
        </select>
      </div>)}
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Desde</label>
        <input type="date" value={filterDesde} onChange={e=>setFilterDesde(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}/>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:3}}>
        <label style={{fontSize:11,color:'var(--text3)'}}>Hasta</label>
        <input type="date" value={filterHasta} onChange={e=>setFilterHasta(e.target.value)} style={{width:'auto',padding:'6px 10px',fontSize:12}}/>
      </div>
      {(filterTractor!=='Todos'||filterCampo!=='Todos'||filterActividad!=='Todos'||filterDesde||filterHasta)&&
        <button onClick={()=>{setFilterTractor('Todos');setFilterCampo('Todos');setFilterActividad('Todos');setFilterDesde('');setFilterHasta('')}} style={{alignSelf:'flex-end',padding:'6px 12px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',fontSize:12,cursor:'pointer',color:'var(--text2)'}}>✕ Limpiar</button>}
    </div>
    {rendimiento.length>0&&<div style={{marginBottom:20}}>
      <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Rendimiento por tractor</p>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg2)'}}>
            {['Tractor','Campo','Registros','Litros','Horas','Hectáreas','Lts/Hr','Lts/Ha'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',whiteSpace:'nowrap'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rendimiento.map(r=><tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
              <td style={{padding:'7px 10px',fontWeight:700}}>{r.id}</td>
              <td style={{padding:'7px 10px'}}><Badge color="gray">{r.campo}</Badge></td>
              <td style={{padding:'7px 10px',textAlign:'center'}}>{r.regs}</td>
              <td style={{padding:'7px 10px',fontWeight:600,color:'#1D9E75'}}>{r.litros.toFixed(0)} lts</td>
              <td style={{padding:'7px 10px',color:'#378ADD'}}>{r.horas.toFixed(1)} hrs</td>
              <td style={{padding:'7px 10px',color:'#534AB7'}}>{r.hectareas.toFixed(1)} ha</td>
              <td style={{padding:'7px 10px',fontWeight:600,color:r.lts_hr!=='-'&&+r.lts_hr<15?'#1D9E75':r.lts_hr!=='-'&&+r.lts_hr<25?'#BA7517':'#E24B4A'}}>{r.lts_hr!=='-'?`${r.lts_hr} lts/hr`:'-'}</td>
              <td style={{padding:'7px 10px',color:'#534AB7'}}>{r.lts_ha!=='-'?`${r.lts_ha} lts/ha`:'-'}</td>
            </tr>)}
            <tr style={{borderTop:'1.5px solid var(--border)',background:'var(--bg2)'}}>
              <td colSpan={3} style={{padding:'7px 10px',fontWeight:600,fontSize:12}}>TOTALES</td>
              <td style={{padding:'7px 10px',fontWeight:700,color:'#1D9E75'}}>{totalLts.toFixed(0)} lts</td>
              <td style={{padding:'7px 10px',fontWeight:700,color:'#378ADD'}}>{totalHrs.toFixed(1)} hrs</td>
              <td style={{padding:'7px 10px',fontWeight:700,color:'#534AB7'}}>{totalHas.toFixed(1)} ha</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>}
    <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Detalle de registros</p>
    {rows.length===0?<EmptyState msg="Sin registros con los filtros seleccionados."/>:
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg2)'}}>
          {['Fecha','Tractor','Campo','Actividad','Litros','Horas','Hect.','Lts/Hr','Lts/Ha','Operador','Turno'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',whiteSpace:'nowrap'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(r=>{
            const lhr=r.horas>0?(r.litros/r.horas).toFixed(1):'-'
            const lha=r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'-'
            return <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
              <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{r.fecha}</td>
              <td style={{padding:'7px 10px',fontWeight:600}}>{r.tractor_id}</td>
              <td style={{padding:'7px 10px'}}><Badge color="info">{r.campo}</Badge></td>
              <td style={{padding:'7px 10px'}}>{r.actividad}</td>
              <td style={{padding:'7px 10px',fontWeight:600,color:'#1D9E75'}}>{r.litros}</td>
              <td style={{padding:'7px 10px'}}>{r.horas||'-'}</td>
              <td style={{padding:'7px 10px'}}>{r.hectareas||'-'}</td>
              <td style={{padding:'7px 10px',color:'#378ADD'}}>{lhr}</td>
              <td style={{padding:'7px 10px',color:'#534AB7'}}>{lha}</td>
              <td style={{padding:'7px 10px',color:'var(--text2)'}}>{r.operador||'-'}</td>
              <td style={{padding:'7px 10px'}}>{r.turno||'-'}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>}
  </div>
}

/* ── Diesel ── */
function Diesel({diesel,setDiesel,tractores,presupuestos,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterTractor,setFilterTractor]=useState('Todos')
  const [form,setForm]=useState({fecha:new Date().toISOString().split('T')[0],tractor_id:'',campo:'',actividad:'',litros:'',horas:'',hectareas:'',operador:'',semana:'',turno:'DIA'})

  // Auto-open form with tractor preselected when coming from QR scan (?tractor=ID&accion=diesel)
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const tractorId=params.get('tractor')
    const accion=params.get('accion')
    if(tractorId&&accion==='diesel'&&tractores.length>0){
      const t=tractores.find(x=>x.id===tractorId)
      if(t){
        setForm(f=>({...f,tractor_id:t.id,campo:t.campo||'',operador:t.operador||''}))
        setShowForm(true)
        window.history.replaceState({},'',window.location.pathname)
      }
    }
  },[tractores])

  // Presupuesto check
  const alertaPresupuesto=useMemo(()=>{
    if(!form.tractor_id||!form.litros)return null
    const mes=form.fecha?.substring(0,7)||new Date().toISOString().substring(0,7)
    const pres=presupuestos.find(p=>p.tractor_id===form.tractor_id&&p.mes===mes)
    if(!pres)return null
    const consumidoActual=diesel.filter(r=>r.tractor_id===form.tractor_id&&r.fecha?.startsWith(mes)).reduce((s,r)=>s+Number(r.litros||0),0)
    const nuevoTotal=consumidoActual+Number(form.litros||0)
    const disponible=pres.litros_asignados-consumidoActual
    if(nuevoTotal>pres.litros_asignados){
      const excedente=nuevoTotal-pres.litros_asignados
      return{tipo:'danger',msg:`⚠️ Esta carga excede el presupuesto mensual por ${excedente.toFixed(0)} lts. Disponible: ${Math.max(0,disponible).toFixed(0)} lts de ${pres.litros_asignados} asignados.`}
    }
    const pct=nuevoTotal/pres.litros_asignados
    if(pct>=0.8){
      return{tipo:'warning',msg:`⚠️ Esta carga dejará al tractor en ${(pct*100).toFixed(0)}% del presupuesto mensual. Disponible tras carga: ${(pres.litros_asignados-nuevoTotal).toFixed(0)} lts.`}
    }
    return null
  },[form.tractor_id,form.litros,form.fecha,diesel,presupuestos])

  const handleSubmit=async()=>{
    if(!form.tractor_id||!form.litros){alert('Tractor y litros son obligatorios');return}
    setSaving(true)
    const row={...form,litros:+form.litros,horas:+form.horas||null,hectareas:+form.hectareas||null,semana:+form.semana||null}
    const {data,error}=await supabase.from('diesel_registros').insert([row]).select()
    if(error){alert('Error: '+error.message)}
    else{setDiesel(d=>[data[0],...d]);setShowForm(false);setForm({fecha:new Date().toISOString().split('T')[0],tractor_id:'',campo:'',actividad:'',litros:'',horas:'',hectareas:'',operador:'',semana:'',turno:'DIA'})}
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar este registro?'))return
    await supabase.from('diesel_registros').delete().eq('id',id)
    setDiesel(d=>d.filter(r=>r.id!==id))
  }
  const ids=[...new Set(tractores.map(t=>t.id))].sort()
  const rows=diesel.filter(r=>(filterCampo==='Todos'||r.campo===filterCampo)&&(filterTractor==='Todos'||r.tractor_id===filterTractor))
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Registro de diesel</h2>
      <Btn onClick={()=>setShowForm(true)} color="#1D9E75">+ Nuevo registro</Btn>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
      <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
      </select>
      <select value={filterTractor} onChange={e=>setFilterTractor(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{ids.map(t=><option key={t}>{t}</option>)}
      </select>
      <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>{rows.length} registros</span>
    </div>
    {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin registros. Agrega el primer consumo de diesel."/>:
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{borderBottom:'0.5px solid var(--border)'}}>
          {['Fecha','Tractor','Campo','Actividad','Litros','Horas','Hect.','Lts/Hr','Lts/Ha','Operador',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12,whiteSpace:'nowrap'}}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(r=>{
            const lhr=r.horas>0?(r.litros/r.horas).toFixed(1):'-'
            const lha=r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'-'
            return <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
              <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{r.fecha}</td>
              <td style={{padding:'8px 10px',fontWeight:600}}>{r.tractor_id}</td>
              <td style={{padding:'8px 10px'}}><Badge color="info">{r.campo}</Badge></td>
              <td style={{padding:'8px 10px'}}>{r.actividad}</td>
              <td style={{padding:'8px 10px',fontWeight:600,color:'#1D9E75'}}>{r.litros}</td>
              <td style={{padding:'8px 10px'}}>{r.horas||'-'}</td>
              <td style={{padding:'8px 10px'}}>{r.hectareas||'-'}</td>
              <td style={{padding:'8px 10px',color:'#378ADD',fontWeight:500}}>{lhr}</td>
              <td style={{padding:'8px 10px',color:'#534AB7',fontWeight:500}}>{lha}</td>
              <td style={{padding:'8px 10px',color:'var(--text2)',fontSize:12}}>{r.operador}</td>
              <td style={{padding:'8px 10px'}}><button onClick={()=>handleDelete(r.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>}
    {showForm&&<Modal title="Nuevo registro de diesel" onClose={()=>setShowForm(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Semana #"><input type="number" placeholder="19" value={form.semana} onChange={e=>setForm(f=>({...f,semana:e.target.value}))}/></Field>
        <Field label="Tractor">
          <select value={form.tractor_id} onChange={e=>{const t=tractores.find(x=>x.id===e.target.value);setForm(f=>({...f,tractor_id:e.target.value,campo:t?.campo||f.campo,operador:t?.operador||f.operador}))}}>
            <option value="">Seleccionar...</option>
            {ids.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Campo">
          <select value={form.campo} onChange={e=>setForm(f=>({...f,campo:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {CAMPOS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Actividad">
          <select value={form.actividad} onChange={e=>setForm(f=>({...f,actividad:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {ACTIVIDADES.map(a=><option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Turno">
          <select value={form.turno} onChange={e=>setForm(f=>({...f,turno:e.target.value}))}>
            <option>DIA</option><option>NOCHE</option>
          </select>
        </Field>
        <Field label="Litros diesel *"><input type="number" placeholder="0" value={form.litros} onChange={e=>setForm(f=>({...f,litros:e.target.value}))}/></Field>
        <Field label="Horas trabajadas"><input type="number" step="0.1" placeholder="0.0" value={form.horas} onChange={e=>setForm(f=>({...f,horas:e.target.value}))}/></Field>
        <Field label="Hectáreas"><input type="number" step="0.1" placeholder="0.0" value={form.hectareas} onChange={e=>setForm(f=>({...f,hectareas:e.target.value}))}/></Field>
        <Field label="Operador"><input type="text" placeholder="Nombre del operador" value={form.operador} onChange={e=>setForm(f=>({...f,operador:e.target.value}))}/></Field>
      </div>
      {alertaPresupuesto&&<div style={{background:alertaPresupuesto.tipo==='danger'?'#FCEBEB':'#FAEEDA',border:`1px solid ${alertaPresupuesto.tipo==='danger'?'#F09595':'#E5C17A'}`,borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:13,color:alertaPresupuesto.tipo==='danger'?'#A32D2D':'#854F0B'}}>{alertaPresupuesto.msg}</div>}
      {form.litros&&form.horas&&<div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>
        <strong>Rendimiento calculado:</strong>{' '}
        <span style={{color:'#378ADD'}}>{(form.litros/form.horas).toFixed(1)} lts/hr</span>
        {form.hectareas>0&&<> · <span style={{color:'#534AB7'}}>{(form.litros/form.hectareas).toFixed(1)} lts/ha</span></>}
      </div>}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar registro'}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Mantenimientos ── */
function Mantenimientos({mtto,setMtto,tractores,loading}){
  const [showForm,setShowForm]=useState(false)
  const [editId,setEditId]=useState(null)
  const [saving,setSaving]=useState(false)
  const [filterEstado,setFilterEstado]=useState('Todos')
  const [fotoPreviews,setFotoPreviews]=useState([])
  const [pendingFiles,setPendingFiles]=useState([])
  const emptyForm={fecha:new Date().toISOString().split('T')[0],tractor_id:'',tipo:'Preventivo',descripcion:'',mano_obra:'',refacciones:'',tecnico:'',estado:'En proceso',observaciones:''}
  const [form,setForm]=useState(emptyForm)
  const openNew=()=>{setEditId(null);setForm(emptyForm);setFotoPreviews([]);setPendingFiles([]);setShowForm(true)}
  const openEdit=(m)=>{
    setEditId(m.id)
    setForm({fecha:m.fecha,tractor_id:m.tractor_id,tipo:m.tipo,descripcion:m.descripcion,mano_obra:m.mano_obra||'',refacciones:m.refacciones||'',tecnico:m.tecnico||'',estado:m.estado,observaciones:m.observaciones||''})
    setFotoPreviews(m.fotos||[])
    setPendingFiles([])
    setShowForm(true)
  }
  const handleChangeEstado=async(id,nuevoEstado)=>{
    await supabase.from('mantenimientos').update({estado:nuevoEstado}).eq('id',id)
    setMtto(m=>m.map(x=>x.id===id?{...x,estado:nuevoEstado}:x))
  }
  const handleFotos=(e)=>{
    const files=Array.from(e.target.files)
    setFotoPreviews(p=>[...p,...files.map(f=>URL.createObjectURL(f))])
    setPendingFiles(p=>[...p,...files])
  }
  const handleSubmit=async()=>{
    if(!form.tractor_id||!form.descripcion){alert('Tractor y descripción son obligatorios');return}
    setSaving(true)
    const existingUrls=fotoPreviews.filter(u=>!u.startsWith('blob:'))
    const uploadedUrls=pendingFiles.length>0?await uploadFotos(pendingFiles):[]
    const allFotos=[...existingUrls,...uploadedUrls]
    const row={...form,mano_obra:+form.mano_obra||0,refacciones:+form.refacciones||0,fotos:allFotos}
    if(editId){
      const {error}=await supabase.from('mantenimientos').update(row).eq('id',editId)
      if(error){alert('Error: '+error.message)}
      else{setMtto(m=>m.map(x=>x.id===editId?{...x,...row}:x));setShowForm(false)}
    }else{
      const {data,error}=await supabase.from('mantenimientos').insert([row]).select()
      if(error){alert('Error: '+error.message)}
      else{setMtto(m=>[data[0],...m]);setShowForm(false)}
    }
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar este mantenimiento?'))return
    await supabase.from('mantenimientos').delete().eq('id',id)
    setMtto(m=>m.filter(x=>x.id!==id))
  }
  const estadoColor={Completado:'success','En proceso':'warning',Pendiente:'info',Cancelado:'danger'}
  const tipoColor={Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}
  const rows=mtto.filter(m=>filterEstado==='Todos'||m.estado===filterEstado)
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Mantenimientos</h2>
      <Btn onClick={openNew} color="#378ADD">+ Nuevo mantenimiento</Btn>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      {['Todos','En proceso','Completado','Pendiente','Cancelado'].map(e=><button key={e} onClick={()=>setFilterEstado(e)} style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:500,border:filterEstado===e?'1.5px solid #378ADD':'0.5px solid var(--border)',background:filterEstado===e?'#E6F1FB':'transparent',color:filterEstado===e?'#185FA5':'var(--text2)'}}>{e}</button>)}
    </div>
    {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin mantenimientos. Registra el primero."/>:
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {rows.map(m=><div key={m.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:16,fontWeight:700}}>{m.tractor_id}</span>
            <Badge color={tipoColor[m.tipo]||'gray'}>{m.tipo}</Badge>
            <Badge color={estadoColor[m.estado]||'gray'}>{m.estado}</Badge>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--text3)'}}>{m.fecha}</span>
            <button onClick={()=>openEdit(m)} style={{background:'none',border:'0.5px solid var(--border)',borderRadius:6,color:'#378ADD',cursor:'pointer',fontSize:12,padding:'3px 8px',fontWeight:500}}>✏️ Editar</button>
            <button onClick={()=>handleDelete(m.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button>
          </div>
        </div>
        <p style={{margin:'0 0 6px',fontSize:14,fontWeight:500}}>{m.descripcion}</p>
        {m.observaciones&&<p style={{margin:'0 0 8px',fontSize:13,color:'var(--text2)'}}>{m.observaciones}</p>}
        <div style={{display:'flex',gap:16,fontSize:13,color:'var(--text2)',flexWrap:'wrap'}}>
          {m.tecnico&&<span>🔧 <strong style={{color:'var(--text)'}}>{m.tecnico}</strong></span>}
          <span>💵 M.O.: <strong style={{color:'#1D9E75'}}>${Number(m.mano_obra).toLocaleString()}</strong></span>
          <span>🔩 Ref.: <strong style={{color:'#D85A30'}}>${Number(m.refacciones).toLocaleString()}</strong></span>
          <span style={{fontWeight:600,color:'var(--text)'}}>Total: ${(Number(m.mano_obra)+Number(m.refacciones)).toLocaleString()}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8}}>
          <span style={{fontSize:11,color:'var(--text3)'}}>Cambiar estado:</span>
          <select value={m.estado} onChange={e=>handleChangeEstado(m.id,e.target.value)} style={{padding:'4px 10px',borderRadius:6,fontSize:12,cursor:'pointer',border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text)'}}>
            {['En proceso','Completado','Pendiente','Cancelado'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        {m.fotos?.length>0&&<div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          {m.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:80,height:60,objectFit:'cover',borderRadius:6,border:'0.5px solid var(--border)'}}/>)}
        </div>}
      </div>)}
    </div>}
    {showForm&&<Modal title={editId?'Editar mantenimiento':'Nuevo mantenimiento'} onClose={()=>setShowForm(false)} wide>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Tractor *">
          <select value={form.tractor_id} onChange={e=>setForm(f=>({...f,tractor_id:e.target.value}))}>
            <option value="">Seleccionar...</option>
            {tractores.map(t=><option key={t.id} value={t.id}>{t.id} — {t.campo}</option>)}
          </select>
        </Field>
        <Field label="Tipo"><select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>{TIPOS_MTTO.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Estado"><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>{['En proceso','Completado','Pendiente','Cancelado'].map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Descripción *"><textarea value={form.descripcion} rows={2} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{resize:'vertical'}}/></Field>
      <Field label="Técnico"><input type="text" placeholder="Nombre del técnico" value={form.tecnico} onChange={e=>setForm(f=>({...f,tecnico:e.target.value}))}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Mano de obra ($)"><input type="number" placeholder="0" value={form.mano_obra} onChange={e=>setForm(f=>({...f,mano_obra:e.target.value}))}/></Field>
        <Field label="Refacciones ($)"><input type="number" placeholder="0" value={form.refacciones} onChange={e=>setForm(f=>({...f,refacciones:e.target.value}))}/></Field>
      </div>
      {(form.mano_obra||form.refacciones)&&<div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>Total: <strong style={{color:'#1D9E75'}}>${((+form.mano_obra||0)+(+form.refacciones||0)).toLocaleString()}</strong></div>}
      <Field label="Observaciones"><textarea value={form.observaciones} rows={2} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} style={{resize:'vertical'}}/></Field>
      <Field label="📷 Fotos del trabajo">
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',border:'1px dashed var(--border2)',borderRadius:8,cursor:'pointer',fontSize:13,color:'var(--text2)'}}>
          Subir fotos<input type="file" accept="image/*" multiple onChange={handleFotos} style={{display:'none'}}/>
        </label>
        {fotoPreviews.length>0&&<div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          {fotoPreviews.map((url,i)=><div key={i} style={{position:'relative'}}>
            <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:6}}/>
            <button onClick={()=>{const removed=fotoPreviews[i];setFotoPreviews(p=>p.filter((_,j)=>j!==i));if(removed?.startsWith('blob:')){const blobIdx=fotoPreviews.slice(0,i).filter(u=>u.startsWith('blob:')).length;setPendingFiles(p=>p.filter((_,j)=>j!==blobIdx))}}} style={{position:'absolute',top:-4,right:-4,background:'#E24B4A',color:'#fff',border:'none',borderRadius:'50%',width:16,height:16,fontSize:10,cursor:'pointer'}}>×</button>
          </div>)}
        </div>}
      </Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#378ADD" onClick={handleSubmit} disabled={saving}>{saving?'Subiendo y guardando...':(editId?'Guardar cambios':'Guardar mantenimiento')}</Btn>
      </div>
    </Modal>}
  </div>
}

/* ── Análisis ── */
function Analisis({diesel,tractores,mtto}){
  const [selected,setSelected]=useState(null)
  const stats=useMemo(()=>tractores.map(t=>{
    const regs=diesel.filter(r=>r.tractor_id===t.id)
    const mttos=mtto.filter(m=>m.tractor_id===t.id)
    const lts=regs.reduce((s,r)=>s+Number(r.litros),0)
    const hrs=regs.reduce((s,r)=>s+Number(r.horas||0),0)
    const has=regs.reduce((s,r)=>s+Number(r.hectareas||0),0)
    const acts={};regs.forEach(r=>{acts[r.actividad]=(acts[r.actividad]||0)+Number(r.litros)})
    const mainAct=Object.entries(acts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
    return{...t,lts,hrs:+hrs.toFixed(1),has:+has.toFixed(1),lts_hr:hrs>0?+(lts/hrs).toFixed(1):0,lts_ha:has>0?+(lts/has).toFixed(1):0,mttoCount:mttos.length,costMtto:mttos.reduce((s,m)=>s+Number(m.mano_obra||0)+Number(m.refacciones||0),0),regs:regs.length,mainAct}
  }).filter(t=>t.regs>0),[diesel,tractores,mtto])
  const catColor=v=>v===0?'gray':v<15?'success':v<25?'info':'warning'
  const catLabel=v=>v===0?'Sin datos':v<15?'Eficiente':v<25?'Normal':'Alto consumo'
  const sel=selected?stats.find(t=>t.id===selected):null
  const selDiesel=selected?diesel.filter(r=>r.tractor_id===selected):[]
  const selMtto=selected?mtto.filter(m=>m.tractor_id===selected):[]
  return <div>
    <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 16px'}}>Análisis por tractor</h2>
    {stats.length===0?<EmptyState msg="Sin datos suficientes para el análisis."/>:<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12,marginBottom:20}}>
        {stats.map(t=><div key={t.id} onClick={()=>setSelected(selected===t.id?null:t.id)} style={{background:'var(--bg)',borderRadius:12,padding:'14px 16px',cursor:'pointer',border:selected===t.id?'2px solid #1D9E75':'0.5px solid var(--border)',transition:'border-color 0.15s'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
            <span style={{fontSize:17,fontWeight:700}}>{t.id}</span>
            <Badge color={catColor(t.lts_hr)}>{catLabel(t.lts_hr)}</Badge>
          </div>
          <div style={{marginBottom:8}}><Badge color="gray">{t.campo}</Badge></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            <div><p style={{fontSize:10,color:'var(--text3)',margin:0}}>Total lts</p><p style={{fontSize:15,fontWeight:700,margin:0,color:'#1D9E75'}}>{t.lts}</p></div>
            <div><p style={{fontSize:10,color:'var(--text3)',margin:0}}>Lts/hr</p><p style={{fontSize:15,fontWeight:700,margin:0,color:'#378ADD'}}>{t.lts_hr||'—'}</p></div>
            <div><p style={{fontSize:10,color:'var(--text3)',margin:0}}>Horas</p><p style={{fontSize:13,fontWeight:500,margin:0}}>{t.hrs}</p></div>
            <div><p style={{fontSize:10,color:'var(--text3)',margin:0}}>Lts/ha</p><p style={{fontSize:13,fontWeight:500,margin:0,color:'#534AB7'}}>{t.lts_ha||'—'}</p></div>
          </div>
          <p style={{margin:'8px 0 0',fontSize:12,color:'var(--text2)'}}>Actividad: <strong>{t.mainAct}</strong></p>
          {t.mttoCount>0&&<p style={{margin:'4px 0 0',fontSize:12,color:'var(--text2)'}}>Mttos: <strong>{t.mttoCount}</strong> · <strong style={{color:'#D85A30'}}>${t.costMtto.toLocaleString()}</strong></p>}
        </div>)}
      </div>
      {sel&&<Card title={`Detalle: ${sel.id} — ${sel.campo}`}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
          <Stat label="Total litros" value={sel.lts} color="#1D9E75"/>
          <Stat label="Total horas" value={sel.hrs} color="#378ADD"/>
          <Stat label="Lts/hora" value={sel.lts_hr||'—'} color="#534AB7"/>
          <Stat label="Lts/hectárea" value={sel.lts_ha||'—'} color="#D85A30"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Consumo registrado</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={selDiesel.map(r=>({fecha:r.fecha,lts:r.litros}))}>
                <XAxis dataKey="fecha" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/>
                <Bar dataKey="lts" fill="#1D9E75" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Mantenimientos</p>
            {selMtto.length===0?<p style={{fontSize:13,color:'var(--text3)'}}>Sin mantenimientos registrados</p>:
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {selMtto.map(m=><div key={m.id} style={{fontSize:12,padding:'8px 10px',background:'var(--bg2)',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontWeight:600}}>{m.descripcion}</span>
                  <Badge color={{Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}[m.tipo]||'gray'}>{m.tipo}</Badge>
                </div>
                <span style={{color:'var(--text2)'}}>{m.fecha} · <strong>${(Number(m.mano_obra)+Number(m.refacciones)).toLocaleString()}</strong></span>
              </div>)}
            </div>}
          </div>
        </div>
      </Card>}
    </>}
  </div>
}

/* ── Autorizaciones ── */
function InformeImprimible({sol,tractor,onClose}){
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:2000,overflowY:'auto',padding:'24px 12px'}}>
    <div style={{maxWidth:760,margin:'0 auto',background:'#fff',borderRadius:8,padding:'40px 48px',color:'#1a1a18'}}>
      <div className="no-print" style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:20}}>
        <button onClick={()=>window.print()} style={{padding:'8px 18px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:500}}>🖨️ Imprimir / Guardar PDF</button>
        <button onClick={onClose} style={{padding:'8px 18px',borderRadius:8,background:'none',border:'0.5px solid #ccc',cursor:'pointer',fontSize:13}}>Cerrar</button>
      </div>
      <div style={{textAlign:'center',marginBottom:24,borderBottom:'2px solid #1D9E75',paddingBottom:16}}>
        <h1 style={{fontSize:20,fontWeight:700,margin:'0 0 4px'}}>Solicitud de Autorización de Mantenimiento</h1>
        <p style={{fontSize:13,color:'#5F5E5A',margin:0}}>Grupo Molina · Flotilla de Tractores · Folio #{sol.id}</p>
      </div>
      <table style={{width:'100%',fontSize:13,borderCollapse:'collapse',marginBottom:20}}><tbody>
        <tr><td style={{padding:'6px 0',fontWeight:600,width:160}}>Fecha:</td><td>{sol.fecha}</td></tr>
        <tr><td style={{padding:'6px 0',fontWeight:600}}>Tractor:</td><td>{sol.tractor_id}{tractor?` — Campo ${tractor.campo}`:''}</td></tr>
        <tr><td style={{padding:'6px 0',fontWeight:600}}>Solicitado por:</td><td>{sol.solicitante||'—'}</td></tr>
        <tr><td style={{padding:'6px 0',fontWeight:600}}>Proveedor / Mecánico:</td><td>{sol.proveedor||'—'}</td></tr>
        <tr><td style={{padding:'6px 0',fontWeight:600}}>Costo estimado:</td><td>${Number(sol.costo_estimado||0).toLocaleString()}</td></tr>
        <tr><td style={{padding:'6px 0',fontWeight:600}}>Estado:</td><td><strong>{sol.estado}</strong></td></tr>
      </tbody></table>
      <div style={{marginBottom:20}}><p style={{fontWeight:600,fontSize:13,marginBottom:6}}>Descripción:</p><p style={{fontSize:13,background:'#f7f7f5',padding:'10px 12px',borderRadius:6}}>{sol.descripcion}</p></div>
      {sol.pieza_danada&&<div style={{marginBottom:20}}><p style={{fontWeight:600,fontSize:13,marginBottom:6}}>Pieza dañada:</p><p style={{fontSize:13,background:'#f7f7f5',padding:'10px 12px',borderRadius:6}}>{sol.pieza_danada}</p></div>}
      {sol.fotos?.length>0&&<div style={{marginBottom:20}}><p style={{fontWeight:600,fontSize:13,marginBottom:8}}>Evidencia fotográfica:</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{sol.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:150,height:110,objectFit:'cover',borderRadius:6,border:'1px solid #ddd'}}/>)}</div></div>}
      {sol.comentarios_contraloria&&<div style={{marginBottom:20}}><p style={{fontWeight:600,fontSize:13,marginBottom:6}}>Comentarios Contraloría:</p><p style={{fontSize:13,background:'#f7f7f5',padding:'10px 12px',borderRadius:6}}>{sol.comentarios_contraloria}</p></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:30,marginTop:48,paddingTop:24,borderTop:'1px solid #ddd'}}>
        <div style={{textAlign:'center'}}><div style={{borderTop:'1px solid #333',marginTop:40,paddingTop:6,fontSize:12}}>Solicitante</div></div>
        <div style={{textAlign:'center'}}><div style={{borderTop:'1px solid #333',marginTop:40,paddingTop:6,fontSize:12}}>Autorizado por Contraloría{sol.autorizado_por?` — ${sol.autorizado_por}`:''}{sol.fecha_resolucion&&<div style={{color:'#888'}}>{sol.fecha_resolucion}</div>}</div></div>
      </div>
    </div>
  </div>
}

function Autorizaciones({autorizaciones,setAutorizaciones,tractores,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterEstado,setFilterEstado]=useState('Todos')
  const [fotoPreviews,setFotoPreviews]=useState([])
  const [pendingFiles,setPendingFiles]=useState([])
  const [informeSol,setInformeSol]=useState(null)
  const [resolModal,setResolModal]=useState(null)
  const [comentario,setComentario]=useState('')
  const [autorizadoPor,setAutorizadoPor]=useState('')
  const emptyForm={fecha:new Date().toISOString().split('T')[0],tractor_id:'',solicitante:'',proveedor:'',descripcion:'',pieza_danada:'',costo_estimado:'',estado:'Pendiente'}
  const [form,setForm]=useState(emptyForm)
  const handleFotos=(e)=>{
    const files=Array.from(e.target.files)
    setFotoPreviews(p=>[...p,...files.map(f=>URL.createObjectURL(f))])
    setPendingFiles(p=>[...p,...files])
  }
  const handleSubmit=async()=>{
    if(!form.tractor_id||!form.descripcion||!form.proveedor){alert('Tractor, proveedor y descripción son obligatorios');return}
    setSaving(true)
    const uploadedUrls=pendingFiles.length>0?await uploadFotos(pendingFiles):[]
    const row={...form,costo_estimado:+form.costo_estimado||0,fotos:uploadedUrls}
    const {data,error}=await supabase.from('autorizaciones_mtto').insert([row]).select()
    if(error){alert('Error: '+error.message)}
    else{setAutorizaciones(a=>[data[0],...a]);setShowForm(false);setFotoPreviews([]);setPendingFiles([]);setForm(emptyForm)}
    setSaving(false)
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar esta solicitud?'))return
    await supabase.from('autorizaciones_mtto').delete().eq('id',id)
    setAutorizaciones(a=>a.filter(x=>x.id!==id))
  }
  const openResol=(sol,accion)=>{setResolModal({sol,accion});setComentario(sol.comentarios_contraloria||'');setAutorizadoPor(sol.autorizado_por||'')}
  const confirmResol=async()=>{
    const {sol,accion}=resolModal
    const nuevoEstado=accion==='autorizar'?'Autorizado':'Rechazado'
    const row={estado:nuevoEstado,comentarios_contraloria:comentario,autorizado_por:autorizadoPor,fecha_resolucion:new Date().toISOString().split('T')[0]}
    const {error}=await supabase.from('autorizaciones_mtto').update(row).eq('id',sol.id)
    if(error){alert('Error: '+error.message);return}
    setAutorizaciones(a=>a.map(x=>x.id===sol.id?{...x,...row}:x))
    setResolModal(null)
  }
  const estadoColor={Pendiente:'warning',Autorizado:'success',Rechazado:'danger'}
  const tractorMap=Object.fromEntries(tractores.map(t=>[t.id,t]))
  const rows=autorizaciones.filter(a=>filterEstado==='Todos'||a.estado===filterEstado)
  const pendientesCount=autorizaciones.filter(a=>a.estado==='Pendiente').length
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Autorizaciones de mantenimiento</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>Solicitudes para Contraloría · {pendientesCount} pendiente{pendientesCount!==1?'s':''}</p>
      </div>
      <Btn onClick={()=>setShowForm(true)} color="#534AB7">+ Nueva solicitud</Btn>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
      {['Todos',...ESTADOS_AUTORIZACION].map(e=><button key={e} onClick={()=>setFilterEstado(e)} style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:500,border:filterEstado===e?'1.5px solid #534AB7':'0.5px solid var(--border)',background:filterEstado===e?'#EEEDFE':'transparent',color:filterEstado===e?'#3C3489':'var(--text2)'}}>{e}</button>)}
    </div>
    {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin solicitudes de autorización registradas."/>:
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {rows.map(sol=>{
        const tractor=tractorMap[sol.tractor_id]
        return <div key={sol.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:15,fontWeight:700}}>{sol.tractor_id}</span>
              {tractor&&<Badge color="gray">{tractor.campo}</Badge>}
              <Badge color={estadoColor[sol.estado]||'gray'}>{sol.estado}</Badge>
              <span style={{fontSize:11,color:'var(--text3)'}}>Folio #{sol.id}</span>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setInformeSol(sol)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>📄 Ver informe</button>
              <button onClick={()=>handleDelete(sol.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button>
            </div>
          </div>
          <p style={{margin:'0 0 6px',fontSize:14,fontWeight:500}}>{sol.descripcion}</p>
          {sol.pieza_danada&&<p style={{margin:'0 0 8px',fontSize:13,color:'var(--text2)'}}>🔩 {sol.pieza_danada}</p>}
          <div style={{display:'flex',gap:16,fontSize:13,color:'var(--text2)',flexWrap:'wrap'}}>
            <span>🏭 <strong style={{color:'var(--text)'}}>{sol.proveedor}</strong></span>
            <span>💵 <strong style={{color:'#534AB7'}}>${Number(sol.costo_estimado||0).toLocaleString()}</strong></span>
            {sol.solicitante&&<span>👤 {sol.solicitante}</span>}
            <span style={{color:'var(--text3)'}}>{sol.fecha}</span>
          </div>
          {sol.fotos?.length>0&&<div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>{sol.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:70,height:54,objectFit:'cover',borderRadius:6}}/>)}</div>}
          {sol.estado==='Pendiente'?(
            <div style={{display:'flex',gap:8,marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
              <Btn color="#1D9E75" small onClick={()=>openResol(sol,'autorizar')}>✓ Autorizar (Contraloría)</Btn>
              <Btn color="#A32D2D" outline small onClick={()=>openResol(sol,'rechazar')}>✕ Rechazar</Btn>
            </div>
          ):(
            <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid var(--border)',fontSize:12,color:'var(--text2)'}}>
              {sol.estado==='Autorizado'?'✓ Autorizado':'✕ Rechazado'} por <strong>{sol.autorizado_por||'Contraloría'}</strong> el {sol.fecha_resolucion}
              {sol.comentarios_contraloria&&<div style={{marginTop:4,fontStyle:'italic'}}>"{sol.comentarios_contraloria}"</div>}
            </div>
          )}
        </div>
      })}
    </div>}
    {showForm&&<Modal title="Nueva solicitud de autorización" onClose={()=>setShowForm(false)} wide>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
        <Field label="Tractor *"><select value={form.tractor_id} onChange={e=>setForm(f=>({...f,tractor_id:e.target.value}))}><option value="">Seleccionar...</option>{tractores.map(t=><option key={t.id} value={t.id}>{t.id} — {t.campo}</option>)}</select></Field>
        <Field label="Solicitado por"><input type="text" placeholder="Nombre" value={form.solicitante} onChange={e=>setForm(f=>({...f,solicitante:e.target.value}))}/></Field>
        <Field label="Proveedor *"><input type="text" placeholder="Nombre del taller o mecánico" value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))}/></Field>
      </div>
      <Field label="Descripción *"><textarea value={form.descripcion} rows={3} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{resize:'vertical'}}/></Field>
      <Field label="Pieza dañada"><textarea value={form.pieza_danada} rows={2} onChange={e=>setForm(f=>({...f,pieza_danada:e.target.value}))} style={{resize:'vertical'}}/></Field>
      <Field label="Costo estimado ($)"><input type="number" placeholder="0" value={form.costo_estimado} onChange={e=>setForm(f=>({...f,costo_estimado:e.target.value}))}/></Field>
      <Field label="📷 Fotos de la pieza dañada">
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',border:'1px dashed var(--border2)',borderRadius:8,cursor:'pointer',fontSize:13,color:'var(--text2)'}}>
          Subir fotos<input type="file" accept="image/*" multiple onChange={handleFotos} style={{display:'none'}}/>
        </label>
        {fotoPreviews.length>0&&<div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          {fotoPreviews.map((url,i)=><div key={i} style={{position:'relative'}}>
            <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:6}}/>
            <button onClick={()=>{setFotoPreviews(p=>p.filter((_,j)=>j!==i));setPendingFiles(p=>p.filter((_,j)=>j!==i))}} style={{position:'absolute',top:-4,right:-4,background:'#E24B4A',color:'#fff',border:'none',borderRadius:'50%',width:16,height:16,fontSize:10,cursor:'pointer'}}>×</button>
          </div>)}
        </div>}
      </Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#534AB7" onClick={handleSubmit} disabled={saving}>{saving?'Subiendo y enviando...':'Enviar solicitud'}</Btn>
      </div>
    </Modal>}
    {resolModal&&<Modal title={resolModal.accion==='autorizar'?'Autorizar solicitud':'Rechazar solicitud'} onClose={()=>setResolModal(null)}>
      <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Tractor <strong>{resolModal.sol.tractor_id}</strong> — {resolModal.sol.descripcion}</p>
      <Field label="Autorizado / Rechazado por"><input type="text" placeholder="Nombre de quien resuelve" value={autorizadoPor} onChange={e=>setAutorizadoPor(e.target.value)}/></Field>
      <Field label="Comentarios"><textarea rows={3} value={comentario} onChange={e=>setComentario(e.target.value)} style={{resize:'vertical'}}/></Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setResolModal(null)}>Cancelar</Btn>
        <Btn color={resolModal.accion==='autorizar'?'#1D9E75':'#A32D2D'} onClick={confirmResol}>{resolModal.accion==='autorizar'?'Confirmar autorización':'Confirmar rechazo'}</Btn>
      </div>
    </Modal>}
    {informeSol&&<InformeImprimible sol={informeSol} tractor={tractorMap[informeSol.tractor_id]} onClose={()=>setInformeSol(null)}/>}
  </div>
}

/* ── Ficha de tractor (historial completo) ── */
function FichaTractor({tractor, diesel, mtto, autorizaciones, onClose}){
  const [tab,setTab]=useState('diesel')
  const tDiesel=diesel.filter(r=>r.tractor_id===tractor.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))
  const tMtto=mtto.filter(m=>m.tractor_id===tractor.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))
  const tAuth=autorizaciones.filter(a=>a.tractor_id===tractor.id).sort((a,b)=>b.fecha?.localeCompare(a.fecha))
  const totalLts=tDiesel.reduce((s,r)=>s+Number(r.litros||0),0)
  const totalHrs=tDiesel.reduce((s,r)=>s+Number(r.horas||0),0)
  const totalHas=tDiesel.reduce((s,r)=>s+Number(r.hectareas||0),0)
  const totalMtto=tMtto.reduce((s,m)=>s+(+m.mano_obra||0)+(+m.refacciones||0),0)
  const totalMO=tMtto.reduce((s,m)=>s+(+m.mano_obra||0),0)
  const totalRef=tMtto.reduce((s,m)=>s+(+m.refacciones||0),0)
  const lts_hr=totalHrs>0?(totalLts/totalHrs).toFixed(2):'-'
  const lts_ha=totalHas>0?(totalLts/totalHas).toFixed(2):'-'
  const eColor={Completado:'success','En proceso':'warning',Pendiente:'info',Cancelado:'danger'}
  const tColor={Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}
  const exportCSV=()=>{
    const rows=[
      ['DIESEL'],
      ['Fecha','Actividad','Litros','Horas','Hectáreas','Lts/Hr','Lts/Ha','Operador','Turno'],
      ...tDiesel.map(r=>[r.fecha,r.actividad,r.litros||0,r.horas||0,r.hectareas||0,r.horas>0?(r.litros/r.horas).toFixed(1):'',r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'',r.operador||'',r.turno||'']),
      [],[`Total lts: ${totalLts}`,`Total hrs: ${totalHrs.toFixed(1)}`,`Lts/hr: ${lts_hr}`,`Lts/ha: ${lts_ha}`],
      [],['MANTENIMIENTOS'],
      ['Fecha','Tipo','Descripción','Mano de obra','Refacciones','Total','Técnico','Estado'],
      ...tMtto.map(m=>[m.fecha,m.tipo,`"${m.descripcion}"`,m.mano_obra||0,m.refacciones||0,(+m.mano_obra||0)+(+m.refacciones||0),m.tecnico||'',m.estado]),
      [],[`Total mantenimientos: $${totalMtto.toLocaleString()}`],
    ]
    const csv=rows.map(r=>r.join(',')).join('\n')
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download=`historial_${tractor.id}_${new Date().toISOString().split('T')[0]}.csv`;a.click()
    URL.revokeObjectURL(url)
  }
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,overflowY:'auto',padding:'20px 12px'}}>
    <div style={{maxWidth:960,margin:'0 auto',background:'var(--bg2)',borderRadius:14,overflow:'hidden',boxShadow:'0 8px 40px rgba(0,0,0,0.22)'}}>
      {/* Header */}
      <div style={{background:'var(--bg)',padding:'20px 24px',borderBottom:'0.5px solid var(--border)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:4}}>
              <h2 style={{fontSize:20,fontWeight:700,margin:0}}>{tractor.id}</h2>
              <Badge color={tractor.activo?'success':'gray'}>{tractor.activo?'Activo':'Inactivo'}</Badge>
            </div>
            <p style={{margin:'0 0 2px',fontSize:13,color:'var(--text2)'}}>
              {tractor.marca&&`${tractor.marca} ${tractor.modelo||''}`}{tractor.año&&` · ${tractor.año}`}
              {tractor.campo&&` · Campo ${tractor.campo}`}
              {tractor.operador&&` · 👤 ${tractor.operador}`}
            </p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button onClick={()=>window.print()} style={{padding:'8px 16px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>🖨️ Imprimir</button>
            <button onClick={exportCSV} style={{padding:'8px 16px',borderRadius:8,background:'#1D9E75',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>📥 Exportar CSV</button>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:8,background:'none',border:'0.5px solid var(--border2)',fontSize:13,cursor:'pointer',color:'var(--text2)'}}>✕ Cerrar</button>
          </div>
        </div>
        {/* Totalizador */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
          <div style={{background:'#E1F5EE',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
            <p style={{fontSize:11,color:'#0F6E56',margin:'0 0 2px',fontWeight:500}}>Total diesel</p>
            <p style={{fontSize:18,fontWeight:700,color:'#1D9E75',margin:0}}>{totalLts.toLocaleString()} lts</p>
            <p style={{fontSize:10,color:'#1D9E75',margin:0}}>{tDiesel.length} registros</p>
          </div>
          <div style={{background:'#E6F1FB',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
            <p style={{fontSize:11,color:'#185FA5',margin:'0 0 2px',fontWeight:500}}>Rendimiento</p>
            <p style={{fontSize:18,fontWeight:700,color:'#378ADD',margin:0}}>{lts_hr} lts/hr</p>
            <p style={{fontSize:10,color:'#378ADD',margin:0}}>{lts_ha} lts/ha</p>
          </div>
          <div style={{background:'#FAEEDA',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
            <p style={{fontSize:11,color:'#854F0B',margin:'0 0 2px',fontWeight:500}}>Mantenimientos</p>
            <p style={{fontSize:18,fontWeight:700,color:'#BA7517',margin:0}}>${totalMtto.toLocaleString()}</p>
            <p style={{fontSize:10,color:'#BA7517',margin:0}}>{tMtto.length} registros</p>
          </div>
          <div style={{background:'#EEEDFE',borderRadius:8,padding:'10px 16px',flex:1,minWidth:120,textAlign:'center'}}>
            <p style={{fontSize:11,color:'#3C3489',margin:'0 0 2px',fontWeight:500}}>Horas trabajadas</p>
            <p style={{fontSize:18,fontWeight:700,color:'#534AB7',margin:0}}>{totalHrs.toFixed(0)} hrs</p>
            <p style={{fontSize:10,color:'#534AB7',margin:0}}>{totalHas.toFixed(1)} ha</p>
          </div>
        </div>
        {tMtto.length>0&&<div style={{display:'flex',gap:16,marginTop:10,fontSize:12,color:'var(--text2)'}}>
          <span>Mano de obra: <strong style={{color:'#1D9E75'}}>${totalMO.toLocaleString()}</strong></span>
          <span>Refacciones: <strong style={{color:'#D85A30'}}>${totalRef.toLocaleString()}</strong></span>
        </div>}
      </div>
      {/* Tabs */}
      <div style={{background:'var(--bg)',borderBottom:'0.5px solid var(--border)',display:'flex'}}>
        {[
          {id:'diesel',label:`⛽ Diesel (${tDiesel.length})`},
          {id:'mtto',label:`🔧 Mantenimientos (${tMtto.length})`},
          {id:'auth',label:`📋 Autorizaciones (${tAuth.length})`},
        ].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'11px 18px',background:'none',border:'none',borderBottom:tab===t.id?'2px solid #1D9E75':'2px solid transparent',color:tab===t.id?'#0F6E56':'var(--text2)',fontWeight:tab===t.id?600:400,fontSize:13,cursor:'pointer'}}>{t.label}</button>)}
      </div>
      {/* Content */}
      <div style={{padding:'20px 24px'}}>
        {/* DIESEL */}
        {tab==='diesel'&&(tDiesel.length===0?<EmptyState msg="Sin registros de diesel."/>:
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg2)'}}>
                {['Fecha','Actividad','Litros','Horas','Hect.','Lts/Hr','Lts/Ha','Operador','Turno'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',whiteSpace:'nowrap'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {tDiesel.map(r=>{
                  const lhr=r.horas>0?(r.litros/r.horas).toFixed(1):'-'
                  const lha=r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'-'
                  return <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
                    <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>{r.fecha}</td>
                    <td style={{padding:'7px 10px'}}>{r.actividad}</td>
                    <td style={{padding:'7px 10px',fontWeight:600,color:'#1D9E75'}}>{r.litros} lts</td>
                    <td style={{padding:'7px 10px'}}>{r.horas||'-'}</td>
                    <td style={{padding:'7px 10px'}}>{r.hectareas||'-'}</td>
                    <td style={{padding:'7px 10px',color:'#378ADD',fontWeight:500}}>{lhr}</td>
                    <td style={{padding:'7px 10px',color:'#534AB7',fontWeight:500}}>{lha}</td>
                    <td style={{padding:'7px 10px',color:'var(--text2)'}}>{r.operador||'-'}</td>
                    <td style={{padding:'7px 10px'}}>{r.turno||'-'}</td>
                  </tr>
                })}
                <tr style={{borderTop:'1.5px solid var(--border)',background:'var(--bg2)'}}>
                  <td colSpan={2} style={{padding:'7px 10px',fontWeight:600,fontSize:12}}>TOTALES</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:'#1D9E75'}}>{totalLts} lts</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:'#378ADD'}}>{totalHrs.toFixed(1)} hrs</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:'#534AB7'}}>{totalHas.toFixed(1)} ha</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:'#378ADD'}}>{lts_hr}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:'#534AB7'}}>{lts_ha}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* MANTENIMIENTOS */}
        {tab==='mtto'&&(tMtto.length===0?<EmptyState msg="Sin mantenimientos registrados."/>:
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {tMtto.map(m=><div key={m.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6,flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <Badge color={tColor[m.tipo]||'gray'}>{m.tipo}</Badge>
                  <Badge color={eColor[m.estado]||'gray'}>{m.estado}</Badge>
                  <span style={{fontSize:12,color:'var(--text3)'}}>{m.fecha}</span>
                </div>
                <strong style={{color:'#378ADD',fontSize:14}}>${((+m.mano_obra||0)+(+m.refacciones||0)).toLocaleString()}</strong>
              </div>
              <p style={{margin:'0 0 4px',fontSize:13,fontWeight:500}}>{m.descripcion}</p>
              {m.observaciones&&<p style={{margin:'0 0 6px',fontSize:12,color:'var(--text2)'}}>{m.observaciones}</p>}
              <div style={{display:'flex',gap:14,fontSize:12,color:'var(--text2)',flexWrap:'wrap'}}>
                {m.tecnico&&<span>🔧 {m.tecnico}</span>}
                <span>💵 M.O.: <strong style={{color:'#1D9E75'}}>${Number(m.mano_obra||0).toLocaleString()}</strong></span>
                <span>🔩 Ref.: <strong style={{color:'#D85A30'}}>${Number(m.refacciones||0).toLocaleString()}</strong></span>
              </div>
              {m.fotos?.length>0&&<div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                {m.fotos.map((url,i)=><img key={i} src={url} alt="" style={{width:64,height:50,objectFit:'cover',borderRadius:5,border:'0.5px solid var(--border)'}}/>)}
              </div>}
            </div>)}
            <div style={{background:'var(--bg2)',borderRadius:8,padding:'10px 14px',fontSize:13}}>
              Total mantenimientos: <strong style={{color:'#1D9E75'}}>${totalMtto.toLocaleString()}</strong>
              <span style={{margin:'0 12px',color:'var(--text3)'}}>·</span>
              M.O.: <strong>${totalMO.toLocaleString()}</strong>
              <span style={{margin:'0 12px',color:'var(--text3)'}}>·</span>
              Refacciones: <strong>${totalRef.toLocaleString()}</strong>
            </div>
          </div>
        )}
        {/* AUTORIZACIONES */}
        {tab==='auth'&&(tAuth.length===0?<EmptyState msg="Sin solicitudes de autorización."/>:
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {tAuth.map(a=><div key={a.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <Badge color={{Pendiente:'warning',Autorizado:'success',Rechazado:'danger'}[a.estado]||'gray'}>{a.estado}</Badge>
                  <span style={{fontSize:12,color:'var(--text3)'}}>{a.fecha} · Folio #{a.id}</span>
                </div>
                <strong style={{color:'#534AB7'}}>${Number(a.costo_estimado||0).toLocaleString()}</strong>
              </div>
              <p style={{margin:'0 0 4px',fontSize:13,fontWeight:500}}>{a.descripcion}</p>
              <div style={{fontSize:12,color:'var(--text2)'}}>🏭 {a.proveedor}{a.solicitante&&` · 👤 ${a.solicitante}`}</div>
              {a.comentarios_contraloria&&<p style={{margin:'6px 0 0',fontSize:12,color:'var(--text2)',fontStyle:'italic'}}>"{a.comentarios_contraloria}" — {a.autorizado_por}</p>}
            </div>)}
          </div>
        )}
      </div>
    </div>
  </div>
}

/* ── Códigos QR para tractores ── */
function QRCodes({tractores}){
  const [filterCampo,setFilterCampo]=useState('Todos')
  const BASE_URL=window.location.origin
  const rows=tractores.filter(t=>filterCampo==='Todos'||t.campo===filterCampo)
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div>
        <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 2px'}}>Códigos QR — Tractores</h2>
        <p style={{fontSize:12,color:'var(--text3)',margin:0}}>Escanea para abrir el registro de diesel con el tractor preseleccionado</p>
      </div>
      <button onClick={()=>window.print()} style={{padding:'8px 18px',borderRadius:8,background:'#378ADD',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}>🖨️ Imprimir todos</button>
    </div>
    <div style={{display:'flex',gap:10,marginBottom:16}}>
      <select value={filterCampo} onChange={e=>setFilterCampo(e.target.value)} style={{width:'auto',padding:'7px 12px'}}>
        <option>Todos</option>{CAMPOS.map(c=><option key={c}>{c}</option>)}
      </select>
      <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center'}}>{rows.length} tractores</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:16}}>
      {rows.map(t=>{
        const qrUrl=`${BASE_URL}?tractor=${t.id}&accion=diesel`
        const imgUrl=`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrUrl)}&margin=4`
        return <div key={t.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:16,textAlign:'center',pageBreakInside:'avoid'}}>
          <img src={imgUrl} alt={`QR ${t.id}`} width={140} height={140} style={{borderRadius:6,display:'block',margin:'0 auto'}}/>
          <div style={{marginTop:10}}>
            <p style={{fontWeight:700,fontSize:16,margin:'0 0 2px'}}>{t.id}</p>
            {t.marca&&<p style={{fontSize:11,color:'var(--text2)',margin:'0 0 2px'}}>{t.marca} {t.modelo}</p>}
            <p style={{fontSize:10,color:'var(--text3)',margin:0}}>{t.campo}</p>
          </div>
        </div>
      })}
    </div>
  </div>
}

/* ── Flotilla ── */
function Flotilla({tractores,setTractores,diesel,mtto,autorizaciones,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({id:'',campo:'MJ1',operador:'',marca:'',modelo:'',año:'',horometro:'',activo:true})
  const [fichaTractor,setFichaTractor]=useState(null)
  const handleSubmit=async()=>{
    if(!form.id){alert('El número económico es obligatorio');return}
    setSaving(true)
    const {data,error}=await supabase.from('tractores').insert([{...form,horometro:+form.horometro||null}]).select()
    if(error){alert('Error: '+error.message)}
    else{setTractores(t=>[...t,data[0]]);setShowForm(false);setForm({id:'',campo:'MJ1',operador:'',marca:'',modelo:'',año:'',horometro:'',activo:true})}
    setSaving(false)
  }
  const toggleActivo=async(id,activo)=>{
    await supabase.from('tractores').update({activo:!activo}).eq('id',id)
    setTractores(ts=>ts.map(t=>t.id===id?{...t,activo:!activo}:t))
  }
  const handleDelete=async(id)=>{
    if(!confirm('¿Eliminar este tractor?'))return
    await supabase.from('tractores').delete().eq('id',id)
    setTractores(ts=>ts.filter(t=>t.id!==id))
  }
  const byCampo=CAMPOS.reduce((m,c)=>{m[c]=tractores.filter(t=>t.campo===c);return m},{})
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Flotilla de tractores</h2>
      <Btn onClick={()=>setShowForm(true)} color="#534AB7">+ Agregar tractor</Btn>
    </div>
    {loading?<Spinner/>:<div style={{display:'flex',flexDirection:'column',gap:20}}>
      {CAMPOS.filter(c=>byCampo[c]?.length>0).map(campo=><div key={campo}>
        <p style={{fontSize:13,fontWeight:600,color:CAMPO_COLORS[campo]||'#888',marginBottom:10}}>{campo} <span style={{fontWeight:400,color:'var(--text3)',fontSize:12}}>({byCampo[campo].length} tractores)</span></p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
          {byCampo[campo].map(t=>{
            const tMttoCount=mtto.filter(m=>m.tractor_id===t.id).length
            const tCostMtto=mtto.filter(m=>m.tractor_id===t.id).reduce((s,m)=>s+(+m.mano_obra||0)+(+m.refacciones||0),0)
            const tLts=diesel.filter(r=>r.tractor_id===t.id).reduce((s,r)=>s+Number(r.litros||0),0)
            return <div key={t.id}
              onClick={()=>setFichaTractor(t)}
              style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px',opacity:t.activo?1:0.65,cursor:'pointer',transition:'box-shadow 0.15s,border-color 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)';e.currentTarget.style.borderColor='#1D9E75'}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:16,fontWeight:700}}>{t.id}</span>
                <Badge color={t.activo?'success':'gray'}>{t.activo?'Activo':'Inactivo'}</Badge>
              </div>
              {t.marca&&<p style={{margin:'0 0 2px',fontSize:12,color:'var(--text2)'}}>{t.marca} {t.modelo} {t.año&&`(${t.año})`}</p>}
              {t.operador&&<p style={{margin:'0 0 6px',fontSize:11,color:'var(--text3)'}}>👤 {t.operador}</p>}
              {tLts>0&&<div style={{marginBottom:6,padding:'3px 8px',background:'#E1F5EE',borderRadius:6,fontSize:11,color:'#0F6E56'}}>⛽ {tLts.toLocaleString()} lts registrados</div>}
              {tMttoCount>0&&<div style={{marginBottom:8,padding:'3px 8px',background:'#EAF3FB',borderRadius:6,fontSize:11,color:'#185FA5'}}>🔧 {tMttoCount} mtto{tMttoCount!==1?'s':''} · <strong>${tCostMtto.toLocaleString()}</strong></div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'#1D9E75',fontWeight:500}}>Ver historial →</span>
                <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>toggleActivo(t.id,t.activo)} style={{fontSize:10,padding:'2px 6px',borderRadius:5,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>{t.activo?'Desactivar':'Activar'}</button>
                  <button onClick={()=>handleDelete(t.id)} style={{fontSize:10,padding:'2px 6px',borderRadius:5,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'#A32D2D'}}>Eliminar</button>
                </div>
              </div>
            </div>
          })}
        </div>
      </div>)}
      {tractores.length===0&&<EmptyState msg="Sin tractores registrados. Agrega el primero."/>}
    </div>}
    {showForm&&<Modal title="Agregar tractor" onClose={()=>setShowForm(false)}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
        <Field label="N° económico *"><input type="text" placeholder="T-07" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/></Field>
        <Field label="Campo"><select value={form.campo} onChange={e=>setForm(f=>({...f,campo:e.target.value}))}>{CAMPOS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Marca"><input type="text" placeholder="John Deere / Case..." value={form.marca} onChange={e=>setForm(f=>({...f,marca:e.target.value}))}/></Field>
        <Field label="Modelo"><input type="text" placeholder="5085M" value={form.modelo} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))}/></Field>
        <Field label="Año"><input type="number" placeholder="2020" value={form.año} onChange={e=>setForm(f=>({...f,año:e.target.value}))}/></Field>
        <Field label="Horómetro inicial"><input type="number" placeholder="0" value={form.horometro} onChange={e=>setForm(f=>({...f,horometro:e.target.value}))}/></Field>
      </div>
      <Field label="Operador asignado"><input type="text" placeholder="Nombre del operador" value={form.operador} onChange={e=>setForm(f=>({...f,operador:e.target.value}))}/></Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
        <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn color="#534AB7" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Agregar tractor'}</Btn>
      </div>
    </Modal>}
    {fichaTractor&&<FichaTractor tractor={fichaTractor} diesel={diesel} mtto={mtto} autorizaciones={autorizaciones} onClose={()=>setFichaTractor(null)}/>}
  </div>
}

/* ── App Root ── */
export default function App(){
  const [page,setPage]=useState('dashboard')
  const [tractores,setTractores]=useState([])
  const [diesel,setDiesel]=useState([])
  const [mtto,setMtto]=useState([])
  const [autorizaciones,setAutorizaciones]=useState([])
  const [presupuestos,setPresupuestos]=useState([])
  const [loading,setLoading]=useState(true)
  const [dbError,setDbError]=useState(null)

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const [t,d,m,a,p]=await Promise.all([
        supabase.from('tractores').select('*').order('id'),
        supabase.from('diesel_registros').select('*').order('fecha',{ascending:false}),
        supabase.from('mantenimientos').select('*').order('fecha',{ascending:false}),
        supabase.from('autorizaciones_mtto').select('*').order('fecha',{ascending:false}),
        supabase.from('presupuesto_diesel').select('*'),
      ])
      if(t.error||d.error||m.error||a.error){setDbError('No se pudieron cargar los datos. Verifica que las tablas existan en Supabase.')}
      else{setTractores(t.data||[]);setDiesel(d.data||[]);setMtto(m.data||[]);setAutorizaciones(a.data||[]);setPresupuestos(p.error?[]:p.data||[])}
    }catch(e){setDbError('Error de conexión: '+e.message)}
    setLoading(false)
  },[])

  useEffect(()=>{loadAll()},[loadAll])

  if(dbError)return(
    <div style={{padding:40,maxWidth:600,margin:'0 auto'}}>
      <div style={{background:'#FCEBEB',border:'1px solid #F09595',borderRadius:12,padding:20}}>
        <h3 style={{color:'#A32D2D',margin:'0 0 8px'}}>⚠️ Error de base de datos</h3>
        <p style={{color:'#791F1F',margin:'0 0 12px',fontSize:14}}>{dbError}</p>
        <button onClick={()=>{setDbError(null);loadAll()}} style={{padding:'8px 18px',borderRadius:8,background:'#A32D2D',color:'#fff',border:'none',cursor:'pointer',fontSize:13}}>Reintentar</button>
      </div>
    </div>
  )

  return(
    <div style={{minHeight:'100vh'}}>
      <div style={{background:'var(--bg)',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 20px',display:'flex',alignItems:'center',gap:0}}>
          <div style={{padding:'12px 20px 12px 0',marginRight:20,borderRight:'0.5px solid var(--border)'}}>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:'var(--text)'}}>🚜 FlotillaMJ</p>
            <p style={{margin:0,fontSize:10,color:'var(--text3)'}}>Grupo Molina · Tractores Sonora</p>
          </div>
          <nav style={{display:'flex',overflowX:'auto'}}>
            {NAV.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{background:'none',border:'none',cursor:'pointer',padding:'14px 12px',fontSize:13,whiteSpace:'nowrap',borderBottom:page===n.id?'2px solid #1D9E75':'2px solid transparent',color:page===n.id?'#0F6E56':'var(--text2)',fontWeight:page===n.id?600:400}}>{n.emoji} {n.label}</button>)}
          </nav>
          <div style={{marginLeft:'auto',paddingLeft:16}}>
            <button onClick={loadAll} style={{background:'none',border:'0.5px solid var(--border2)',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'var(--text2)'}}>↻ Actualizar</button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 20px'}}>
        {page==='dashboard'      && <Dashboard diesel={diesel} tractores={tractores} mtto={mtto}/>}
        {page==='diesel'         && <Diesel diesel={diesel} setDiesel={setDiesel} tractores={tractores} presupuestos={presupuestos} loading={loading}/>}
        {page==='presupuesto'    && <Presupuesto tractores={tractores} diesel={diesel} presupuestos={presupuestos} setPresupuestos={setPresupuestos} loading={loading}/>}
        {page==='reporte'        && <ReporteDiesel diesel={diesel} tractores={tractores}/>}
        {page==='mtto'           && <Mantenimientos mtto={mtto} setMtto={setMtto} tractores={tractores} loading={loading}/>}
        {page==='autorizaciones' && <Autorizaciones autorizaciones={autorizaciones} setAutorizaciones={setAutorizaciones} tractores={tractores} loading={loading}/>}
        {page==='analisis'       && <Analisis diesel={diesel} tractores={tractores} mtto={mtto}/>}
        {page==='flotilla'       && <Flotilla tractores={tractores} setTractores={setTractores} diesel={diesel} mtto={mtto} autorizaciones={autorizaciones} loading={loading}/>}
        {page==='qrcodes'        && <QRCodes tractores={tractores}/>}
      </div>
    </div>
  )
}
