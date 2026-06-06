import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

/* ─── Constants ─── */
const CAMPOS = ['MJ1','MJ3','MJ4','MJ5','MJ6','MJ8','Don Roberto','La Navidad','Las Mercedes','Santa Maria','Los Vergeles']
const ACTIVIDADES = ['Aplicación','Rastrillo','Fumigación','Batanga','Transporte','Mantenimiento','Remolque','Otro']
const TIPOS_MTTO = ['Preventivo','Correctivo','Emergencia']
const COLORS = ['#1D9E75','#378ADD','#D85A30','#BA7517','#534AB7','#D4537E','#639922','#E24B4A']
const CAMPO_COLORS = {MJ1:'#1D9E75',MJ3:'#378ADD',MJ4:'#D85A30',MJ5:'#534AB7',MJ6:'#BA7517',MJ8:'#D4537E','Don Roberto':'#639922','La Navidad':'#0E7C86','Las Mercedes':'#A0522D','Santa Maria':'#C2185B','Los Vergeles':'#5C6BC0'}

const NAV = [
  {id:'dashboard', label:'Dashboard', emoji:'📊'},
  {id:'diesel',    label:'Diesel',    emoji:'⛽'},
  {id:'mtto',      label:'Mantenimientos', emoji:'🔧'},
  {id:'analisis',  label:'Análisis',  emoji:'📈'},
  {id:'flotilla',  label:'Flotilla',  emoji:'🚜'},
]

/* ─── UI Primitives ─── */
function Badge({color='info', children}){
  const map = {
    success:{bg:'#E1F5EE',c:'#0F6E56'},
    warning:{bg:'#FAEEDA',c:'#854F0B'},
    danger: {bg:'#FCEBEB',c:'#A32D2D'},
    info:   {bg:'#E6F1FB',c:'#185FA5'},
    gray:   {bg:'#F1EFE8',c:'#5F5E5A'},
    purple: {bg:'#EEEDFE',c:'#3C3489'},
  }
  const s = map[color]||map.info
  return <span style={{background:s.bg,color:s.c,fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:4,whiteSpace:'nowrap'}}>{children}</span>
}

function Stat({label,value,sub,color='#1D9E75'}){
  return(
    <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'14px 16px',flex:1,minWidth:130}}>
      <p style={{fontSize:11,color:'var(--text2)',margin:'0 0 4px'}}>{label}</p>
      <p style={{fontSize:22,fontWeight:600,margin:0,color}}>{value}</p>
      {sub&&<p style={{fontSize:11,color:'var(--text3)',margin:'2px 0 0'}}>{sub}</p>}
    </div>
  )
}

function Modal({title,onClose,children,wide}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div style={{background:'var(--bg)',borderRadius:14,padding:'20px 24px',width:'100%',maxWidth:wide?680:560,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:600}}>{title}</h3>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'var(--text2)',lineHeight:1,padding:'0 4px'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({label,children}){
  return(
    <div style={{marginBottom:12}}>
      {label&&<label style={{display:'block',fontSize:12,color:'var(--text2)',marginBottom:4,fontWeight:500}}>{label}</label>}
      {children}
    </div>
  )
}

function Btn({onClick,color='#1D9E75',outline,children,small,disabled}){
  const bg = outline?'transparent':color
  const border = outline?`1px solid ${color}`:1
  const textColor = outline?color:'#fff'
  return(
    <button onClick={onClick} disabled={disabled} style={{
      background:bg,color:textColor,border:`0.5px solid ${outline?color:'transparent'}`,
      borderRadius:8,padding:small?'5px 12px':'8px 18px',
      fontSize:small?12:13,fontWeight:500,opacity:disabled?0.5:1,
      transition:'opacity 0.15s'
    }}>{children}</button>
  )
}

function Spinner(){
  return <div style={{display:'flex',justifyContent:'center',padding:40,color:'var(--text3)',fontSize:13}}>Cargando...</div>
}

function EmptyState({msg}){
  return <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text3)',fontSize:13}}>🌾 {msg}</div>
}

/* ─── Dashboard ─── */
function Dashboard({diesel,tractores,mtto}){
  const totalLts = diesel.reduce((s,r)=>s+Number(r.litros),0)
  const totalHrs = diesel.reduce((s,r)=>s+Number(r.horas||0),0)
  const totalHas = diesel.reduce((s,r)=>s+Number(r.hectareas||0),0)
  const rendHr   = totalHrs>0?(totalLts/totalHrs).toFixed(1):'-'
  const rendHa   = totalHas>0?(totalLts/totalHas).toFixed(1):'-'
  const costMtto = mtto.reduce((s,m)=>s+Number(m.mano_obra||0)+Number(m.refacciones||0),0)

  const byTractor = useMemo(()=>{
    const m={}
    diesel.forEach(r=>{
      if(!m[r.tractor_id]) m[r.tractor_id]={litros:0,horas:0,hectareas:0}
      m[r.tractor_id].litros+=Number(r.litros)
      m[r.tractor_id].horas+=Number(r.horas||0)
      m[r.tractor_id].hectareas+=Number(r.hectareas||0)
    })
    return Object.entries(m).map(([id,d])=>({
      id, litros:d.litros,
      lts_hr:d.horas>0?+(d.litros/d.horas).toFixed(1):0,
      lts_ha:d.hectareas>0?+(d.litros/d.hectareas).toFixed(1):0,
    })).sort((a,b)=>b.litros-a.litros).slice(0,12)
  },[diesel])

  const byCampo = useMemo(()=>{
    const m={}
    diesel.forEach(r=>{if(!m[r.campo])m[r.campo]=0; m[r.campo]+=Number(r.litros)})
    return Object.entries(m).map(([campo,litros])=>({campo,litros}))
  },[diesel])

  const byAct = useMemo(()=>{
    const m={}
    diesel.forEach(r=>{if(!m[r.actividad])m[r.actividad]=0; m[r.actividad]+=Number(r.litros)})
    return Object.entries(m).map(([name,value])=>({name,value}))
  },[diesel])

  const tendencia = useMemo(()=>{
    const m={}
    diesel.forEach(r=>{
      const k=`Sem ${r.semana}`
      if(!m[k]) m[k]={semana:k,litros:0,horas:0,n:r.semana}
      m[k].litros+=Number(r.litros)
      m[k].horas+=Number(r.horas||0)
    })
    return Object.values(m).sort((a,b)=>a.n-b.n)
  },[diesel])

  if(diesel.length===0) return(
    <div>
      <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 20px'}}>Dashboard general</h2>
      <EmptyState msg="Sin datos aún. Registra consumo de diesel para ver el análisis." />
    </div>
  )

  return(
    <div>
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
              <XAxis type="number" tick={{fontSize:11}}/>
              <YAxis dataKey="id" type="category" tick={{fontSize:11}} width={42}/>
              <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/>
              <Bar dataKey="litros" fill="#1D9E75" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Rendimiento lts/hr por tractor">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byTractor} layout="vertical" margin={{left:20,right:20,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis type="number" tick={{fontSize:11}}/>
              <YAxis dataKey="id" type="category" tick={{fontSize:11}} width={42}/>
              <Tooltip formatter={v=>[`${v} lts/hr`,'Rend.']}/>
              <Bar dataKey="lts_hr" fill="#378ADD" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:16,marginBottom:16}}>
        <Card title="Tendencia semanal">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
              <XAxis dataKey="semana" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Legend/>
              <Line type="monotone" dataKey="litros" stroke="#1D9E75" strokeWidth={2} dot={{r:3}} name="Litros"/>
              <Line type="monotone" dataKey="horas"  stroke="#378ADD" strokeWidth={2} dot={{r:3}} name="Horas"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Consumo por actividad">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byAct} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                label={({name,percent})=>`${name.substring(0,6)} ${(percent*100).toFixed(0)}%`}
                labelLine={false} fontSize={10}>
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
            <XAxis dataKey="campo" tick={{fontSize:12}}/>
            <YAxis tick={{fontSize:11}}/>
            <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/>
            <Bar dataKey="litros" radius={[4,4,0,0]}>
              {byCampo.map(e=><Cell key={e.campo} fill={CAMPO_COLORS[e.campo]||'#1D9E75'}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function Card({title,children}){
  return(
    <div style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
      {title&&<p style={{margin:'0 0 12px',fontSize:13,fontWeight:600,color:'var(--text)'}}>{title}</p>}
      {children}
    </div>
  )
}

/* ─── Diesel ─── */
function Diesel({diesel,setDiesel,tractores,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterCampo,setFilterCampo]=useState('Todos')
  const [filterTractor,setFilterTractor]=useState('Todos')
  const [form,setForm]=useState({
    fecha:new Date().toISOString().split('T')[0],
    tractor_id:'',campo:'',actividad:'',
    litros:'',horas:'',hectareas:'',
    operador:'',semana:'',turno:'DIA',
  })

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

  return(
    <div>
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
      {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin registros. Agrega el primer consumo de diesel."/>:(
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{borderBottom:'0.5px solid var(--border)'}}>
                {['Fecha','Tractor','Campo','Actividad','Litros','Horas','Hect.','Lts/Hr','Lts/Ha','Operador',''].map(h=>(
                  <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'var(--text2)',fontSize:12,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>{
                const lhr=r.horas>0?(r.litros/r.horas).toFixed(1):'-'
                const lha=r.hectareas>0?(r.litros/r.hectareas).toFixed(1):'-'
                return(
                  <tr key={r.id} style={{borderBottom:'0.5px solid var(--border)'}}>
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
                    <td style={{padding:'8px 10px'}}>
                      <button onClick={()=>handleDelete(r.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm&&(
        <Modal title="Nuevo registro de diesel" onClose={()=>setShowForm(false)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
            <Field label="Semana #"><input type="number" placeholder="19" value={form.semana} onChange={e=>setForm(f=>({...f,semana:e.target.value}))}/></Field>
            <Field label="Tractor">
              <select value={form.tractor_id} onChange={e=>{
                const t=tractores.find(x=>x.id===e.target.value)
                setForm(f=>({...f,tractor_id:e.target.value,campo:t?.campo||f.campo,operador:t?.operador||f.operador}))
              }}>
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
          {form.litros&&form.horas&&(
            <div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>
              <strong>Rendimiento calculado:</strong>{' '}
              <span style={{color:'#378ADD'}}>{(form.litros/form.horas).toFixed(1)} lts/hr</span>
              {form.hectareas>0&&<> · <span style={{color:'#534AB7'}}>{(form.litros/form.hectareas).toFixed(1)} lts/ha</span></>}
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}}>
            <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar registro'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ─── Mantenimientos ─── */
function Mantenimientos({mtto,setMtto,tractores,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [filterEstado,setFilterEstado]=useState('Todos')
  const [fotoPreviews,setFotoPreviews]=useState([])
  const [form,setForm]=useState({
    fecha:new Date().toISOString().split('T')[0],
    tractor_id:'',tipo:'Preventivo',descripcion:'',
    mano_obra:'',refacciones:'',tecnico:'',
    estado:'En proceso',observaciones:'',
  })

  const handleFotos=async(e)=>{
    const files=Array.from(e.target.files)
    const previews=files.map(f=>URL.createObjectURL(f))
    setFotoPreviews(p=>[...p,...previews])
  }

  const handleSubmit=async()=>{
    if(!form.tractor_id||!form.descripcion){alert('Tractor y descripción son obligatorios');return}
    setSaving(true)
    const row={...form,mano_obra:+form.mano_obra||0,refacciones:+form.refacciones||0,fotos:fotoPreviews}
    const {data,error}=await supabase.from('mantenimientos').insert([row]).select()
    if(error){alert('Error: '+error.message)}
    else{
      setMtto(m=>[data[0],...m])
      setShowForm(false)
      setFotoPreviews([])
      setForm({fecha:new Date().toISOString().split('T')[0],tractor_id:'',tipo:'Preventivo',descripcion:'',mano_obra:'',refacciones:'',tecnico:'',estado:'En proceso',observaciones:''})
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

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Mantenimientos</h2>
        <Btn onClick={()=>setShowForm(true)} color="#378ADD">+ Nuevo mantenimiento</Btn>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        {['Todos','En proceso','Completado','Pendiente','Cancelado'].map(e=>(
          <button key={e} onClick={()=>setFilterEstado(e)} style={{
            padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:500,
            border:filterEstado===e?'1.5px solid #378ADD':'0.5px solid var(--border)',
            background:filterEstado===e?'#E6F1FB':'transparent',
            color:filterEstado===e?'#185FA5':'var(--text2)'
          }}>{e}</button>
        ))}
      </div>

      {loading?<Spinner/>:rows.length===0?<EmptyState msg="Sin mantenimientos. Registra el primero."/>:(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {rows.map(m=>(
            <div key={m.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:16,fontWeight:700}}>{m.tractor_id}</span>
                  <Badge color={tipoColor[m.tipo]||'gray'}>{m.tipo}</Badge>
                  <Badge color={estadoColor[m.estado]||'gray'}>{m.estado}</Badge>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--text3)'}}>{m.fecha}</span>
                  <button onClick={()=>handleDelete(m.id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>🗑</button>
                </div>
              </div>
              <p style={{margin:'0 0 6px',fontSize:14,fontWeight:500}}>{m.descripcion}</p>
              {m.observaciones&&<p style={{margin:'0 0 8px',fontSize:13,color:'var(--text2)'}}>{m.observaciones}</p>}
              <div style={{display:'flex',gap:16,fontSize:13,color:'var(--text2)',flexWrap:'wrap'}}>
                {m.tecnico&&<span>🔧 <strong style={{color:'var(--text)'}}>{m.tecnico}</strong></span>}
                <span>💵 Mano de obra: <strong style={{color:'#1D9E75'}}>${Number(m.mano_obra).toLocaleString()}</strong></span>
                <span>🔩 Refacciones: <strong style={{color:'#D85A30'}}>${Number(m.refacciones).toLocaleString()}</strong></span>
                <span style={{fontWeight:600,color:'var(--text)'}}>Total: ${(Number(m.mano_obra)+Number(m.refacciones)).toLocaleString()}</span>
              </div>
              {m.fotos&&m.fotos.length>0&&(
                <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                  {m.fotos.map((url,i)=>(
                    <img key={i} src={url} alt={`Foto ${i+1}`} style={{width:80,height:60,objectFit:'cover',borderRadius:6,border:'0.5px solid var(--border)'}}/>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm&&(
        <Modal title="Nuevo mantenimiento" onClose={()=>setShowForm(false)} wide>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <Field label="Fecha"><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></Field>
            <Field label="Tractor *">
              <select value={form.tractor_id} onChange={e=>setForm(f=>({...f,tractor_id:e.target.value}))}>
                <option value="">Seleccionar...</option>
                {tractores.map(t=><option key={t.id} value={t.id}>{t.id} — {t.campo}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                {TIPOS_MTTO.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                {['En proceso','Completado','Pendiente','Cancelado'].map(s=><option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descripción del trabajo *">
            <textarea value={form.descripcion} rows={2} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} style={{resize:'vertical'}}/>
          </Field>
          <Field label="Técnico responsable">
            <input type="text" placeholder="Nombre del técnico" value={form.tecnico} onChange={e=>setForm(f=>({...f,tecnico:e.target.value}))}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <Field label="Mano de obra ($)"><input type="number" placeholder="0" value={form.mano_obra} onChange={e=>setForm(f=>({...f,mano_obra:e.target.value}))}/></Field>
            <Field label="Refacciones ($)"><input type="number" placeholder="0" value={form.refacciones} onChange={e=>setForm(f=>({...f,refacciones:e.target.value}))}/></Field>
          </div>
          {(form.mano_obra||form.refacciones)&&(
            <div style={{background:'var(--bg2)',borderRadius:8,padding:10,marginBottom:12,fontSize:13}}>
              Total estimado: <strong style={{color:'#1D9E75'}}>${((+form.mano_obra||0)+(+form.refacciones||0)).toLocaleString()}</strong>
            </div>
          )}
          <Field label="Observaciones">
            <textarea value={form.observaciones} rows={2} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} style={{resize:'vertical'}}/>
          </Field>
          <Field label="Fotos del trabajo realizado">
            <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'8px 16px',border:'1px dashed var(--border2)',borderRadius:8,cursor:'pointer',fontSize:13,color:'var(--text2)'}}>
              📷 Subir fotos
              <input type="file" accept="image/*" multiple onChange={handleFotos} style={{display:'none'}}/>
            </label>
            {fotoPreviews.length>0&&(
              <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                {fotoPreviews.map((url,i)=>(
                  <div key={i} style={{position:'relative'}}>
                    <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:6,border:'0.5px solid var(--border)'}}/>
                    <button onClick={()=>setFotoPreviews(p=>p.filter((_,j)=>j!==i))} style={{position:'absolute',top:-4,right:-4,background:'#E24B4A',color:'#fff',border:'none',borderRadius:'50%',width:16,height:16,fontSize:10,cursor:'pointer',lineHeight:1}}>×</button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}>
            <Btn outline color="#888" onClick={()=>setShowForm(false)}>Cancelar</Btn>
            <Btn color="#378ADD" onClick={handleSubmit} disabled={saving}>{saving?'Guardando...':'Guardar mantenimiento'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ─── Análisis ─── */
function Analisis({diesel,tractores,mtto}){
  const [selected,setSelected]=useState(null)

  const stats=useMemo(()=>tractores.map(t=>{
    const regs=diesel.filter(r=>r.tractor_id===t.id)
    const mttos=mtto.filter(m=>m.tractor_id===t.id)
    const lts=regs.reduce((s,r)=>s+Number(r.litros),0)
    const hrs=regs.reduce((s,r)=>s+Number(r.horas||0),0)
    const has=regs.reduce((s,r)=>s+Number(r.hectareas||0),0)
    const acts={}; regs.forEach(r=>{acts[r.actividad]=(acts[r.actividad]||0)+Number(r.litros)})
    const mainAct=Object.entries(acts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
    return{
      ...t,lts,hrs:+hrs.toFixed(1),has:+has.toFixed(1),
      lts_hr:hrs>0?+(lts/hrs).toFixed(1):0,
      lts_ha:has>0?+(lts/has).toFixed(1):0,
      mttoCount:mttos.length,
      costMtto:mttos.reduce((s,m)=>s+Number(m.mano_obra||0)+Number(m.refacciones||0),0),
      regs:regs.length,mainAct,
    }
  }).filter(t=>t.regs>0),[diesel,tractores,mtto])

  const catColor=v=>v===0?'gray':v<15?'success':v<25?'info':'warning'
  const catLabel=v=>v===0?'Sin datos':v<15?'Eficiente':v<25?'Normal':'Alto consumo'

  const sel=selected?stats.find(t=>t.id===selected):null
  const selDiesel=selected?diesel.filter(r=>r.tractor_id===selected):[]
  const selMtto=selected?mtto.filter(m=>m.tractor_id===selected):[]

  return(
    <div>
      <h2 style={{fontSize:18,fontWeight:600,margin:'0 0 16px'}}>Análisis por tractor</h2>
      {stats.length===0?<EmptyState msg="Sin datos suficientes para el análisis."/>:(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:12,marginBottom:20}}>
            {stats.map(t=>(
              <div key={t.id} onClick={()=>setSelected(selected===t.id?null:t.id)} style={{
                background:'var(--bg)',borderRadius:12,padding:'14px 16px',cursor:'pointer',
                border:selected===t.id?'2px solid #1D9E75':'0.5px solid var(--border)',
                transition:'border-color 0.15s'
              }}>
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
              </div>
            ))}
          </div>

          {sel&&(
            <Card title={`Detalle: ${sel.id} — ${sel.campo}`}>
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
                      <XAxis dataKey="fecha" tick={{fontSize:10}}/>
                      <YAxis tick={{fontSize:10}}/>
                      <Tooltip formatter={v=>[`${v} lts`,'Diesel']}/>
                      <Bar dataKey="lts" fill="#1D9E75" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p style={{fontSize:13,fontWeight:600,margin:'0 0 10px'}}>Mantenimientos</p>
                  {selMtto.length===0?<p style={{fontSize:13,color:'var(--text3)'}}>Sin mantenimientos registrados</p>:(
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {selMtto.map(m=>(
                        <div key={m.id} style={{fontSize:12,padding:'8px 10px',background:'var(--bg2)',borderRadius:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                            <span style={{fontWeight:600}}>{m.descripcion}</span>
                            <Badge color={{Preventivo:'info',Correctivo:'warning',Emergencia:'danger'}[m.tipo]||'gray'}>{m.tipo}</Badge>
                          </div>
                          <span style={{color:'var(--text2)'}}>{m.fecha} · <strong>${(Number(m.mano_obra)+Number(m.refacciones)).toLocaleString()}</strong></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Flotilla ─── */
function Flotilla({tractores,setTractores,loading}){
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({id:'',campo:'MJ1',operador:'',marca:'',modelo:'',año:'',horometro:'',activo:true})

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
    if(!confirm('¿Eliminar este tractor? Se perderán todos sus registros vinculados.'))return
    await supabase.from('tractores').delete().eq('id',id)
    setTractores(ts=>ts.filter(t=>t.id!==id))
  }

  const byCampo=CAMPOS.reduce((m,c)=>{m[c]=tractores.filter(t=>t.campo===c);return m},{})

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontSize:18,fontWeight:600,margin:0}}>Flotilla de tractores</h2>
        <Btn onClick={()=>setShowForm(true)} color="#534AB7">+ Agregar tractor</Btn>
      </div>
      {loading?<Spinner/>:(
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {CAMPOS.filter(c=>byCampo[c]?.length>0).map(campo=>(
            <div key={campo}>
              <p style={{fontSize:13,fontWeight:600,color:CAMPO_COLORS[campo]||'#888',marginBottom:10}}>
                {campo} <span style={{fontWeight:400,color:'var(--text3)',fontSize:12}}>({byCampo[campo].length} tractores)</span>
              </p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {byCampo[campo].map(t=>(
                  <div key={t.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'12px 14px',opacity:t.activo?1:0.55}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:16,fontWeight:700}}>{t.id}</span>
                      <Badge color={t.activo?'success':'gray'}>{t.activo?'Activo':'Inactivo'}</Badge>
                    </div>
                    {t.marca&&<p style={{margin:'0 0 2px',fontSize:12,color:'var(--text2)'}}>{t.marca} {t.modelo} {t.año&&`(${t.año})`}</p>}
                    {t.operador&&<p style={{margin:'0 0 8px',fontSize:12,color:'var(--text3)'}}>{t.operador}</p>}
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>toggleActivo(t.id,t.activo)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'var(--text2)'}}>
                        {t.activo?'Desactivar':'Activar'}
                      </button>
                      <button onClick={()=>handleDelete(t.id)} style={{fontSize:11,padding:'3px 8px',borderRadius:6,border:'0.5px solid var(--border2)',background:'none',cursor:'pointer',color:'#A32D2D'}}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tractores.length===0&&<EmptyState msg="Sin tractores registrados. Agrega el primero."/>}
        </div>
      )}

      {showForm&&(
        <Modal title="Agregar tractor" onClose={()=>setShowForm(false)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 12px'}}>
            <Field label="N° económico * (ej: T-07)"><input type="text" placeholder="T-07" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/></Field>
            <Field label="Campo asignado">
              <select value={form.campo} onChange={e=>setForm(f=>({...f,campo:e.target.value}))}>
                {CAMPOS.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
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
        </Modal>
      )}
    </div>
  )
}

/* ─── App Root ─── */
export default function App(){
  const [page,setPage]=useState('dashboard')
  const [tractores,setTractores]=useState([])
  const [diesel,setDiesel]=useState([])
  const [mtto,setMtto]=useState([])
  const [loading,setLoading]=useState(true)
  const [dbError,setDbError]=useState(null)

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const [t,d,m]=await Promise.all([
        supabase.from('tractores').select('*').order('id'),
        supabase.from('diesel_registros').select('*').order('fecha',{ascending:false}),
        supabase.from('mantenimientos').select('*').order('fecha',{ascending:false}),
      ])
      if(t.error||d.error||m.error){
        setDbError('No se pudieron cargar los datos. Verifica que las tablas existan en Supabase.')
      } else {
        setTractores(t.data||[])
        setDiesel(d.data||[])
        setMtto(m.data||[])
      }
    }catch(e){
      setDbError('Error de conexión: '+e.message)
    }
    setLoading(false)
  },[])

  useEffect(()=>{loadAll()},[loadAll])

  if(dbError) return(
    <div style={{padding:40,maxWidth:600,margin:'0 auto'}}>
      <div style={{background:'#FCEBEB',border:'1px solid #F09595',borderRadius:12,padding:20}}>
        <h3 style={{color:'#A32D2D',margin:'0 0 8px'}}>⚠️ Error de base de datos</h3>
        <p style={{color:'#791F1F',margin:'0 0 12px',fontSize:14}}>{dbError}</p>
        <p style={{color:'#791F1F',fontSize:13,margin:'0 0 16px'}}>
          Asegúrate de haber creado las 3 tablas en el SQL Editor de Supabase:<br/>
          <code style={{background:'rgba(0,0,0,0.08)',padding:'2px 6px',borderRadius:4}}>tractores</code>,{' '}
          <code style={{background:'rgba(0,0,0,0.08)',padding:'2px 6px',borderRadius:4}}>diesel_registros</code>,{' '}
          <code style={{background:'rgba(0,0,0,0.08)',padding:'2px 6px',borderRadius:4}}>mantenimientos</code>
        </p>
        <button onClick={()=>{setDbError(null);loadAll()}} style={{padding:'8px 18px',borderRadius:8,background:'#A32D2D',color:'#fff',border:'none',cursor:'pointer',fontSize:13}}>Reintentar</button>
      </div>
    </div>
  )

  return(
    <div style={{minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:'var(--bg)',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1140,margin:'0 auto',padding:'0 20px',display:'flex',alignItems:'center',gap:0}}>
          <div style={{padding:'12px 20px 12px 0',marginRight:20,borderRight:'0.5px solid var(--border)'}}>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:'var(--text)'}}>🚜 FlotillaMJ</p>
            <p style={{margin:0,fontSize:10,color:'var(--text3)'}}>Grupo Molina · Tractores Sonora</p>
          </div>
          <nav style={{display:'flex',overflowX:'auto'}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)} style={{
                background:'none',border:'none',cursor:'pointer',padding:'14px 14px',
                fontSize:13,whiteSpace:'nowrap',
                borderBottom:page===n.id?'2px solid #1D9E75':'2px solid transparent',
                color:page===n.id?'#0F6E56':'var(--text2)',
                fontWeight:page===n.id?600:400,
              }}>{n.emoji} {n.label}</button>
            ))}
          </nav>
          <div style={{marginLeft:'auto',paddingLeft:16}}>
            <button onClick={loadAll} style={{background:'none',border:'0.5px solid var(--border2)',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'var(--text2)'}}>↻ Actualizar</button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{maxWidth:1140,margin:'0 auto',padding:'24px 20px'}}>
        {page==='dashboard' && <Dashboard diesel={diesel} tractores={tractores} mtto={mtto}/>}
        {page==='diesel'    && <Diesel diesel={diesel} setDiesel={setDiesel} tractores={tractores} loading={loading}/>}
        {page==='mtto'      && <Mantenimientos mtto={mtto} setMtto={setMtto} tractores={tractores} loading={loading}/>}
        {page==='analisis'  && <Analisis diesel={diesel} tractores={tractores} mtto={mtto}/>}
        {page==='flotilla'  && <Flotilla tractores={tractores} setTractores={setTractores} loading={loading}/>}
      </div>
    </div>
  )
}
