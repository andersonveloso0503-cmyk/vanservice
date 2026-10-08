/* App Van Service — camada de dados real (Supabase).
   Mesma interface da demonstração: as telas leem VS.store.db e chamam os métodos, que devolvem Promises.
   Toda regra de quem pode o quê fica no banco (arquivo supabase/banco.sql); aqui só se chama as funções de lá. */
(function () {
  'use strict';
  var VS = window.VS = window.VS || {};
  var CFG = window.VS_CONFIG || {};
  var D = VS.datas;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function local(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return D.isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function arq(a) { return a && a.caminho ? { nome: a.nome, tipo: a.tipo, caminho: a.caminho, pasta: a.pasta } : null; }
  function vazio() {
    return { hoje: D.isoDate(new Date()), funcionarios: [], contratos: [], contas: [], contracheques: [], vt: [], solicitacoes: [], documentos: [], orcamentos: [], avisos: [] };
  }
  function porId(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }

  var euId = null;
  var baixados = {};

  // ---------- erros em português
  function traduz(e, padrao) {
    var msg = (e && e.message) || '';
    if (e && e.code === 'P0001' && msg) return new Error(msg); // mensagens escritas no banco
    if (/failed to fetch|networkerror|load failed|fetch/i.test(msg)) return new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    if (e && (e.code === '42501' || /permission denied/i.test(msg))) return new Error('Seu perfil não tem permissão para isso.');
    if (/jwt|token|not authenticated/i.test(msg)) return new Error('Sua sessão expirou. Entre de novo.');
    try { console.error('[Van Service]', e); } catch (x) { /* sem console */ }
    return new Error(padrao || 'Algo deu errado. Tente de novo.');
  }
  function rpc(nome, args) {
    return sb.rpc(nome, args || {}).then(function (r) { if (r.error) throw traduz(r.error); return r.data; }, function (e) { throw traduz(e); });
  }

  // ---------- leitura
  function aplicar(r) {
    var db = vazio();
    euId = r.eu;
    db.hoje = r.hoje || db.hoje;
    db.funcionarios = (r.funcionarios || []).map(function (f) {
      return { id: f.id, nome: f.nome, cpf: f.cpf, papel: f.papel, bloqueado: !!f.bloqueado, ativo: !!f.ativo, codigo: f.codigo || null,
        feriasSaldo: f.ferias_saldo || 0, feriasLimite: f.ferias_limite || '', avisosVistosEm: f.avisos_vistos_em || null };
    });
    db.contratos = (r.contratos || []).map(function (k) { return { id: k.id, nome: k.nome, ativo: !!k.ativo }; });
    db.contas = (r.contas || []).map(function (c) {
      return { id: c.id, descricao: c.descricao, valor: Number(c.valor), vencimento: c.vencimento, diaBase: c.dia_base, contratoId: c.contrato_id,
        recorrente: !!c.recorrente, anexo: arq(c.anexo), enviadoPor: c.enviado_por, enviadoPorNome: c.enviado_por_nome, enviadoEm: local(c.enviado_em),
        pagoEm: local(c.pago_em), pagoPor: c.pago_por, pagoPorNome: c.pago_por_nome, comprovante: arq(c.comprovante), geradaPor: c.gerada_por,
        tipo: c.tipo || 'conta', funcionarioId: c.funcionario_id || null, funcionarioNome: c.funcionario_nome || null, obs: c.obs || '',
        linha: c.linha_digitavel || '', pix: c.pix || '' };
    });
    db.pagamentos = (r.pagamentos || []).map(function (p) {
      return { id: p.id, descricao: p.descricao, obs: p.obs || '', valor: Number(p.valor), pagoEm: local(p.pago_em) };
    });
    db.contracheques = (r.contracheques || []).map(function (c) {
      return { id: c.id, funcionarioId: c.funcionario_id, mes: c.mes, arquivo: arq(c.arquivo), enviadoEm: local(c.enviado_em), confirmadoEm: local(c.confirmado_em) };
    });
    db.vt = (r.vt || []).map(function (v) { return { funcionarioId: v.funcionario_id, mes: v.mes, status: v.status, valor: v.valor == null ? null : Number(v.valor), em: local(v.em) }; });
    db.solicitacoes = (r.solicitacoes || []).map(function (s) {
      return { id: s.id, tipo: 'ferias', funcionarioId: s.funcionario_id, funcionarioNome: s.nome, inicio: s.inicio, dias: s.dias, obs: s.obs || '',
        status: s.status, criadoEm: local(s.criado_em), decididoPorNome: s.decidido_por_nome, decididoEm: local(s.decidido_em) };
    });
    db.documentos = (r.documentos || []).map(function (d) {
      return { id: d.id, funcionarioId: d.funcionario_id, funcionarioNome: d.nome, tipo: d.tipo, obs: d.obs || '', arquivo: arq(d.arquivo),
        criadoEm: local(d.criado_em), vistoEm: local(d.visto_em), vistoPorNome: d.visto_por_nome };
    });
    db.orcamentos = (r.orcamentos || []).map(function (o) {
      return { id: o.id, nome: o.nome, empresa: o.empresa || '', whatsapp: o.whatsapp, servico: o.servico, mensagem: o.mensagem || '', status: o.status, criadoEm: local(o.criado_em) };
    });
    db.avisos = (r.avisos || []).map(function (a) { return { id: a.id, texto: a.texto, em: local(a.em), quando: new Date(a.em).getTime() }; });
    S.db = db;
    S.mesAtual = db.hoje.slice(0, 7);
    return db;
  }
  function limpar() { euId = null; S.db = vazio(); }
  function recarregar() { return rpc('carregar').then(aplicar); }
  // Faz a mudança no servidor e busca tudo de novo, para a tela mostrar sempre o que está gravado.
  function mudar(nome, args) {
    return rpc(nome, args).then(function (v) { return recarregar().then(function () { return v; }); });
  }

  // ---------- arquivos
  function nomeSeguro(n) {
    return String(n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-60) || 'arquivo';
  }
  function idNovo() {
    return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  // Fotos de celular chegam com vários megabytes; reduz para caber no espaço e carregar rápido.
  function reduzir(a) {
    if (!a || !a.blob || !/^image\/(jpeg|png|webp)$/.test(a.tipo || '') || a.blob.size < 600 * 1024) return Promise.resolve(a);
    return new Promise(function (res) {
      var url = URL.createObjectURL(a.blob), img = new Image();
      img.onload = function () {
        try {
          var max = 1800, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(function (b) {
            URL.revokeObjectURL(url);
            if (!b || b.size >= a.blob.size) { res(a); return; }
            res({ nome: String(a.nome || 'foto').replace(/\.[A-Za-z0-9]+$/, '') + '.jpg', tipo: 'image/jpeg', blob: b });
          }, 'image/jpeg', 0.82);
        } catch (e) { URL.revokeObjectURL(url); res(a); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(a); };
      img.src = url;
    });
  }
  function enviar(pasta, caminhoDe, arquivo) {
    if (!arquivo || !arquivo.blob) return Promise.resolve(null);
    return reduzir(arquivo).then(function (a) {
      if (a.blob.size > 10 * 1024 * 1024) throw new Error('O arquivo "' + a.nome + '" passa de 10 MB. Envie um arquivo menor.');
      var caminho = caminhoDe(a);
      return sb.storage.from(pasta).upload(caminho, a.blob, { contentType: a.tipo || 'application/octet-stream', upsert: false }).then(function (r) {
        if (r.error) {
          var m = r.error.message || '';
          if (/mime|type/i.test(m)) throw new Error('Esse tipo de arquivo não é aceito. Envie foto (JPG ou PNG) ou PDF.');
          if (/size|large|exceed/i.test(m)) throw new Error('O arquivo é grande demais. O limite é 10 MB.');
          if (/security|policy|unauthorized|permission/i.test(m)) throw new Error('Seu perfil não tem permissão para enviar este arquivo.');
          throw traduz(r.error, 'Não consegui enviar o arquivo. Tente de novo.');
        }
        return { nome: a.nome, tipo: a.tipo, caminho: caminho };
      }, function (e) { throw traduz(e, 'Não consegui enviar o arquivo. Tente de novo.'); });
    });
  }
  function emPasta(prefixo) { return function (a) { return prefixo + '/' + idNovo() + '-' + nomeSeguro(a.nome); }; }
  // Envia vários arquivos, três por vez.
  function enviarVarios(tarefas) {
    var saida = [], i = 0;
    function proximo() {
      if (i >= tarefas.length) return Promise.resolve();
      var n = i; i += 1;
      return tarefas[n]().then(function (v) { saida[n] = v; return proximo(); });
    }
    return Promise.all([proximo(), proximo(), proximo()]).then(function () { return saida; });
  }

  function emailDe(cpf) { return VS.cpf.digits(cpf) + '@' + CFG.emailDominio; }
  function entrarDepoisDoLogin() {
    return recarregar().then(function () { return S.me(); }, function (e) {
      return sb.auth.signOut().then(function () {
        limpar();
        throw new Error(/Entre no app/.test(e.message) ? 'Seu acesso está bloqueado. Fale com o RH.' : e.message);
      });
    });
  }

  var S = VS.store = {
    demo: false,
    db: vazio(),
    mesAtual: D.isoDate(new Date()).slice(0, 7),
    porId: porId,
    me: function () { return euId ? porId(S.db.funcionarios, euId) : null; },
    recarregar: recarregar,

    // Ao abrir o app: se já havia alguém logado neste aparelho, entra direto.
    iniciar: function () {
      sb.auth.onAuthStateChange(function (evento) {
        if (evento === 'SIGNED_OUT' && euId) { limpar(); VS.state.rota = 'login'; VS.state.sheet = null; VS.render(); }
      });
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return null;
        return recarregar().then(null, function () { limpar(); return sb.auth.signOut().then(function () { return null; }, function () { return null; }); });
      });
    },

    // ----- acesso
    login: function (cpf, senha) {
      return sb.auth.signInWithPassword({ email: emailDe(cpf), password: senha }).then(function (r) {
        if (r.error) {
          if (/invalid login|invalid credentials|not confirmed/i.test(r.error.message || '') || r.error.status === 400) throw new Error('CPF ou senha incorretos.');
          throw traduz(r.error, 'Não consegui entrar. Tente de novo.');
        }
        return entrarDepoisDoLogin();
      });
    },
    primeiroAcesso: function (cpf, nome, codigo, senha) {
      if (String(senha).length < 8) return Promise.reject(new Error('A senha precisa ter pelo menos 8 caracteres.'));
      return sb.auth.signUp({ email: emailDe(cpf), password: senha, options: { data: { codigo: VS.limparCodigo(codigo), nome: String(nome || '').trim() } } }).then(function (r) {
        if (r.error) {
          var m = r.error.message || '';
          if (/already registered|already been registered|user already/i.test(m)) throw new Error('Este CPF já tem senha. Use "Entrar". Se esqueceu a senha ou não foi você quem criou, fale com o RH.');
          if (/password/i.test(m)) throw new Error('Escolha uma senha mais forte, com pelo menos 8 caracteres.');
          if (/failed to fetch|network/i.test(m)) throw traduz(r.error);
          if (/rate limit|too many/i.test(m)) throw new Error('Muitas tentativas seguidas. Espere alguns minutos e tente de novo.');
          throw new Error('CPF ou nome não conferem com o cadastro. Digite o nome como está no contracheque. Se continuar sem dar certo, fale com o RH.');
        }
        if (!r.data || !r.data.session) throw new Error('O servidor ainda pede confirmação por e-mail. Avise o administrador do app.');
        return entrarDepoisDoLogin();
      });
    },
    sair: function () { return sb.auth.signOut().then(limpar, limpar); },
    trocarSenha: function (atual, nova) {
      var u = S.me();
      if (!u) return Promise.reject(new Error('Entre no app para continuar.'));
      if (String(nova).length < 8) return Promise.reject(new Error('A nova senha precisa ter pelo menos 8 caracteres.'));
      return sb.auth.signInWithPassword({ email: emailDe(u.cpf), password: atual }).then(function (r) {
        if (r.error) throw new Error('A senha atual não confere.');
        return sb.auth.updateUser({ password: nova });
      }).then(function (r) {
        if (r.error) throw traduz(r.error, 'Não consegui trocar a senha. Tente de novo.');
      });
    },

    // ----- contas a pagar
    addConta: function (d) {
      return enviar('anexos', emPasta('contas'), d.anexo).then(function (a) {
        return mudar('conta_criar', { p: { descricao: d.descricao, valor: d.valor, vencimento: d.vencimento, contrato_id: d.contratoId, recorrente: !!d.recorrente, anexo: a,
          tipo: d.tipo === 'extra' ? 'extra' : 'conta', funcionario_id: d.funcionarioId || '', obs: d.obs || '', linha: d.linha || '', pix: d.pix || '' } });
      });
    },
    excluirConta: function (id) { return mudar('conta_excluir', { p_id: id }); },
    pagarConta: function (id, comprovante) {
      return enviar('anexos', emPasta('contas'), comprovante).then(function (a) {
        return mudar('conta_pagar', { p_id: id, p_comprovante: a });
      }).then(function (r) { return { proxima: r && r.proxima ? { vencimento: r.proxima } : null }; });
    },
    desfazerPagamento: function (id) { return mudar('conta_desfazer', { p_id: id }); },

    // ----- contratos
    addContrato: function (nome) { return mudar('contrato_criar', { p_nome: nome }); },
    setContratoAtivo: function (id, ativo) { return mudar('contrato_ativar', { p_id: id, p_ativo: !!ativo }); },

    // ----- funcionários
    importarFuncionarios: function (linhas, bloquearAusentes) {
      return mudar('funcionarios_importar', { p_linhas: linhas.map(function (l) { return { nome: l.nome, cpf: l.cpf }; }), p_bloquear: !!bloquearAusentes });
    },
    atualizarFuncionario: function (id, patch) {
      var p = {};
      if ('papel' in patch) p.papel = patch.papel;
      if ('bloqueado' in patch) p.bloqueado = !!patch.bloqueado;
      if ('feriasSaldo' in patch) p.ferias_saldo = String(patch.feriasSaldo == null ? '' : patch.feriasSaldo);
      if ('feriasLimite' in patch) p.ferias_limite = patch.feriasLimite || '';
      return mudar('funcionario_atualizar', { p_id: id, p: p });
    },
    novoCodigo: function (id) { return mudar('funcionario_novo_codigo', { p_id: id }); },
    publicarVT: function (mes, itens) {
      return mudar('vt_importar', { p_mes: mes, p_itens: itens.map(function (it) { return { funcionario_id: it.funcionarioId, valor: it.valor == null ? '' : String(it.valor) }; }) });
    },
    setVT: function (funcId, mes, status) { return mudar('vt_definir', { p_funcionario: funcId, p_mes: mes, p_status: status }); },

    // ----- contracheques
    publicarContracheques: function (mes, itens) {
      if (!/^\d{4}-\d{2}$/.test(mes || '')) return Promise.reject(new Error('Escolha o mês dos contracheques.'));
      var tarefas = itens.map(function (it) {
        return function () {
          return enviar('contracheques', function () { return it.funcionarioId + '/' + mes + '-' + idNovo() + '.pdf'; }, it.arquivo).then(function (a) {
            return { funcionario_id: it.funcionarioId, arquivo: a };
          });
        };
      });
      return enviarVarios(tarefas).then(function (lista) { return mudar('contracheques_publicar', { p_mes: mes, p_itens: lista }); });
    },
    confirmarContracheque: function (id) { return mudar('contracheque_confirmar', { p_id: id }); },

    // ----- férias e documentos
    pedirFerias: function (d) {
      var dias = parseInt(d.dias, 10);
      return mudar('ferias_pedir', { p_inicio: /^\d{4}-\d{2}-\d{2}$/.test(d.inicio || '') ? d.inicio : null, p_dias: isFinite(dias) ? dias : null, p_obs: d.obs || '' });
    },
    decidirSolicitacao: function (id, status) { return mudar('solicitacao_decidir', { p_id: id, p_status: status }); },
    enviarDocumento: function (d) {
      if (!d.arquivo) return Promise.reject(new Error('Anexe a foto ou o PDF do documento.'));
      return enviar('documentos', emPasta(euId), d.arquivo).then(function (a) {
        return mudar('documento_enviar', { p_tipo: d.tipo || 'Documento', p_obs: d.obs || '', p_arquivo: a });
      });
    },
    marcarDocumentoVisto: function (id) { return mudar('documento_visto', { p_id: id }); },

    // ----- orçamentos
    pedirOrcamento: function (d) {
      return rpc('orcamento_pedir', { p: { nome: d.nome || '', empresa: d.empresa || '', whatsapp: d.whatsapp || '', servico: d.servico || '', mensagem: d.mensagem || '' } });
    },
    setStatusOrcamento: function (id, status) { return mudar('orcamento_status', { p_id: id, p_status: status }); },

    meusPagamentos: function () { return S.db.pagamentos || []; },

    // ----- avisos
    meusAvisos: function () {
      var u = S.me();
      var visto = u && u.avisosVistosEm ? new Date(u.avisosVistosEm).getTime() : 0;
      return S.db.avisos.map(function (a) { return { id: a.id, texto: a.texto, em: a.em, lido: a.quando <= visto }; });
    },
    marcarAvisosLidos: function () {
      var u = S.me();
      if (u) u.avisosVistosEm = new Date().toISOString();
      return rpc('avisos_lidos').then(null, function () { /* tenta de novo na próxima vez */ });
    },

    // ----- arquivos: baixa do servidor só quando a pessoa pede para abrir
    obterArquivo: function (a) {
      if (!a) return Promise.reject(new Error('Arquivo não encontrado.'));
      if (a.url) return Promise.resolve(a);
      var chave = a.pasta + '/' + a.caminho;
      if (baixados[chave]) return Promise.resolve(baixados[chave]);
      return sb.storage.from(a.pasta).download(a.caminho).then(function (r) {
        if (r.error || !r.data) throw new Error('Não consegui abrir o arquivo. Confira a internet e tente de novo.');
        var url = URL.createObjectURL(r.data);
        VS.blobs[url] = r.data;
        baixados[chave] = { nome: a.nome, tipo: a.tipo || r.data.type, url: url };
        return baixados[chave];
      }, function () { throw new Error('Não consegui abrir o arquivo. Confira a internet e tente de novo.'); });
    }
  };
})();
