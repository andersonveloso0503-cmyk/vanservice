/* App Van Service — visão geral do administrador, orçamentos e perfil. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store, U = VS.u, e = U.esc;

  // =====================================================================
  // Início (administrador): o que precisa de atenção
  // =====================================================================
  VS.titulos.inicio = 'O que precisa de atenção';
  VS.views.inicio = function () {
    var db = S.db, atras = 0, hoje = 0, valorAtras = 0, valorHoje = 0;
    db.contas.forEach(function (c) {
      var s = U.statusConta(c);
      if (s === 'atrasado') { atras += 1; valorAtras += c.valor; }
      if (s === 'hoje') { hoje += 1; valorHoje += c.valor; }
    });
    var orcNovos = db.orcamentos.filter(function (o) { return o.status === 'novo'; }).length;
    var ferias = db.solicitacoes.filter(function (s) { return s.status === 'pendente'; }).length;
    var docs = db.documentos.filter(function (d) { return !d.vistoEm; }).length;
    var mes = ''; db.contracheques.forEach(function (c) { if (c.mes > mes) mes = c.mes; });
    var semConf = db.contracheques.filter(function (c) { return c.mes === mes && !c.confirmadoEm; }).length;
    var semAcesso = db.funcionarios.filter(function (f) { return !U.ativo(f) && !f.bloqueado; }).length;

    function linha(n, titulo, detalhe, rota, tom, filtro) {
      return '<li><button type="button" class="cartao atencao' + (n ? ' atencao-' + tom : ' atencao-zero') + '" data-act="inicio-ir" data-rota="' + rota + '"' + (filtro ? ' data-filtro="' + filtro + '"' : '') + '>' +
        '<strong class="atencao-n num">' + n + '</strong><span class="atencao-txt"><strong>' + titulo + '</strong><span class="sub">' + detalhe + '</span></span>' + U.ic('seta', 18) + '</button></li>';
    }
    return '<ul class="cartoes">' +
      linha(atras, 'Pagamentos atrasados', atras ? U.brl(valorAtras) + ' em atraso' : 'Nada em atraso', 'contas', 'ruim', 'atrasado') +
      linha(hoje, 'Vencem hoje', hoje ? U.brl(valorHoje) + ' para pagar hoje' : 'Nada vence hoje', 'contas', 'atencao', 'hoje') +
      linha(orcNovos, 'Pedidos de orçamento novos', orcNovos ? 'Aguardando o primeiro contato' : 'Todos já foram atendidos', 'orcamentos', 'info') +
      linha(ferias, 'Pedidos de férias', ferias ? 'Aguardando resposta do RH' : 'Nenhum pedido pendente', 'pedidos', 'info') +
      linha(docs, 'Documentos não vistos', docs ? 'Atestados e documentos enviados pela equipe' : 'Tudo visto', 'pedidos', 'info') +
      linha(semConf, 'Contracheques sem confirmação', mes ? 'Referência: ' + U.mesNome(mes) : 'Nenhum contracheque enviado', 'equipe', 'info') +
      linha(semAcesso, 'Aguardando primeiro acesso', semAcesso ? 'Ainda não criaram a senha' : 'Todos já acessaram', 'equipe', 'info') +
      '</ul>';
  };
  VS.acts['inicio-ir'] = function (el) {
    var f = el.getAttribute('data-filtro');
    if (f) { VS.state.filtroContas = f; VS.state.filtroTipo = 'tudo'; }
    VS.go(el.getAttribute('data-rota'));
  };

  // =====================================================================
  // Orçamentos
  // =====================================================================
  var ST_ORC = { novo: 'Novo', atendimento: 'Em atendimento', proposta: 'Proposta enviada', fechado: 'Fechado', perdido: 'Não fechou' };
  var TOM_ORC = { novo: 'atencao', atendimento: 'neutro', proposta: 'neutro', fechado: 'bom', perdido: 'ruim' };
  VS.titulos.orcamentos = 'Pedidos de orçamento';
  VS.views.orcamentos = function () {
    var f = VS.state.filtroOrc, todos = S.db.orcamentos;
    var abertos = todos.filter(function (o) { return o.status === 'novo' || o.status === 'atendimento' || o.status === 'proposta'; });
    var lista = f === 'todos' ? todos : abertos;
    var h = '<div class="barra-lista"><div><h2>' + (f === 'todos' ? 'Todos os pedidos' : 'Em andamento') + '</h2><p class="sub">' + abertos.length + ' em andamento · ' + todos.length + ' no total</p></div>' +
      '<button type="button" class="link" data-act="orc-filtro">' + (f === 'todos' ? 'Ver só em andamento' : 'Ver todos') + '</button></div>';
    if (!lista.length) return h + '<p class="vazio">Nenhum pedido de orçamento em andamento.</p>';
    h += '<ul class="cartoes">';
    lista.forEach(function (o) {
      var fone = U.foneFmt(o.whatsapp);
      h += '<li class="cartao orc"><div class="conta-topo"><span class="conta-nome"><strong>' + e(o.empresa || o.nome) + '</strong><span class="sub">' + e(o.nome) + ' · ' + e(o.servico) + '</span><span class="sub">Pedido em ' + U.dataHora(o.criadoEm) + '</span></span>' +
        '<span class="est est-' + TOM_ORC[o.status] + '">' + ST_ORC[o.status] + '</span></div>' +
        (o.mensagem ? '<p class="orc-msg">' + e(o.mensagem) + '</p>' : '') +
        '<div class="orc-contato"><span class="num orc-fone">' + e(fone) + '</span>' +
        '<a class="btn btn-borda btn-p" href="https://wa.me/55' + e(o.whatsapp) + '" target="_blank" rel="noopener">Abrir WhatsApp</a>' +
        '<button type="button" class="btn btn-borda btn-p" data-act="copiar" data-texto="' + e(fone) + '">' + U.ic('copiar', 18) + '<span>Copiar número</span></button></div>' +
        '<label class="campo campo-linha" for="orc-st-' + o.id + '">Situação<select id="orc-st-' + o.id + '" data-change="orc-status" data-id="' + o.id + '">';
      Object.keys(ST_ORC).forEach(function (k) { h += '<option value="' + k + '"' + (o.status === k ? ' selected' : '') + '>' + ST_ORC[k] + '</option>'; });
      h += '</select></label></li>';
    });
    return h + '</ul>';
  };
  VS.acts['orc-filtro'] = function () { VS.state.filtroOrc = VS.state.filtroOrc === 'todos' ? 'abertos' : 'todos'; VS.render(); };
  VS.changes['orc-status'] = function (el) {
    S.setStatusOrcamento(el.getAttribute('data-id'), el.value).then(function () { VS.render(); VS.toast('Situação atualizada.'); }, VS.falha);
  };

  // =====================================================================
  // Perfil
  // =====================================================================
  VS.titulos.perfil = 'Meu perfil';
  VS.views.perfil = function () {
    var u = S.me();
    var guia = S.demo ? '' : '<section class="cartao bloco-cartao bloco-linha"><span class="bloco-ic">' + U.ic('balao') + '</span><span class="bloco-txt"><h2>Como usar o app</h2><span class="sub">Passo a passo com imagens, só com o que você usa.</span></span>' +
      '<a class="btn btn-cheio btn-p" href="guia.html?p=' + u.papel + '">Abrir guia</a></section>';
    return guia + '<section class="cartao bloco-cartao"><dl class="dados">' +
      '<div><dt>Nome</dt><dd>' + e(u.nome) + '</dd></div>' +
      '<div><dt>CPF</dt><dd class="num">' + U.cpfMask(u.cpf) + '</dd></div>' +
      '<div><dt>Perfil de acesso</dt><dd>' + U.PAPEIS[u.papel] + '</dd></div></dl></section>' +
      '<section class="cartao bloco-cartao"><h2>Trocar senha</h2><form data-form="trocarSenha" class="form" novalidate>' +
      '<label class="campo" for="ts-atual">Senha atual<input id="ts-atual" name="atual" type="password" autocomplete="current-password"></label>' +
      '<label class="campo" for="ts-nova">Nova senha<input id="ts-nova" name="nova" type="password" autocomplete="new-password" placeholder="Pelo menos 8 caracteres"></label>' +
      '<label class="campo" for="ts-nova2">Repita a nova senha<input id="ts-nova2" name="nova2" type="password" autocomplete="new-password"></label>' +
      '<p class="form-erro" role="alert" hidden></p><button type="submit" class="btn btn-borda">Salvar nova senha</button></form>' +
      (S.demo ? '<p class="nota">Na demonstração, a senha de todos os perfis é demo1234.</p>' : '') + '</section>' +
      (VS.push ? VS.push.cartao() : '') +
      '<button type="button" class="btn btn-borda btn-sair" data-act="sair">' + U.ic('sair', 20) + '<span>Sair do app</span></button>';
  };
  VS.forms.trocarSenha = function (d, form) {
    if (!d.atual) throw new Error('Digite a senha atual.');
    if (d.nova.length < 8) throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
    if (d.nova !== d.nova2) throw new Error('As duas senhas novas não são iguais.');
    return S.trocarSenha(d.atual, d.nova).then(function () { form.reset(); VS.toast('Senha alterada.'); });
  };
  VS.acts.sair = function () { S.sair().then(function () { VS.go('login'); }); };
})();

/* Recado para o RH / Fiscal: ao abrir o app, lembra onde fica o passo a passo. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store, U = VS.u;
  var CHAVE = 'vs-recado-rh-desligado';
  var mostrado = false;
  function desligado() { try { return window.localStorage.getItem(CHAVE) === '1'; } catch (e) { return false; } }

  VS.sheets.recadoRh = function () {
    return {
      titulo: 'Recado',
      html: '<div class="recado"><span class="bloco-ic">' + U.ic('balao') + '</span>' +
        '<p><strong>Qualquer dúvida sobre o aplicativo, toque em Perfil.</strong> Lá está todo o passo a passo, com imagens: contas, pagamentos a funcionários, vale-transporte e contracheques.</p></div>' +
        '<button type="button" class="btn btn-cheio" data-act="recado-perfil">Ir para o Perfil</button>' +
        '<button type="button" class="btn btn-borda" data-act="fechar">Entendi</button>' +
        '<label class="marcar" for="recado-nao"><input id="recado-nao" type="checkbox" data-change="recado-nao"><span>Não mostrar de novo</span></label>'
    };
  };
  VS.acts['recado-perfil'] = function () { VS.state.sheet = null; VS.go('perfil'); };
  VS.changes['recado-nao'] = function (el) {
    try { if (el.checked) window.localStorage.setItem(CHAVE, '1'); else window.localStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento */ }
  };

  // Mostra uma vez cada vez que o RH abre o app ou entra.
  var renderOriginal = VS.render;
  VS.render = function () {
    var u = S.me();
    if (!u) mostrado = false;
    else if (!mostrado && u.papel === 'rh' && !S.demo && !VS.state.sheet) {
      mostrado = true;
      if (!desligado()) { VS.state.sheet = { tipo: 'recadoRh' }; }
    }
    return renderOriginal.apply(this, arguments);
  };
})();
