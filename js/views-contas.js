/* App Van Service — entrada, pedido de orçamento (público) e contas a pagar. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store, U = VS.u, e = U.esc;

  // =====================================================================
  // Entrada
  // =====================================================================
  function cabecaPublica(texto) {
    return '<div class="pub-topo"><img src="' + VS.logo + '" alt="Van Service" width="132" height="132"><p>' + texto + '</p></div>';
  }

  VS.views.login = function () {
    var h = cabecaPublica('Contas a pagar, contracheques e orçamentos em um só lugar.') +
      '<div class="pub-cartao">' +
      '<h1>Entrar</h1>' +
      '<form data-form="login" class="form" novalidate>' +
      '<label class="campo" for="login-cpf">CPF<input id="login-cpf" name="cpf" type="text" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00" data-mask="cpf"></label>' +
      '<label class="campo" for="login-senha">Senha<input id="login-senha" name="senha" type="password" autocomplete="current-password" placeholder="Sua senha"></label>' +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-cheio">Entrar</button>' +
      '</form>' +
      '<button type="button" class="link link-centro" data-act="ir" data-rota="primeiro">Primeiro acesso? Criar minha senha</button>';
    if (S.demo) {
      h += '<div class="demo-caixa"><h2>Demonstração</h2><p>Entre sem senha para ver o app como cada perfil.</p><div class="demo-botoes">' +
        '<button type="button" class="btn btn-borda" data-act="demo-entrar" data-papel="admin">Administrador</button>' +
        '<button type="button" class="btn btn-borda" data-act="demo-entrar" data-papel="rh">RH</button>' +
        '<button type="button" class="btn btn-borda" data-act="demo-entrar" data-papel="financeiro">Financeiro</button>' +
        '<button type="button" class="btn btn-borda" data-act="demo-entrar" data-papel="funcionario">Funcionário</button>' +
        '</div></div>';
    }
    h += '<div class="pub-rodape"><span>Não é funcionário?</span><button type="button" class="btn btn-borda" data-act="ir" data-rota="orcamento">Pedir um orçamento</button></div></div>';
    return h;
  };
  VS.forms.login = function (d) {
    if (!VS.cpf.valido(d.cpf)) throw new Error('Confira o CPF: faltam números ou ele está incorreto.');
    if (!d.senha) throw new Error('Digite a sua senha.');
    return S.login(d.cpf, d.senha).then(function (u) { VS.go(VS.inicioDe(u.papel)); });
  };

  VS.views.primeiro = function () {
    var dica = '', abrirCodigo = VS.state.comCodigo ? ' open' : '';
    if (S.demo) {
      var novo = S.db.funcionarios.filter(function (f) { return !U.ativo(f) && !f.bloqueado && f.papel === 'funcionario'; })[0];
      if (novo) dica = '<p class="nota">Para testar na demonstração: CPF <strong>' + U.cpfFmt(novo.cpf) + '</strong> e nome <strong>' + e(novo.nome) + '</strong>.</p>';
    }
    return cabecaPublica('Crie a sua senha para acessar seus contracheques.') +
      '<div class="pub-cartao">' +
      '<h1>Primeiro acesso</h1>' +
      '<p class="nota">Digite seu CPF e seu nome como estão no contracheque. Pode ser só o primeiro nome e o sobrenome.</p>' + dica +
      '<form data-form="primeiro" class="form" novalidate>' +
      '<label class="campo" for="pa-cpf">CPF<input id="pa-cpf" name="cpf" type="text" inputmode="numeric" placeholder="000.000.000-00" data-mask="cpf"></label>' +
      '<label class="campo" for="pa-nome">Nome e sobrenome<input id="pa-nome" name="nome" type="text" autocomplete="name" placeholder="Ex.: Maria Souza"></label>' +
      '<details class="com-codigo"' + abrirCodigo + '><summary>Sou do RH, do financeiro ou recebi um código</summary>' +
      '<label class="campo" for="pa-codigo">Código de acesso<input id="pa-codigo" name="codigo" type="text" autocapitalize="characters" autocomplete="off" placeholder="XXXXX-XXXXX"></label></details>' +
      '<label class="campo" for="pa-senha">Nova senha<input id="pa-senha" name="senha" type="password" autocomplete="new-password" placeholder="Pelo menos 8 caracteres"></label>' +
      '<label class="campo" for="pa-senha2">Repita a senha<input id="pa-senha2" name="senha2" type="password" autocomplete="new-password"></label>' +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-cheio">Criar senha e entrar</button>' +
      '</form>' +
      '<button type="button" class="link link-centro" data-act="ir" data-rota="login">Voltar para a entrada</button></div>';
  };
  VS.forms.primeiro = function (d) {
    if (!VS.cpf.valido(d.cpf)) throw new Error('Confira o CPF: faltam números ou ele está incorreto.');
    if (!d.codigo && VS.u.semAcento(d.nome).split(' ').filter(Boolean).length < 2) throw new Error('Digite seu nome e sobrenome.');
    if (d.senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
    if (d.senha !== d.senha2) throw new Error('As duas senhas não são iguais.');
    return S.primeiroAcesso(d.cpf, d.nome, d.codigo, d.senha).then(function (u) {
      VS.go(VS.inicioDe(u.papel)); VS.toast('Senha criada. Bem-vindo, ' + U.primeiroNome(u.nome) + '.');
    });
  };

  // =====================================================================
  // Pedido de orçamento (sem login)
  // =====================================================================
  // Mesmos serviços anunciados no site vanservicers.com.br
  var SERVICOS = ['Portaria', 'Limpeza', 'Zeladoria', 'Recepção', 'Serviços gerais', 'Manutenção', 'Portaria virtual', 'Outro serviço'];
  VS.views.orcamento = function () {
    if (VS.state.orcEnviado) {
      return cabecaPublica('Terceirização de serviços em Porto Alegre e região.') +
        '<div class="pub-cartao"><div class="feito">' + U.ic('check', 30) + '</div><h1>Pedido enviado</h1>' +
        '<p class="nota">Recebemos o seu pedido. A resposta chega pelo WhatsApp que você informou.</p>' +
        '<button type="button" class="btn btn-borda" data-act="orc-novo">Enviar outro pedido</button>' +
        '<button type="button" class="link link-centro" data-act="ir" data-rota="login">Voltar para a entrada</button></div>';
    }
    var h = cabecaPublica('Terceirização de serviços em Porto Alegre e região.') +
      '<div class="pub-cartao"><h1>Peça um orçamento</h1>' +
      '<form data-form="orcamento" class="form" novalidate>' +
      '<label class="campo" for="orc-nome">Seu nome<input id="orc-nome" name="nome" type="text" autocomplete="name" placeholder="Nome completo"></label>' +
      '<label class="campo" for="orc-empresa">Empresa ou condomínio<input id="orc-empresa" name="empresa" type="text" placeholder="Nome do local"></label>' +
      '<label class="campo" for="orc-fone">WhatsApp<input id="orc-fone" name="whatsapp" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(51) 00000-0000" data-mask="fone"></label>' +
      '<fieldset class="campo-grupo"><legend>Qual serviço?</legend><div class="opcoes">';
    SERVICOS.forEach(function (s, i) {
      h += '<label class="opcao"><input type="radio" name="servico" id="orc-serv-' + i + '" value="' + e(s) + '"><span>' + e(s) + '</span></label>';
    });
    h += '</div></fieldset>' +
      '<label class="campo" for="orc-msg">Conte o que você precisa<textarea id="orc-msg" name="mensagem" rows="3" placeholder="Local, quantidade de pessoas, horários…"></textarea></label>' +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-cheio">Enviar pedido</button>' +
      '</form>' +
      '<button type="button" class="link link-centro" data-act="ir" data-rota="login">Sou funcionário</button></div>';
    return h;
  };
  VS.forms.orcamento = function (d) {
    return S.pedirOrcamento(d).then(function () { VS.state.orcEnviado = true; VS.render(); });
  };
  VS.acts['orc-novo'] = function () { VS.state.orcEnviado = false; VS.render(); };

  // =====================================================================
  // Contas a pagar e pagamentos extras a funcionários
  // =====================================================================
  var ROTULO = { pago: 'Pago', atrasado: 'Atrasado', hoje: 'Vence hoje', avencer: 'A vencer' };
  var ICONE = { pago: 'check', atrasado: 'alerta', hoje: 'relogio', avencer: 'calendario' };
  function selo(st) { return '<span class="selo selo-' + st + '">' + U.ic(ICONE[st], 18) + ROTULO[st] + '</span>'; }
  U.seloConta = selo;

  function quando(c) {
    var st = U.statusConta(c), hoje = S.db.hoje;
    if (st === 'pago') return 'Pago em ' + U.dataHora(c.pagoEm);
    if (st === 'hoje') return 'Vence hoje, ' + U.dataCurta(c.vencimento);
    if (st === 'atrasado') { var n = U.diasEntre(c.vencimento, hoje); return 'Venceu em ' + U.dataCurta(c.vencimento) + ' · ' + n + (n === 1 ? ' dia' : ' dias') + ' de atraso'; }
    return 'Vence em ' + U.dataCurta(c.vencimento);
  }

  // Pagamento extra a funcionário é um lançamento com tipo 'extra': segue o mesmo caminho da conta.
  var MOTIVOS = ['Hora extra', 'Adiantamento', 'Bônus ou prêmio', 'Reembolso', 'Diária ou ajuda de custo', 'Rescisão', 'Outro pagamento'];
  function ehExtra(c) { return c.tipo === 'extra'; }
  function tituloDe(c) { return ehExtra(c) ? c.descricao + ' · ' + (c.funcionarioNome || U.nomeDe(c.funcionarioId)) : c.descricao; }
  function ehPdf(a) { return !!a && (a.tipo === 'application/pdf' || /\.pdf$/i.test(a.nome || '')); }
  function botaoAnexo(a, pdf, foto, titulo) {
    if (!a) return '';
    return '<button type="button" class="chip-arq" data-act="abrir-arquivo" data-arq="' + U.refArq(a) + '" data-nome="' + e(titulo) + '">' + U.ic(ehPdf(a) ? 'arquivo' : 'clipe', 18) + '<span>' + (ehPdf(a) ? pdf : foto) + '</span></button>';
  }
  function anexosDe(c) {
    return botaoAnexo(c.anexo, ehExtra(c) ? 'PDF anexado' : 'PDF da conta', ehExtra(c) ? 'Foto anexada' : 'Foto da conta', tituloDe(c)) +
      botaoAnexo(c.comprovante, 'Comprovante', 'Comprovante', 'Comprovante: ' + tituloDe(c));
  }

  VS.titulos.contas = 'Contas a pagar';
  VS.views.contas = function () {
    var u = S.me(), st = VS.state;
    var podeLancar = u.papel === 'rh' || u.papel === 'admin';
    var podePagar = u.papel === 'financeiro' || u.papel === 'admin';
    var ft = st.filtroTipo || 'tudo';
    var todas = S.db.contas.filter(function (c) { return ft === 'tudo' || (ft === 'extra') === ehExtra(c); })
      .sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0; });
    var grupos = { hoje: [], atrasado: [], avencer: [], pago: [] };
    todas.forEach(function (c) { grupos[U.statusConta(c)].push(c); });
    var abertas = grupos.atrasado.concat(grupos.hoje, grupos.avencer);
    var pagas = grupos.pago.slice().sort(function (a, b) { return a.pagoEm < b.pagoEm ? 1 : -1; });
    var totalAberto = abertas.reduce(function (s, c) { return s + c.valor; }, 0);
    var f = st.filtroContas, lista, legenda;
    if (f === 'hoje') { lista = grupos.hoje; legenda = 'Vencem hoje'; }
    else if (f === 'atrasado') { lista = grupos.atrasado; legenda = 'Atrasados'; }
    else if (f === 'pago') { lista = pagas; legenda = 'Pagos'; }
    else if (f === 'todas') { lista = abertas.concat(pagas); legenda = 'Todos os lançamentos'; }
    else { lista = abertas; legenda = 'Em aberto'; }

    function ficha(chave, n, rotulo) {
      return '<button type="button" class="ficha ficha-' + chave + (f === chave ? ' on' : '') + '" data-act="contas-filtro" data-filtro="' + chave + '" aria-pressed="' + (f === chave) + '"><strong>' + n + '</strong><span>' + rotulo + '</span></button>';
    }
    function tipo(chave, rotulo) {
      return '<button type="button" class="tipo' + (ft === chave ? ' on' : '') + '" data-act="contas-tipo" data-tipo="' + chave + '" aria-pressed="' + (ft === chave) + '">' + rotulo + '</button>';
    }
    var h = '';
    if (podeLancar) {
      h += '<div class="acoes-topo"><button type="button" class="btn btn-cheio" data-act="conta-nova">' + U.ic('mais', 20) + '<span>Nova conta</span></button>' +
        '<button type="button" class="btn btn-cheio" data-act="extra-novo">' + U.ic('pessoa', 20) + '<span>Pagamento a funcionário</span></button></div>';
    }
    h += '<div class="tipos" role="group" aria-label="Mostrar">' + tipo('tudo', 'Tudo') + tipo('conta', 'Contas') + tipo('extra', 'Funcionários') + '</div>';
    h += '<div class="fichas">' + ficha('hoje', grupos.hoje.length, 'Vencem hoje') + ficha('atrasado', grupos.atrasado.length, 'Atrasados') + ficha('pago', grupos.pago.length, 'Pagos') + '</div>';
    h += '<div class="barra-lista"><div><h2>' + legenda + '</h2><p class="sub">Em aberto: <strong class="num">' + U.brl(totalAberto) + '</strong> em ' + abertas.length + (abertas.length === 1 ? ' lançamento' : ' lançamentos') + '</p></div>' +
      '<button type="button" class="link" data-act="contas-filtro" data-filtro="' + (f === 'todas' ? 'abertas' : 'todas') + '">' + (f === 'todas' ? 'Ver só em aberto' : 'Ver todos') + '</button></div>';

    if (!lista.length) {
      h += '<p class="vazio">' + (f === 'atrasado' ? 'Nada atrasado.' : f === 'hoje' ? 'Nada vence hoje.' : f === 'pago' ? 'Nada pago ainda.' : 'Nada em aberto.') + '</p>';
    } else {
      h += '<ul class="cartoes">';
      lista.forEach(function (c) {
        var s = U.statusConta(c), anexos = anexosDe(c);
        h += '<li class="cartao conta conta-' + s + '">' +
          '<div class="conta-topo"><button type="button" class="conta-nome" data-act="conta-detalhe" data-id="' + c.id + '"><strong>' + e(tituloDe(c)) + '</strong>' +
          '<span class="sub">' + quando(c) + '</span><span class="sub">' + (ehExtra(c) ? 'Pagamento a funcionário · ' : '') + e(U.contratoDe(c.contratoId)) + (c.recorrente ? ' · todo mês' : '') + '</span></button>' +
          '<span class="conta-valor num">' + U.brl(c.valor) + '</span></div>' +
          (anexos ? '<div class="conta-anexos">' + anexos + '</div>' : '') +
          '<div class="conta-pe">' + selo(s);
        if (podePagar) {
          h += s === 'pago'
            ? '<button type="button" class="btn btn-borda btn-p" data-act="conta-desfazer" data-id="' + c.id + '">Desfazer</button>'
            : '<button type="button" class="btn btn-borda btn-p" data-act="conta-pagar" data-id="' + c.id + '">Marcar como ' + (ehExtra(c) ? 'pago' : 'paga') + '</button>';
        } else {
          h += '<button type="button" class="btn btn-borda btn-p" data-act="conta-detalhe" data-id="' + c.id + '">Detalhes</button>';
        }
        h += '</div></li>';
      });
      h += '</ul>';
    }
    return h;
  };

  VS.acts['contas-filtro'] = function (el) {
    var f = el.getAttribute('data-filtro');
    VS.state.filtroContas = VS.state.filtroContas === f ? 'abertas' : f;
    VS.render();
  };
  VS.acts['contas-tipo'] = function (el) { VS.state.filtroTipo = el.getAttribute('data-tipo'); VS.render(); };

  function opcoesContrato() {
    var h = '';
    S.db.contratos.filter(function (k) { return k.ativo; }).forEach(function (k) { h += '<option value="' + k.id + '">' + e(k.nome) + '</option>'; });
    return h;
  }
  var SEM_CONTRATO = '<p class="vazio">Ainda não há contrato cadastrado. O administrador cadastra os contratos em Contratos, e depois os lançamentos podem ser feitos.</p>';

  // ----- nova conta (com o PDF ou a foto guardados junto)
  VS.acts['conta-nova'] = function () { VS.abrir({ tipo: 'contaNova' }); };
  VS.sheets.contaNova = function () {
    var contratos = opcoesContrato();
    if (!contratos) return { titulo: 'Nova conta', html: SEM_CONTRATO };
    var h = '<form data-form="contaNova" class="form" novalidate>' +
      '<label class="campo" for="cn-anexo">PDF ou foto da conta<input id="cn-anexo" name="anexo" type="file" accept="application/pdf,image/*" data-change="conta-arquivo">' +
      '<small class="dica" id="cn-dica">O arquivo fica guardado junto da conta. Se for boleto em PDF, o app tenta preencher o valor e o vencimento.</small></label>' +
      '<label class="campo" for="cn-desc">Descrição<input id="cn-desc" name="descricao" type="text" placeholder="Ex.: combustível da frota"></label>' +
      '<div class="dupla">' +
      '<label class="campo" for="cn-valor">Valor<input id="cn-valor" name="valor" type="text" inputmode="decimal" placeholder="0,00"></label>' +
      '<label class="campo" for="cn-venc">Vencimento<input id="cn-venc" name="vencimento" type="date" value="' + S.db.hoje + '"></label>' +
      '</div>' +
      '<label class="campo" for="cn-contrato">Contrato<select id="cn-contrato" name="contratoId">' + contratos + '</select></label>' +
      '<label class="marcar" for="cn-rec"><input id="cn-rec" name="recorrente" type="checkbox"><span>Repete todo mês<small>Ao ser paga, a conta do mês seguinte é criada sozinha.</small></span></label>' +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-cheio">Enviar ao financeiro</button></form>';
    return { titulo: 'Nova conta', html: h };
  };
  // Ao escolher um PDF, procura a linha do boleto e preenche valor e vencimento para o RH conferir.
  VS.changes['conta-arquivo'] = function (el) {
    var f = el.files && el.files[0], dica = document.getElementById('cn-dica');
    if (!f || !dica) return;
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { dica.textContent = 'Foto anexada. Ela fica guardada junto da conta.'; return; }
    dica.textContent = 'Lendo o PDF…';
    VS.lerBoletoPdf(f).then(function (b) {
      if (!document.body.contains(el)) return;
      var v = document.getElementById('cn-valor'), d = document.getElementById('cn-venc'), achou = [];
      if (b && b.valor && v) { v.value = b.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); achou.push('o valor'); }
      if (b && b.vencimento && d) { d.value = b.vencimento; achou.push('o vencimento'); }
      dica.textContent = achou.length ? 'PDF anexado. Preenchi ' + achou.join(' e ') + ' pelo boleto: confira antes de enviar.' : 'PDF anexado. Não achei a linha do boleto nele; preencha o valor e o vencimento.';
    }, function () { if (document.body.contains(el)) dica.textContent = 'PDF anexado. Preencha o valor e o vencimento.'; });
  };
  VS.forms.contaNova = function (d) {
    d.valor = U.parseValor(d.valor);
    if (!d.descricao) throw new Error('Informe a descrição da conta.');
    if (!(d.valor > 0)) throw new Error('Informe o valor, por exemplo 1.250,00.');
    return S.addConta(d).then(function () {
      VS.state.sheet = null; VS.state.filtroContas = 'abertas'; VS.render();
      VS.toast('Conta enviada. O financeiro foi avisado.');
    });
  };

  // ----- pagamento extra a funcionário
  VS.acts['extra-novo'] = function () { VS.abrir({ tipo: 'extraNovo' }); };
  VS.sheets.extraNovo = function () {
    var contratos = opcoesContrato();
    if (!contratos) return { titulo: 'Pagamento a funcionário', html: SEM_CONTRATO };
    var pessoas = S.db.funcionarios.filter(function (f) { return !f.bloqueado; }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    var h = '<p class="nota">Para pagamentos fora da folha do mês. Vai para o financeiro como uma conta, e o funcionário é avisado quando for pago.</p>' +
      '<form data-form="extraNovo" class="form" novalidate>' +
      '<label class="campo" for="ex-func">Funcionário<select id="ex-func" name="funcionarioId"><option value="">Escolha o funcionário</option>';
    pessoas.forEach(function (f) { h += '<option value="' + f.id + '">' + e(f.nome) + '</option>'; });
    h += '</select></label>' +
      '<label class="campo" for="ex-motivo">Motivo<select id="ex-motivo" name="descricao">';
    MOTIVOS.forEach(function (m) { h += '<option>' + e(m) + '</option>'; });
    h += '</select></label>' +
      '<label class="campo" for="ex-obs">Detalhe (opcional)<input id="ex-obs" name="obs" type="text" maxlength="300" placeholder="Ex.: 8 horas no sábado"></label>' +
      '<div class="dupla">' +
      '<label class="campo" for="ex-valor">Valor<input id="ex-valor" name="valor" type="text" inputmode="decimal" placeholder="0,00"></label>' +
      '<label class="campo" for="ex-venc">Pagar até<input id="ex-venc" name="vencimento" type="date" value="' + S.db.hoje + '"></label>' +
      '</div>' +
      '<label class="campo" for="ex-contrato">Contrato<select id="ex-contrato" name="contratoId">' + contratos + '</select></label>' +
      '<label class="campo" for="ex-anexo">PDF ou foto (opcional)<input id="ex-anexo" name="anexo" type="file" accept="application/pdf,image/*"></label>' +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-cheio">Enviar ao financeiro</button></form>';
    return { titulo: 'Pagamento a funcionário', html: h };
  };
  VS.forms.extraNovo = function (d) {
    d.tipo = 'extra';
    d.valor = U.parseValor(d.valor);
    if (!d.funcionarioId) throw new Error('Escolha o funcionário que vai receber.');
    if (!(d.valor > 0)) throw new Error('Informe o valor, por exemplo 180,00.');
    return S.addConta(d).then(function () {
      VS.state.sheet = null; VS.state.filtroContas = 'abertas'; VS.render();
      VS.toast('Pagamento enviado. O financeiro foi avisado.');
    });
  };

  // ----- pagar e desfazer
  VS.acts['conta-pagar'] = function (el) { VS.abrir({ tipo: 'contaPagar', id: el.getAttribute('data-id') }); };
  VS.sheets.contaPagar = function (s) {
    var c = S.porId(S.db.contas, s.id);
    if (!c) return { titulo: 'Marcar como pago', html: '<p class="vazio">Lançamento não encontrado.</p>' };
    var h = '<div class="resumo"><strong>' + e(tituloDe(c)) + '</strong><span class="num">' + U.brl(c.valor) + '</span><span class="sub">' + quando(c) + '</span></div>' +
      '<form data-form="contaPagar" class="form" novalidate><input type="hidden" name="id" value="' + c.id + '">' +
      '<label class="campo" for="cp-comp">Comprovante em PDF ou foto (opcional)<input id="cp-comp" name="comprovante" type="file" accept="application/pdf,image/*"></label>' +
      (c.recorrente ? '<p class="nota">Esta conta repete todo mês. Ao confirmar, a de ' + U.dataBR(VS.datas.proximoVenc(c.vencimento, c.diaBase)) + ' é criada.</p>' : '') +
      (ehExtra(c) ? '<p class="nota">Ao confirmar, ' + e(U.primeiroNome(c.funcionarioNome || '')) + ' recebe um aviso de que o pagamento foi feito.</p>' : '') +
      '<p class="form-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-ok">' + U.ic('check', 20) + '<span>Confirmar pagamento</span></button></form>';
    return { titulo: ehExtra(c) ? 'Marcar como pago' : 'Marcar como paga', html: h };
  };
  VS.forms.contaPagar = function (d) {
    return S.pagarConta(d.id, d.comprovante).then(function (r) {
      VS.state.sheet = null; VS.render();
      VS.toast(r && r.proxima ? 'Paga. A conta de ' + U.dataCurta(r.proxima.vencimento) + ' já foi criada.' : 'Pagamento registrado.');
    });
  };
  VS.acts['conta-desfazer'] = function (el) {
    S.desfazerPagamento(el.getAttribute('data-id')).then(function () { VS.render(); VS.toast('Pagamento desfeito.'); }, VS.falha);
  };

  // ----- detalhes
  VS.acts['conta-detalhe'] = function (el) { VS.abrir({ tipo: 'contaDetalhe', id: el.getAttribute('data-id') }); };
  VS.sheets.contaDetalhe = function (s) {
    var c = S.porId(S.db.contas, s.id), u = S.me();
    if (!c) return { titulo: 'Detalhes', html: '<p class="vazio">Lançamento não encontrado.</p>' };
    var st = U.statusConta(c), extra = ehExtra(c), anexos = anexosDe(c);
    var h = '<div class="resumo"><strong>' + e(tituloDe(c)) + '</strong><span class="num">' + U.brl(c.valor) + '</span>' + selo(st) + '</div>' +
      '<dl class="dados">' +
      (extra ? '<div><dt>Funcionário</dt><dd>' + e(c.funcionarioNome || U.nomeDe(c.funcionarioId)) + '</dd></div><div><dt>Motivo</dt><dd>' + e(c.descricao) + '</dd></div>' : '') +
      (extra && c.obs ? '<div><dt>Detalhe</dt><dd>' + e(c.obs) + '</dd></div>' : '') +
      '<div><dt>' + (extra ? 'Pagar até' : 'Vencimento') + '</dt><dd>' + U.dataBR(c.vencimento) + '</dd></div>' +
      '<div><dt>Contrato</dt><dd>' + e(U.contratoDe(c.contratoId)) + '</dd></div>' +
      (extra ? '' : '<div><dt>Repete</dt><dd>' + (c.recorrente ? 'Todo mês' : 'Não') + '</dd></div>') +
      '<div><dt>' + (extra ? 'Enviado por' : 'Enviada por') + '</dt><dd>' + e(U.quem(c, 'enviadoPor')) + ', ' + U.dataHora(c.enviadoEm) + '</dd></div>' +
      (c.pagoEm ? '<div><dt>' + (extra ? 'Pago por' : 'Paga por') + '</dt><dd>' + e(U.quem(c, 'pagoPor')) + ', ' + U.dataHora(c.pagoEm) + '</dd></div>' : '') +
      '</dl><div class="conta-anexos">' + (anexos || '<span class="sub">Nenhum arquivo anexado</span>') + '</div>';
    if ((u.papel === 'rh' || u.papel === 'admin') && !c.pagoEm) {
      h += s.confirmar
        ? '<div class="perigo"><p>Excluir este lançamento? Isso não pode ser desfeito.</p><div class="linha-botoes"><button type="button" class="btn btn-perigo" data-act="conta-excluir" data-id="' + c.id + '">Excluir</button><button type="button" class="btn btn-borda" data-act="conta-excluir-nao">Manter</button></div></div>'
        : '<button type="button" class="link link-perigo" data-act="conta-excluir-pedir">Excluir este lançamento</button>';
    }
    return { titulo: extra ? 'Pagamento a funcionário' : 'Detalhes da conta', html: h };
  };
  VS.acts['conta-excluir-pedir'] = function () { VS.state.sheet.confirmar = true; VS.render(); };
  VS.acts['conta-excluir-nao'] = function () { VS.state.sheet.confirmar = false; VS.render(); };
  VS.acts['conta-excluir'] = function (el) {
    S.excluirConta(el.getAttribute('data-id')).then(function () { VS.state.sheet = null; VS.render(); VS.toast('Lançamento excluído.'); }, VS.falha);
  };

  // =====================================================================
  // Contratos: custo por contrato no mês
  // =====================================================================
  VS.titulos.contratos = 'Custo por contrato';
  VS.views.contratos = function () {
    var u = S.me(), mes = VS.state.mesRel, linhas = [], tp = 0, ta = 0;
    S.db.contratos.forEach(function (k) {
      var pago = 0, aberto = 0, n = 0;
      S.db.contas.forEach(function (c) {
        if (c.contratoId !== k.id || c.vencimento.slice(0, 7) !== mes) return;
        n += 1; if (c.pagoEm) pago += c.valor; else aberto += c.valor;
      });
      if (n || k.ativo) linhas.push({ k: k, pago: pago, aberto: aberto, n: n });
      tp += pago; ta += aberto;
    });
    var h = '<div class="mes-nav"><button type="button" class="btn-ic" data-act="rel-mes" data-passo="-1" aria-label="Mês anterior">' + U.ic('voltar') + '</button>' +
      '<h2>' + U.mesNomeCap(mes) + '</h2>' +
      '<button type="button" class="btn-ic" data-act="rel-mes" data-passo="1" aria-label="Próximo mês">' + U.ic('seta') + '</button></div>' +
      '<p class="sub">Contas com vencimento no mês, separadas por contrato.</p>' +
      '<div class="cartao tabela-caixa"><table class="tabela"><thead><tr><th scope="col">Contrato</th><th scope="col" class="dir">Pago</th><th scope="col" class="dir">Em aberto</th><th scope="col" class="dir">Total</th></tr></thead><tbody>';
    linhas.forEach(function (l) {
      h += '<tr><th scope="row">' + e(l.k.nome) + (l.k.ativo ? '' : ' <span class="etq">inativo</span>') + '</th><td class="dir num">' + U.brl(l.pago) + '</td><td class="dir num">' + U.brl(l.aberto) + '</td><td class="dir num"><strong>' + U.brl(l.pago + l.aberto) + '</strong></td></tr>';
    });
    h += '</tbody><tfoot><tr><th scope="row">Total do mês</th><td class="dir num">' + U.brl(tp) + '</td><td class="dir num">' + U.brl(ta) + '</td><td class="dir num"><strong>' + U.brl(tp + ta) + '</strong></td></tr></tfoot></table></div>';

    if (u.papel === 'admin') {
      h += '<h2 class="secao">Contratos cadastrados</h2><ul class="cartoes">';
      S.db.contratos.forEach(function (k) {
        h += '<li class="cartao linha-item"><span><strong>' + e(k.nome) + '</strong><span class="sub">' + (k.ativo ? 'Ativo: aparece ao lançar contas' : 'Inativo: não aparece ao lançar contas') + '</span></span>' +
          '<button type="button" class="btn btn-borda btn-p" data-act="contrato-ativo" data-id="' + k.id + '" data-ativo="' + (k.ativo ? '0' : '1') + '">' + (k.ativo ? 'Desativar' : 'Ativar') + '</button></li>';
      });
      h += '</ul><form data-form="contratoNovo" class="form form-linha" novalidate>' +
        '<label class="campo" for="ct-nome">Novo contrato<input id="ct-nome" name="nome" type="text" placeholder="Ex.: Limpeza — nome do cliente"></label>' +
        '<button type="submit" class="btn btn-cheio">Adicionar</button><p class="form-erro" role="alert" hidden></p></form>';
    }
    return h;
  };
  VS.acts['rel-mes'] = function (el) { VS.state.mesRel = VS.datas.addMonthsYM(VS.state.mesRel, +el.getAttribute('data-passo')); VS.render(); };
  VS.acts['contrato-ativo'] = function (el) {
    S.setContratoAtivo(el.getAttribute('data-id'), el.getAttribute('data-ativo') === '1').then(VS.render, VS.falha);
  };
  VS.forms.contratoNovo = function (d) {
    return S.addContrato(d.nome).then(function () { VS.render(); VS.toast('Contrato adicionado.'); });
  };
})();
