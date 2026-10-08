/* App Van Service — utilidades de tela, ícones, navegação e eventos. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store;
  var U = VS.u = {};

  // ---------- texto e formatos
  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  U.brl = function (n) { return fmtBRL.format(n || 0); };
  U.parseValor = function (s) {
    s = String(s == null ? '' : s).replace(/[^\d,.]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  U.dataBR = function (iso) { if (!iso) return ''; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  U.dataCurta = function (iso) { if (!iso) return ''; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1]; };
  U.dataHora = function (dt) { if (!dt) return ''; return U.dataCurta(dt) + (dt.length > 10 ? ' às ' + dt.slice(11, 16) : ''); };
  U.mesNome = function (ym) { if (!ym) return ''; var p = ym.split('-'); return MESES[+p[1] - 1] + ' de ' + p[0]; };
  U.mesNomeCap = function (ym) { var s = U.mesNome(ym); return s.charAt(0).toUpperCase() + s.slice(1); };
  U.cpfFmt = function (d) { d = VS.cpf.digits(d); return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : d; };
  U.cpfMask = function (d) { d = VS.cpf.digits(d); return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : d; };
  U.foneFmt = function (d) {
    d = String(d || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  };
  U.primeiroNome = function (n) { return String(n || '').split(' ')[0]; };
  U.semAcento = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  U.nomeDe = function (id) { var f = S.porId(S.db.funcionarios, id); return f ? f.nome : 'alguém'; };
  // Nome de quem fez algo: usa o nome gravado junto do registro e, se não houver, procura na equipe.
  U.quem = function (o, campo) { return o[campo + 'Nome'] || U.nomeDe(o[campo] || o[campo + 'Id']); };
  U.ativo = function (f) { return f.ativo !== undefined ? !!f.ativo : !!f.senha; };
  U.codigoFmt = function (c) { c = String(c || ''); return c.length === 10 ? c.slice(0, 5) + '-' + c.slice(5) : c; };
  U.contratoDe = function (id) { var k = S.porId(S.db.contratos, id); return k ? k.nome : 'Sem contrato'; };
  U.PAPEIS = { admin: 'Administrador', rh: 'RH', financeiro: 'Financeiro', funcionario: 'Funcionário' };

  U.statusConta = function (c) {
    var hoje = S.db.hoje;
    if (c.pagoEm) return 'pago';
    if (c.vencimento < hoje) return 'atrasado';
    if (c.vencimento === hoje) return 'hoje';
    return 'avencer';
  };
  U.diasEntre = function (a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  };

  // ---------- ícones (traço, 24x24)
  var IC = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sino: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    arquivo: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
    casa: '<path d="M4 11l8-7 8 7v9H4z"/>',
    pessoa: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/>',
    equipe: '<circle cx="9" cy="8.5" r="3"/><path d="M3 19.5c.8-3.3 3.2-4.8 6-4.8s5.2 1.500 6 4.8"/><path d="M15.500 5.800a3 3 0 0 1 0 5.400M17.500 14.900c1.800.5 3 1.900 3.500 4.600"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    onibus: '<rect x="5" y="4" width="14" height="13" rx="2"/><path d="M5 11h14M8 20v-3M16 20v-3"/>',
    enviar: '<path d="M12 16V5M7 9.500L12 5l5 4.500M5 19h14"/>',
    clipe: '<path d="M8 12.500l6-6a3 3 0 0 1 4.200 4.200l-7.500 7.500a4.500 4.500 0 0 1-6.400-6.400l7-7"/>',
    lista: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    pasta: '<path d="M3 7h6l2 2h10v10H3z"/>',
    balao: '<path d="M4 5h16v11H9l-5 4z"/>',
    pontos: '<circle cx="5" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="19" cy="12" r="1.300"/>',
    busca: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    repetir: '<path d="M4 12a8 8 0 0 1 13.700-5.600L20 8.500M20 4v4.500h-4.500M20 12a8 8 0 0 1-13.700 5.600L4 15.500M4 20v-4.500h4.500"/>',
    sair: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>'
  };
  U.ic = function (nome, tam) {
    tam = tam || 22;
    return '<svg class="ic" width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[nome] || '') + '</svg>';
  };

  // ---------- estado, navegação e desenho
  VS.state = {
    rota: 'login', sheet: null,
    filtroContas: 'abertas', filtroOrc: 'abertos', mesRel: S.mesAtual, busca: '', orcEnviado: false
  };
  VS.views = {}; VS.sheets = {}; VS.acts = {}; VS.forms = {}; VS.changes = {}; VS.depois = {};
  VS.titulos = {};

  var NAV = {
    inicio: { rotulo: 'Início', ic: 'casa' },
    contas: { rotulo: 'Contas', ic: 'lista' },
    equipe: { rotulo: 'Equipe', ic: 'equipe' },
    pedidos: { rotulo: 'Pedidos', ic: 'calendario' },
    orcamentos: { rotulo: 'Orçamentos', ic: 'balao' },
    contratos: { rotulo: 'Contratos', ic: 'pasta' },
    meu: { rotulo: 'Meu espaço', ic: 'arquivo' },
    perfil: { rotulo: 'Perfil', ic: 'pessoa' }
  };
  var MENUS = {
    admin: ['inicio', 'contas', 'equipe', 'orcamentos', 'pedidos', 'contratos', 'perfil'],
    rh: ['contas', 'equipe', 'pedidos', 'meu', 'perfil'],
    financeiro: ['contas', 'contratos', 'meu', 'perfil'],
    funcionario: ['meu', 'perfil']
  };
  VS.menuDe = function (papel) { return MENUS[papel] || []; };
  VS.inicioDe = function (papel) { return (MENUS[papel] || ['login'])[0]; };

  VS.go = function (rota) {
    VS.state.rota = rota; VS.state.sheet = null;
    VS.render();
    try { window.scrollTo(0, 0); } catch (e) { /* sem rolagem */ }
  };
  VS.abrir = function (sheet, empilhar) {
    if (empilhar && VS.state.sheet) sheet.anterior = VS.state.sheet;
    VS.state.sheet = sheet; VS.render();
  };
  VS.fechar = function () {
    var s = VS.state.sheet;
    VS.state.sheet = s && s.anterior ? s.anterior : null;
    VS.render();
  };

  var toastTimer = null;
  VS.toast = function (msg, tipo) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast toast-on' + (tipo === 'erro' ? ' toast-erro' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, tipo === 'erro' ? 6000 : 3800);
  };
  VS.falha = function (e) { VS.toast(e && e.message ? e.message : 'Algo deu errado. Tente de novo.', 'erro'); };

  function navHtml(classe, itens, rota, compacto) {
    var limite = compacto && itens.length > 5 ? 4 : itens.length;
    var h = '';
    itens.slice(0, limite).forEach(function (r) {
      h += '<button type="button" class="' + classe + (r === rota ? ' on' : '') + '" data-act="ir" data-rota="' + r + '"' + (r === rota ? ' aria-current="page"' : '') + '>' + U.ic(NAV[r].ic) + '<span>' + NAV[r].rotulo + '</span></button>';
    });
    if (limite < itens.length) {
      var resto = itens.slice(limite);
      h += '<button type="button" class="' + classe + (resto.indexOf(rota) >= 0 ? ' on' : '') + '" data-act="abrir-mais">' + U.ic('pontos') + '<span>Mais</span></button>';
    }
    return h;
  }

  function sheetHtml() {
    var s = VS.state.sheet;
    if (!s || !VS.sheets[s.tipo]) return '';
    var r = VS.sheets[s.tipo](s);
    return '<div class="veu" data-act="fechar-fora"><div class="sheet' + (r.largo ? ' sheet-largo' : '') + '" role="dialog" aria-modal="true" aria-label="' + U.esc(r.titulo) + '">' +
      '<div class="sheet-topo"><h2>' + U.esc(r.titulo) + '</h2><button type="button" class="btn-ic" data-act="fechar" aria-label="' + (s.anterior ? 'Voltar' : 'Fechar') + '">' + U.ic(s.anterior ? 'voltar' : 'fechar') + '</button></div>' +
      '<div class="sheet-corpo">' + r.html + '</div></div></div>';
  }

  VS.render = function () {
    var root = document.getElementById('app');
    var u = S.me(), st = VS.state, h;
    var publicas = ['login', 'primeiro', 'orcamento'];
    if (!u && publicas.indexOf(st.rota) < 0) st.rota = 'login';
    if (u && (publicas.indexOf(st.rota) >= 0 || VS.menuDe(u.papel).indexOf(st.rota) < 0)) st.rota = VS.inicioDe(u.papel);

    if (!u) {
      h = '<div class="publico">' + VS.views[st.rota]() + '</div>';
    } else {
      var itens = VS.menuDe(u.papel);
      var naoLidos = S.meusAvisos().filter(function (a) { return !a.lido; }).length;
      h = '<div class="shell">' +
        '<aside class="lado"><div class="lado-marca"><img src="' + VS.logo + '" alt="" width="44" height="44"><span>Van Service</span></div>' +
        '<nav class="lado-nav" aria-label="Menu">' + navHtml('lado-item', itens, st.rota, false) + '</nav></aside>' +
        '<div class="centro">' +
        '<header class="topo"><div class="topo-txt"><span class="topo-sub">' + U.esc(U.primeiroNome(u.nome)) + ' · ' + U.PAPEIS[u.papel] + '</span><h1>' + U.esc(VS.titulos[st.rota] || NAV[st.rota].rotulo) + '</h1></div>' +
        '<button type="button" class="btn-ic btn-sino" data-act="abrir-avisos" aria-label="Avisos' + (naoLidos ? ', ' + naoLidos + ' novos' : '') + '">' + U.ic('sino') + (naoLidos ? '<span class="pingo">' + naoLidos + '</span>' : '') + '</button></header>' +
        (S.demo ? '<div class="demo-faixa"><span>Demonstração: dados de exemplo</span><button type="button" class="link" data-act="abrir-perfis">Trocar perfil</button></div>' : '') +
        '<main class="conteudo">' + VS.views[st.rota]() + '</main>' +
        '</div>' +
        '<nav class="abas" aria-label="Menu">' + navHtml('aba', itens, st.rota, true) + '</nav>' +
        '</div>';
    }
    root.innerHTML = h + sheetHtml();
    var s = st.sheet;
    if (s && VS.depois[s.tipo]) VS.depois[s.tipo](s, root);
    if (s) { var foco = root.querySelector('.sheet [autofocus]'); if (foco) { try { foco.focus(); } catch (e) { /* sem foco */ } } }
  };

  // ---------- folhas comuns
  VS.sheets.mais = function () {
    var u = S.me(), itens = VS.menuDe(u.papel).slice(4), h = '<div class="pilha">';
    itens.forEach(function (r) {
      h += '<button type="button" class="linha-nav" data-act="ir" data-rota="' + r + '">' + U.ic(NAV[r].ic) + '<span>' + NAV[r].rotulo + '</span>' + U.ic('seta', 18) + '</button>';
    });
    return { titulo: 'Mais', html: h + '</div>' };
  };
  VS.sheets.avisos = function () {
    var lista = S.meusAvisos(), h;
    if (!lista.length) h = '<p class="vazio">Nenhum aviso por enquanto.</p>';
    else {
      h = '<ul class="avisos">';
      lista.forEach(function (a) { h += '<li><span class="aviso-txt">' + U.esc(a.texto) + '</span><span class="aviso-em">' + U.dataHora(a.em) + '</span></li>'; });
      h += '</ul>';
    }
    h += '<p class="nota">No app instalado, estes avisos chegam também como notificação no celular e no computador.</p>';
    return { titulo: 'Avisos', html: h };
  };
  VS.sheets.perfis = function () {
    var h = '<p class="nota">Cada perfil vê telas diferentes. Escolha um para testar.</p><div class="pilha">';
    [['admin', 'Administrador', 'Vê tudo: contas, equipe, orçamentos e contratos'],
     ['rh', 'RH', 'Lança contas, cuida da equipe e dos pedidos'],
     ['financeiro', 'Financeiro', 'Recebe as contas e marca como pagas'],
     ['funcionario', 'Funcionário', 'Contracheques, vale-transporte e férias']].forEach(function (p) {
      h += '<button type="button" class="linha-nav" data-act="demo-entrar" data-papel="' + p[0] + '"><span class="linha-2"><strong>' + p[1] + '</strong><small>' + p[2] + '</small></span>' + U.ic('seta', 18) + '</button>';
    });
    h += '<button type="button" class="linha-nav" data-act="demo-sair"><span class="linha-2"><strong>Tela de entrada</strong><small>Login, primeiro acesso e pedido de orçamento</small></span>' + U.ic('seta', 18) + '</button></div>';
    return { titulo: 'Trocar perfil', html: h };
  };
  VS.sheets.imagem = function (s) {
    return { titulo: s.nome || 'Arquivo', largo: true, html: '<img class="img-anexo" src="' + U.esc(s.url) + '" alt="' + U.esc(s.nome || 'Arquivo anexado') + '">' };
  };

  VS.acts.ir = function (el) { VS.go(el.getAttribute('data-rota')); };
  VS.acts.fechar = function () { VS.fechar(); };
  VS.acts['fechar-fora'] = function (el, ev) { if (ev.target === el) VS.fechar(); };
  VS.acts['abrir-mais'] = function () { VS.abrir({ tipo: 'mais' }); };
  VS.acts['abrir-perfis'] = function () { VS.abrir({ tipo: 'perfis' }); };
  VS.acts['abrir-avisos'] = function () { VS.abrir({ tipo: 'avisos' }); S.marcarAvisosLidos(); };
  VS.acts['demo-entrar'] = function (el) {
    S.entrarDemo(el.getAttribute('data-papel')).then(function (u) { VS.go(VS.inicioDe(u.papel)); }, VS.falha);
  };
  VS.acts['demo-sair'] = function () { S.sair().then(function () { VS.go('login'); }); };

  // ---------- arquivos
  U.arquivoDe = function (input) {
    var f = input && input.files && input.files[0];
    if (!f) return null;
    return U.registrar({ nome: f.name, tipo: f.type || '', url: URL.createObjectURL(f), blob: f });
  };
  VS.blobs = {};
  U.registrar = function (arq) { VS.blobs[arq.url] = arq.blob; return arq; };
  // Os botões guardam só uma referência; o arquivo é buscado quando a pessoa clica.
  var refs = {}, nRef = 0;
  U.refArq = function (arq) {
    if (!arq) return '';
    if (!arq._ref) { nRef += 1; arq._ref = 'a' + nRef; }
    refs[arq._ref] = arq;
    return arq._ref;
  };
  U.botaoArquivo = function (arq, rotulo) {
    if (!arq) return '';
    return '<button type="button" class="btn btn-borda btn-p" data-act="abrir-arquivo" data-arq="' + U.refArq(arq) + '">' + U.ic('clipe', 18) + '<span>' + U.esc(rotulo || arq.nome) + '</span></button>';
  };
  VS.acts['abrir-arquivo'] = function (el) {
    var arq = refs[el.getAttribute('data-arq')], titulo = el.getAttribute('data-nome');
    if (!arq) { VS.toast('Este item de exemplo não tem arquivo.'); return; }
    S.obterArquivo(arq).then(function (a) {
      var tipo = a.tipo || '', nome = titulo || a.nome || 'Arquivo';
      if (tipo.indexOf('image/') === 0) VS.abrir({ tipo: 'imagem', url: a.url, nome: nome }, true);
      else if (tipo === 'application/pdf' || /\.pdf$/i.test(a.nome || '')) VS.abrir({ tipo: 'pdf', url: a.url, nome: nome }, true);
      else VS.toast('Não consigo mostrar este tipo de arquivo aqui: ' + (a.nome || ''), 'erro');
    }, VS.falha);
  };

  // ---------- eventos (delegados)
  function erroNoForm(form, msg) {
    var box = form.querySelector('.form-erro');
    if (box) { box.textContent = msg; box.hidden = !msg; } else if (msg) VS.toast(msg, 'erro');
  }
  VS.erroNoForm = erroNoForm;

  VS.iniciar = function () {
    var root = document.getElementById('app');
    root.addEventListener('click', function (ev) {
      var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!el || !root.contains(el)) return;
      var fn = VS.acts[el.getAttribute('data-act')];
      if (fn) fn(el, ev);
    });
    root.addEventListener('submit', function (ev) {
      var form = ev.target, nome = form.getAttribute && form.getAttribute('data-form');
      if (!nome) return;
      ev.preventDefault();
      erroNoForm(form, '');
      var dados = {};
      Array.prototype.forEach.call(form.elements, function (c) {
        if (!c.name) return;
        if (c.type === 'checkbox') dados[c.name] = c.checked;
        else if (c.type === 'radio') { if (c.checked) dados[c.name] = c.value; }
        else if (c.type === 'file') dados[c.name] = U.arquivoDe(c);
        else dados[c.name] = typeof c.value === 'string' ? c.value.trim() : c.value;
      });
      var fn = VS.forms[nome];
      if (!fn) return;
      var r;
      try { r = fn(dados, form); } catch (e) { erroNoForm(form, e.message); return; }
      if (r && r.then) r.then(null, function (e) { erroNoForm(form, e && e.message ? e.message : 'Algo deu errado. Tente de novo.'); });
    });
    root.addEventListener('change', function (ev) {
      var nome = ev.target.getAttribute && ev.target.getAttribute('data-change');
      if (nome && VS.changes[nome]) VS.changes[nome](ev.target, ev);
    });
    root.addEventListener('input', function (ev) {
      var t = ev.target, m = t.getAttribute && t.getAttribute('data-mask');
      if (m === 'cpf') {
        var d = t.value.replace(/\D/g, '').slice(0, 11), o = d;
        if (d.length > 9) o = d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
        else if (d.length > 6) o = d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
        else if (d.length > 3) o = d.slice(0, 3) + '.' + d.slice(3);
        t.value = o;
      } else if (m === 'fone') {
        var f = t.value.replace(/\D/g, '').slice(0, 11), p = f;
        if (f.length > 6) p = '(' + f.slice(0, 2) + ') ' + f.slice(2, f.length - 4) + '-' + f.slice(f.length - 4);
        else if (f.length > 2) p = '(' + f.slice(0, 2) + ') ' + f.slice(2);
        t.value = p;
      }
      var nome = t.getAttribute && t.getAttribute('data-input');
      if (nome && VS.changes[nome]) VS.changes[nome](t, ev);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && VS.state.sheet) VS.fechar();
    });
    // O endereço do app terminado em #orcamento abre direto o pedido de orçamento (para os botões do site).
    try { if (window.location.hash === '#orcamento') VS.state.rota = 'orcamento'; } catch (e) { /* sem endereço */ }
    if (!S.iniciar) { VS.render(); return; }
    root.innerHTML = '<p class="carregando" role="status">Abrindo o app…</p>';
    S.iniciar().then(function () {
      var u = S.me();
      if (u) VS.state.rota = VS.inicioDe(u.papel);
      VS.state.mesRel = S.mesAtual;
      VS.render();
    }, function (e) { VS.render(); VS.falha(e); });
    // Busca novidades ao voltar para o app e a cada minuto, sem atrapalhar quem está digitando.
    function atualizar() {
      if (!S.recarregar || !S.me() || VS.state.sheet || document.hidden) return;
      var foco = document.activeElement;
      if (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
      S.recarregar().then(function () { if (!VS.state.sheet) VS.render(); }, function (e) {
        // Acesso bloqueado ou sessão encerrada: volta para a tela de entrada.
        if (e && /Entre no app|sessão expirou/.test(e.message || '')) S.sair().then(function () { VS.go('login'); VS.toast('Seu acesso foi encerrado. Entre de novo ou fale com o RH.', 'erro'); });
      });
    }
    document.addEventListener('visibilitychange', atualizar);
    setInterval(atualizar, 60000);
  };
})();
