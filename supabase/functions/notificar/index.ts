// ═══════════════════════════════════════════════════
// CIRCLLE — função "notificar" (Supabase Edge Function)
// Recebe um aviso do app, confere se quem pediu tem direito
// e manda a notificação para as pessoas certas.
//
// Segredos necessários (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:voce@email.com)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já fornece.
//
// Publicar com "Verify JWT" DESLIGADO: o lembrete diário chega do agendador
// do banco (pg_cron), sem login. A função confere sozinha quem chama:
// login do app (getUser) ou o segredo do agendador guardado no Vault.
// ═══════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
});

// Chaves VAPID: lidas na primeira notificação; sem elas, a função responde mas não envia
let vapidPronto = false;
function prepararVapid() {
  if (vapidPronto) return true;
  const publica = Deno.env.get('VAPID_PUBLIC_KEY');
  const privada = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publica || !privada) {
    console.error('Faltam os segredos VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY');
    return false;
  }
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@circlle.app', publica, privada);
  return (vapidPronto = true);
}

type Aviso = { titulo: string; corpo: string; url: string; tag?: string };
type Departamento = { id: string; nome: string; organizacao_id: string; ativo: boolean };

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
});
// "seg 23 nov · 19:00", igual ao app
const quando = (iso: string) => {
  const p = Object.fromEntries(fmtData.formatToParts(new Date(iso)).map((x) => [x.type, x.value.replace('.', '')]));
  return `${p.weekday} ${p.day} ${p.month} · ${p.hour}:${p.minute}`;
};
const ehUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ---------- Consultas ----------
async function departamento(id: string): Promise<Departamento | null> {
  const { data } = await banco.from('departamentos').select('id, nome, organizacao_id, ativo').eq('id', id).maybeSingle();
  return data;
}

async function coordenadores(dep: Departamento): Promise<string[]> {
  const [coords, admins] = await Promise.all([
    banco.from('membros_departamento').select('usuario_id')
      .eq('departamento_id', dep.id).eq('status', 'ativo').eq('papel', 'coordenador'),
    banco.from('membros_organizacao').select('usuario_id')
      .eq('organizacao_id', dep.organizacao_id).eq('papel', 'admin')
  ]);
  return [...new Set([...(coords.data ?? []), ...(admins.data ?? [])].map((m) => m.usuario_id))];
}

async function coordena(usuario: string, dep: Departamento) {
  return (await coordenadores(dep)).includes(usuario);
}

async function nomeDe(usuario: string) {
  const { data } = await banco.from('perfis').select('nome').eq('id', usuario).maybeSingle();
  return data?.nome ?? 'Alguém';
}

// ---------- Envio ----------
async function enviar(usuarios: string[], aviso: Aviso) {
  if (!usuarios.length || !prepararVapid()) return 0;
  const { data: inscricoes } = await banco.from('push_inscricoes')
    .select('id, endpoint, p256dh, auth').in('usuario_id', usuarios);

  let enviados = 0;
  const vencidas: string[] = [];
  await Promise.all((inscricoes ?? []).map(async (i) => {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify(aviso),
        { TTL: 60 * 60 * 24 }
      );
      enviados++;
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) vencidas.push(i.id); // aparelho desinstalou ou trocou
      else console.error('push falhou', status, (erro as Error).message);
    }
  }));
  if (vencidas.length) await banco.from('push_inscricoes').delete().in('id', vencidas);
  return enviados;
}

// ---------- Tipos de aviso ----------
// Cada um confere a permissão de quem chamou e devolve [destinatários, aviso]
type Pedido = Record<string, unknown>;
type Plano = Array<[string[], Aviso]>;

const tipos: Record<string, (eu: string, p: Pedido) => Promise<Plano>> = {
  // Coordenador abriu datas: avisa os membros do departamento
  async datas_abertas(eu, p) {
    if (!ehUuid(p.departamento_id)) throw new Error('Pedido inválido');
    const dep = await departamento(p.departamento_id);
    if (!dep?.ativo || !(await coordena(eu, dep))) throw new Error('Sem permissão');
    const qtd = Math.max(1, Math.min(Number(p.quantidade) || 1, 99));
    const { data } = await banco.from('membros_departamento').select('usuario_id')
      .eq('departamento_id', dep.id).eq('status', 'ativo');
    return [[
      (data ?? []).map((m) => m.usuario_id).filter((id) => id !== eu),
      {
        titulo: `${dep.nome}: ${qtd === 1 ? 'nova data aberta' : `${qtd} datas abertas`}`,
        corpo: 'Marque em quais você pode.',
        url: '/#/calendario',
        tag: `datas-${dep.id}`
      }
    ]];
  },

  // Prévia enviada ou escala publicada (uma data ou o mês inteiro)
  async escala(eu, p) {
    const ids = Array.isArray(p.eventos) ? p.eventos.filter(ehUuid).slice(0, 60) : [];
    if (!ids.length) throw new Error('Pedido inválido');
    const { data: eventos } = await banco.from('eventos')
      .select('id, titulo, inicio, status, departamento_id, escalas(usuario_id)').in('id', ids);
    if (!eventos?.length) return [];

    const dep = await departamento(eventos[0].departamento_id);
    if (!dep || eventos.some((e) => e.departamento_id !== dep.id) || !(await coordena(eu, dep))) {
      throw new Error('Sem permissão');
    }

    // Agrupa por pessoa: quem está em uma data só recebe o aviso dessa data
    const porPessoa = new Map<string, typeof eventos>();
    for (const e of eventos.filter((e) => ['previa', 'publicado'].includes(e.status))) {
      for (const s of e.escalas ?? []) {
        if (s.usuario_id === eu) continue;
        if (!porPessoa.has(s.usuario_id)) porPessoa.set(s.usuario_id, []);
        porPessoa.get(s.usuario_id)!.push(e);
      }
    }

    const plano: Plano = [];
    for (const [usuario, lista] of porPessoa) {
      const previa = lista.every((e) => e.status === 'previa');
      const [e] = lista;
      plano.push([[usuario], lista.length === 1
        ? {
            titulo: previa ? `Prévia: ${e.titulo}` : `Você está na escala: ${e.titulo}`,
            corpo: `${quando(e.inicio)} · ${dep.nome}. ${previa ? 'Confira e diga se está tudo certo.' : 'Confirme sua presença.'}`,
            url: `/#/evento/${e.id}`,
            tag: `escala-${e.id}`
          }
        : {
            titulo: previa ? `Prévia da escala de ${dep.nome}` : `Escala de ${dep.nome} publicada`,
            corpo: `Você está em ${lista.length} datas. ${previa ? 'Confira e diga se está tudo certo.' : 'Confirme sua presença.'}`,
            url: '/#/calendario',
            tag: `escala-mes-${dep.id}`
          }]);
    }
    return plano;
  },

  // Coordenador mudou uma escala já enviada: avisa quem entrou ou teve a função trocada
  async escala_alterada(eu, p) {
    if (!ehUuid(p.evento_id)) throw new Error('Pedido inválido');
    const pedidos = Array.isArray(p.usuarios) ? p.usuarios.filter(ehUuid) : [];
    const { data: e } = await banco.from('eventos')
      .select('id, titulo, inicio, status, departamento_id, escalas(usuario_id)').eq('id', p.evento_id).maybeSingle();
    if (!e) return [];
    const dep = await departamento(e.departamento_id);
    if (!dep || !(await coordena(eu, dep))) throw new Error('Sem permissão');
    if (!['previa', 'publicado'].includes(e.status)) return [];
    const naEscala = new Set((e.escalas ?? []).map((s) => s.usuario_id));
    return [[
      pedidos.filter((id) => naEscala.has(id) && id !== eu),
      {
        titulo: `Sua escala mudou: ${e.titulo}`,
        corpo: `${quando(e.inicio)} · ${dep.nome}. Confira o que você faz e confirme.`,
        url: `/#/evento/${e.id}`,
        tag: `escala-${e.id}`
      }
    ]];
  },

  // Alguém pediu para entrar: avisa a coordenação
  async pedido_entrada(eu, p) {
    if (!ehUuid(p.departamento_id)) throw new Error('Pedido inválido');
    const dep = await departamento(p.departamento_id);
    if (!dep) return [];
    const { data: pedido } = await banco.from('membros_departamento').select('status')
      .eq('departamento_id', dep.id).eq('usuario_id', eu).maybeSingle();
    if (pedido?.status !== 'pendente') throw new Error('Sem permissão');
    return [[
      await coordenadores(dep),
      {
        titulo: `Pedido para entrar em ${dep.nome}`,
        corpo: `${await nomeDe(eu)} quer participar. Toque para aprovar.`,
        url: `/#/dep/${dep.id}`,
        tag: `pedidos-${dep.id}`
      }
    ]];
  },

  // Coordenador aprovou: avisa a pessoa
  async entrada_aprovada(eu, p) {
    if (!ehUuid(p.departamento_id) || !ehUuid(p.usuario_id)) throw new Error('Pedido inválido');
    const dep = await departamento(p.departamento_id);
    if (!dep || !(await coordena(eu, dep))) throw new Error('Sem permissão');
    const { data: membro } = await banco.from('membros_departamento').select('status')
      .eq('departamento_id', dep.id).eq('usuario_id', p.usuario_id).maybeSingle();
    if (membro?.status !== 'ativo') return [];
    return [[
      [p.usuario_id],
      { titulo: `Você entrou em ${dep.nome}!`, corpo: 'Agora as datas abertas aparecem para você.', url: '/#/' }
    ]];
  },

  // Escalado pediu ajuste ou avisou que não vai: avisa a coordenação
  async ajuste(eu, p) {
    if (!ehUuid(p.evento_id)) throw new Error('Pedido inválido');
    const { data: s } = await banco.from('escalas')
      .select('resposta, motivo, eventos(id, titulo, inicio, status, departamento_id)')
      .eq('evento_id', p.evento_id).eq('usuario_id', eu).maybeSingle();
    const e = s?.eventos as unknown as { id: string; titulo: string; inicio: string; status: string; departamento_id: string } | null;
    if (s?.resposta !== 'ajuste' || !e) throw new Error('Sem permissão');
    const dep = await departamento(e.departamento_id);
    if (!dep) return [];
    const nome = await nomeDe(eu);
    return [[
      (await coordenadores(dep)).filter((id) => id !== eu),
      {
        titulo: e.status === 'previa' ? `${nome} pediu ajuste` : `${nome} não vai poder`,
        corpo: `${e.titulo} · ${quando(e.inicio)}: “${String(s.motivo ?? '').slice(0, 120)}”`,
        url: `/#/evento/${e.id}`
      }
    ]];
  }
};

// ---------- Lembrete na véspera (agendador do banco, todo dia às 18h) ----------
async function lembreteVespera() {
  // "Amanhã" no horário de Brasília (sem horário de verão desde 2019)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const inicio = new Date(`${hoje}T00:00:00-03:00`);
  inicio.setUTCDate(inicio.getUTCDate() + 1);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const { data: eventos } = await banco.from('eventos')
    .select('id, titulo, local, inicio, departamentos!inner(nome, ativo), escalas(usuario_id, resposta)')
    .eq('status', 'publicado').eq('departamentos.ativo', true)
    .gte('inicio', inicio.toISOString()).lt('inicio', fim.toISOString());

  let enviados = 0;
  for (const e of eventos ?? []) {
    const dep = e.departamentos as unknown as { nome: string };
    // Quem pediu ajuste ou avisou que não vai não recebe lembrete
    const quem = (e.escalas ?? []).filter((s) => s.resposta !== 'ajuste').map((s) => s.usuario_id);
    const hora = quando(e.inicio).split(' · ')[1];
    enviados += await enviar(quem, {
      titulo: `Amanhã: ${e.titulo}`,
      corpo: `${hora} · ${dep.nome}${e.local ? ` · ${e.local}` : ''}. Até lá!`,
      url: `/#/evento/${e.id}`,
      tag: `lembrete-${e.id}`
    });
  }
  return { eventos: eventos?.length ?? 0, enviados };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST' }, 405);

  // Chamada do agendador: confere o segredo guardado no Vault
  const segredo = req.headers.get('x-circlle-cron');
  if (segredo) {
    const { data: valido } = await banco.rpc('cron_valido', { p_segredo: segredo });
    if (!valido) return resposta({ erro: 'Sem permissão' }, 403);
    try {
      return resposta(await lembreteVespera());
    } catch (erro) {
      console.error(erro);
      return resposta({ erro: 'Falha no lembrete' }, 500);
    }
  }

  // Quem está pedindo (pelo login do app)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await banco.auth.getUser(token);
  if (!user) return resposta({ erro: 'Faça login' }, 401);

  let pedido: Pedido;
  try {
    pedido = await req.json();
  } catch {
    return resposta({ erro: 'Pedido inválido' }, 400);
  }
  const tipo = tipos[String(pedido.tipo)];
  if (!tipo) return resposta({ erro: 'Tipo desconhecido' }, 400);

  try {
    const plano = await tipo(user.id, pedido);
    let enviados = 0;
    for (const [usuarios, aviso] of plano) enviados += await enviar([...new Set(usuarios)], aviso);
    return resposta({ enviados });
  } catch (erro) {
    const msg = (erro as Error).message;
    const status = msg === 'Sem permissão' ? 403 : msg === 'Pedido inválido' ? 400 : 500;
    if (status === 500) console.error(erro);
    return resposta({ erro: msg }, status);
  }
});
