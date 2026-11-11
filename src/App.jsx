import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { QRCodeCanvas } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import { CalendarDays, Users, Ticket, ScanLine, Plus, LogOut, ArrowLeft, Copy, Download, CheckCircle2, XCircle, Clock3, Menu } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [events, setEvents] = useState([])
  const [activeEvent, setActiveEvent] = useState(null)
  const [guests, setGuests] = useState([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [eventForm, setEventForm] = useState({name:'', event_date:'', event_time:'', venue:'', description:''})
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const scannerRef = useRef(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false) })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadEvents(); else { setEvents([]); setActiveEvent(null); setGuests([]) } }, [session])
  useEffect(() => { if (activeEvent) loadGuests(activeEvent.id) }, [activeEvent])
  useEffect(() => {
    if (page !== 'scanner') return
    let scanner
    const start = async () => {
      try {
        scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: {width: 230, height: 230} },
          async decoded => {
            await scanner.pause(true)
            await validateCode(decoded)
            setTimeout(() => scanner.resume(), 1800)
          }, () => {})
      } catch (e) { setNotice('Não foi possível abrir a câmara. Verifique as permissões do navegador.') }
    }
    start()
    return () => { if (scanner?.isScanning) scanner.stop().catch(()=>{}); scannerRef.current = null }
  }, [page, activeEvent])

  async function loadEvents() {
    const {data,error} = await supabase.from('events').select('*').order('created_at',{ascending:false})
    if (error) setNotice(error.message); else setEvents(data || [])
  }
  async function loadGuests(eventId) {
    const {data,error} = await supabase.from('guests').select('*').eq('event_id',eventId).order('created_at',{ascending:false})
    if (error) setNotice(error.message); else setGuests(data || [])
  }
  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setNotice('')
    const fn = authMode === 'login' ? supabase.auth.signInWithPassword({email,password}) : supabase.auth.signUp({email,password})
    const {error} = await fn
    setBusy(false)
    setNotice(error ? error.message : (authMode === 'login' ? 'Sessão iniciada.' : 'Conta criada. Se solicitado, confirme o seu e-mail.'))
  }
  async function logout() { await supabase.auth.signOut(); setPage('dashboard') }
  async function createEvent(e) {
    e.preventDefault(); if (!eventForm.name.trim()) return
    setBusy(true)
    const {data,error} = await supabase.from('events').insert({...eventForm, owner_id:session.user.id}).select().single()
    setBusy(false)
    if (error) return setNotice(error.message)
    setEvents([data,...events]); setActiveEvent(data); setEventForm({name:'',event_date:'',event_time:'',venue:'',description:''}); setPage('guests')
  }
  async function addGuest(e) {
    e.preventDefault(); if (!guestName.trim() || !activeEvent) return
    setBusy(true)
    const {data,error} = await supabase.from('guests').insert({event_id:activeEvent.id, full_name:guestName.trim(), phone:guestPhone.trim() || null}).select().single()
    setBusy(false)
    if (error) return setNotice(error.message)
    setGuests([data,...guests]); setGuestName(''); setGuestPhone('')
  }
  async function validateCode(raw) {
    if (!activeEvent) { setScanResult({status:'error',message:'Seleccione primeiro um evento.'}); return }
    let token = raw.trim()
    try { if (token.startsWith('http')) token = new URL(token).searchParams.get('token') || token } catch {}
    const {data,error} = await supabase.rpc('validate_guest_entry',{p_event_id:activeEvent.id,p_token:token})
    if (error) { setScanResult({status:'error',message:'Falha na validação: '+error.message}); return }
    const result = Array.isArray(data) ? data[0] : data
    setScanResult({status:result?.status || 'error',message:result?.message || 'Resposta desconhecida.',name:result?.guest_name})
    loadGuests(activeEvent.id)
  }
  const stats = useMemo(()=>({total:guests.length, entered:guests.filter(g=>g.checked_in_at).length}),[guests])
  function inviteUrl(g) { return `${window.location.origin}/?token=${g.token}` }
  function downloadQr(g) {
    const canvas = document.getElementById(`qr-${g.id}`)
    if (!canvas) return
    const a=document.createElement('a'); a.download=`convite-${g.full_name.replace(/\s+/g,'-')}.png`; a.href=canvas.toDataURL('image/png'); a.click()
  }
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (token && session) { setPage('scanner'); }
  }, [session])

  if (!supabase) return <SetupScreen />
  if (loading) return <div className="center"><div className="loader"/>A carregar…</div>
  if (!session) return <main className="auth-shell"><section className="auth-card"><Brand/><p className="muted">Gestão simples de convites e entradas.</p><form onSubmit={authenticate} className="stack"><label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@email.com"/></label><label>Palavra-passe<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label><button className="primary wide" disabled={busy}>{busy?'A processar…':authMode==='login'?'Entrar':'Criar conta'}</button></form><button className="text-button" onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Ainda não tem conta? Criar conta':'Já tem conta? Entrar'}</button>{notice && <p className="notice">{notice}</p>}<p className="tiny muted">Ao criar conta, poderá ser necessário confirmar o endereço de e-mail.</p></section></main>

  return <div className="app-shell">
    <aside className="sidebar"><Brand/><div className="side-label">MENU PRINCIPAL</div>
      <NavButton active={page==='dashboard'} icon={<CalendarDays/>} onClick={()=>setPage('dashboard')}>Painel</NavButton>
      <NavButton active={page==='create'} icon={<Plus/>} onClick={()=>setPage('create')}>Criar evento</NavButton>
      <NavButton active={page==='guests'} icon={<Users/>} onClick={()=>activeEvent&&setPage('guests')} disabled={!activeEvent}>Convidados</NavButton>
      <NavButton active={page==='scanner'} icon={<ScanLine/>} onClick={()=>setPage('scanner')} disabled={!activeEvent}>Controlar entradas</NavButton>
      <div className="sidebar-bottom"><div className="user-email">{session.user.email}</div><button className="nav-button" onClick={logout}><LogOut size={17}/> Terminar sessão</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">MY GUEST / {pageLabel(page)}</span><h1>{pageTitle(page)}</h1></div><div className="top-actions">{activeEvent && <span className="event-chip">{activeEvent.name}</span>}<button className="avatar">{(session.user.email||'M')[0].toUpperCase()}</button></div></header>
      {notice && <div className="notice-bar">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      {page==='dashboard' && <section className="content">
        <div className="welcome"><div><h2>Os seus eventos, sob controlo.</h2><p>Crie eventos, organize convidados e valide entradas num só lugar.</p></div><button className="primary" onClick={()=>setPage('create')}><Plus size={17}/> Criar evento</button></div>
        <div className="stat-grid"><Stat icon={<CalendarDays/>} label="Eventos" value={events.length}/><Stat icon={<Ticket/>} label="Convidados" value={events.reduce((a,e)=>a+(Number(e.guest_count)||0),0)}/><Stat icon={<CheckCircle2/>} label="Eventos criados" value={events.length}/></div>
        <div className="panel"><div className="panel-head"><div><h3>Os meus eventos</h3><p>Seleccione um evento para gerir os convidados.</p></div><button className="secondary" onClick={()=>setPage('create')}><Plus size={16}/> Novo evento</button></div>
          {events.length===0?<Empty title="Ainda não tem eventos" text="Crie o primeiro evento para começar a adicionar convidados."/>:<div className="event-list">{events.map(ev=><button className="event-row" key={ev.id} onClick={()=>{setActiveEvent(ev);setPage('guests')}}><div className="event-icon"><CalendarDays/></div><div className="event-info"><b>{ev.name}</b><span>{ev.event_date||'Data por definir'} · {ev.venue||'Local por definir'}</span></div><span className="row-arrow">Ver convidados →</span></button>)}</div>}
        </div>
      </section>}
      {page==='create' && <section className="content narrow"><div className="panel"><h3>Informações do evento</h3><p className="muted">Preencha os dados principais. Poderá alterá-los posteriormente.</p><form className="stack" onSubmit={createEvent}><label>Nome do evento<input required value={eventForm.name} onChange={e=>setEventForm({...eventForm,name:e.target.value})} placeholder="Ex.: Casamento de Ana e Paulo"/></label><div className="two-col"><label>Data<input type="date" value={eventForm.event_date} onChange={e=>setEventForm({...eventForm,event_date:e.target.value})}/></label><label>Hora<input type="time" value={eventForm.event_time} onChange={e=>setEventForm({...eventForm,event_time:e.target.value})}/></label></div><label>Local<input value={eventForm.venue} onChange={e=>setEventForm({...eventForm,venue:e.target.value})} placeholder="Local do evento"/></label><label>Descrição<textarea rows="3" value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})} placeholder="Informações adicionais"/></label><div className="form-actions"><button type="button" className="secondary" onClick={()=>setPage('dashboard')}>Cancelar</button><button className="primary" disabled={busy}>{busy?'A guardar…':'Guardar evento'}</button></div></form></div></section>}
      {page==='guests' && <section className="content">
        {!activeEvent?<Empty title="Seleccione um evento" text="Volte ao painel e escolha um evento."/>:<><div className="stat-grid"><Stat icon={<Users/>} label="Convidados" value={stats.total}/><Stat icon={<CheckCircle2/>} label="Entradas realizadas" value={stats.entered}/><Stat icon={<Clock3/>} label="Por entrar" value={stats.total-stats.entered}/></div>
        <div className="guest-layout"><div className="panel"><h3>Adicionar convidado</h3><form className="stack" onSubmit={addGuest}><label>Nome completo<input required value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Nome do convidado"/></label><label>Telefone (opcional)<input value={guestPhone} onChange={e=>setGuestPhone(e.target.value)} placeholder="+244 9XX XXX XXX"/></label><button className="primary"><Plus size={16}/> Adicionar e gerar QR Code</button></form></div>
        <div className="panel"><div className="panel-head"><div><h3>Lista de convidados</h3><p>{activeEvent.name}</p></div><button className="secondary" onClick={()=>setPage('scanner')}><ScanLine size={16}/> Ler códigos</button></div>
          {guests.length===0?<Empty title="Lista vazia" text="Adicione o primeiro convidado."/>:<div className="guest-list">{guests.map(g=><div className="guest-row" key={g.id}><div className="guest-info"><b>{g.full_name}</b><span>{g.phone||'Sem telefone'} · {g.checked_in_at?'Entrada registada':'Pendente'}</span></div><div className="qr-mini"><QRCodeCanvas id={`qr-${g.id}`} value={inviteUrl(g)} size={76} level="M"/></div><div className="guest-actions"><button title="Copiar ligação" className="icon-button" onClick={()=>{navigator.clipboard.writeText(inviteUrl(g));setNotice('Ligação do convite copiada.')}}><Copy size={16}/></button><button title="Descarregar QR" className="icon-button" onClick={()=>downloadQr(g)}><Download size={16}/></button></div></div>)}</div>}
        </div></div></>}
      </section>}
      {page==='scanner' && <section className="content narrow"><div className="panel scanner-panel"><div className="scanner-heading"><div><h3>Leitura de convites</h3><p className="muted">Aponte a câmara para o QR Code do convidado.</p></div><span className="live-dot">LEITOR</span></div>{!activeEvent?<Empty title="Seleccione um evento" text="Escolha um evento no painel para iniciar a leitura."/>:<><div id="qr-reader" className="qr-reader"/><div className="manual-check"><p>Ou introduza o código/ligação manualmente:</p><form onSubmit={e=>{e.preventDefault();validateCode(e.currentTarget.elements.code.value);e.currentTarget.reset()}}><input name="code" placeholder="Código ou ligação do convite" required/><button className="primary">Validar</button></form></div></>}{scanResult && <div className={`scan-result ${scanResult.status==='valid'?'valid':scanResult.status==='used'?'used':'invalid'}`}><div className="result-icon">{scanResult.status==='valid'?<CheckCircle2/>:<XCircle/>}</div><div><b>{scanResult.message}</b>{scanResult.name&&<span>{scanResult.name}</span>}</div></div>}</div></section>}
      <footer>My Guest © {new Date().getFullYear()} · Gestão simples de eventos</footer>
    </main>
  </div>
}
function Brand(){return <div className="brand"><div className="brand-mark"><Ticket size={21}/></div><div><b>my guest<span>.</span></b><small>EVENT MANAGEMENT</small></div></div>}
function NavButton({active,icon,children,onClick,disabled}){return <button disabled={disabled} onClick={onClick} className={`nav-button ${active?'active':''}`}>{icon}{children}</button>}
function Stat({icon,label,value}){return <div className="stat-card"><div className="stat-icon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>}
function Empty({title,text}){return <div className="empty"><div className="empty-icon"><Ticket/></div><b>{title}</b><p>{text}</p></div>}
function SetupScreen(){return <main className="auth-shell"><section className="auth-card"><Brand/><h2>Configuração necessária</h2><p className="muted">Para iniciar o My Guest, configure as credenciais do Supabase.</p><ol className="setup-list"><li>Crie um projecto no Supabase.</li><li>Copie a URL e a chave anon/public.</li><li>Crie o ficheiro <code>.env</code> com base em <code>.env.example</code>.</li><li>Execute o SQL incluído em <code>supabase/schema.sql</code>.</li></ol></section></main>}
function pageTitle(p){return ({dashboard:'Painel principal',create:'Criar evento',guests:'Gestão de convidados',scanner:'Controlar entradas'})[p]||'My Guest'}
function pageLabel(p){return ({dashboard:'PAINEL',create:'EVENTOS',guests:'CONVIDADOS',scanner:'VALIDAÇÃO'})[p]||'PAINEL'}
export default App;
