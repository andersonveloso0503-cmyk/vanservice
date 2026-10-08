/* App Van Service — equipe, importação por planilha, contracheques em PDF, pedidos e Meu espaço. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store, U = VS.u, e = U.esc;

  // ---------- bibliotecas carregadas só quando precisam
  var LIBS = VS.libs || {
    pdfjs: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'],
    pdflib: ['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'],
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']
  };
  var carregadas = {};
  function script(url) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = url; s.onload = res;
      s.onerror = function () { rej(new Error('Não consegui carregar uma parte do app. Confira a internet e tente de novo.')); };
      document.head.appendChild(s);
    });
  }
  VS.carregar = function (nome) {
    if (!carregadas[nome]) {
      carregadas[nome] = LIBS[nome].reduce(function (p, url) { return p.then(function () { return script(url); }); }, Promise.resolve()).then(function () {
        if (nome === 'pdfjs' && window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfjs[1];
      });
      carregadas[nome].then(null, function () { carregadas[nome] = null; });
    }
    return carregadas[nome];
  };
  function lerBytes(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(new Uint8Array(r.result)); };
      r.onerror = function () { rej(new Error('Não consegui ler o arquivo.')); };
      r.readAsArrayBuffer(blob);
    });
  }

  function ultimoMesFolha() {
    var m = '';
    S.db.contracheques.forEach(function (c) { if (c.mes > m) m = c.mes; });
    return m || VS.datas.addMonthsYM(S.mesAtual, -1);
  }
  function acessoDe(f) {
    if (f.bloqueado) return { txt: 'Bloqueado', cls: 'ruim' };
    if (!U.ativo(f)) return { txt: 'Aguardando primeiro acesso', cls: 'atencao' };
    return { txt: 'Ativo', cls: 'bom' };
  }
  function folhaDe(f, mes) {
    var c = S.db.contracheques.filter(function (x) { return x.funcionarioId === f.id && x.mes === mes; })[0];
    if (!c) return { txt: 'Sem contracheque', cls: 'ruim' };
    if (c.confirmadoEm) return { txt: 'Recebido', cls: 'bom' };
    return { txt: 'Enviado', cls: 'neutro' };
  }

  // =====================================================================
  // Equipe (RH e administrador)
  // =====================================================================
  function listaEquipe() {
    var mes = ultimoMesFolha(), q = U.semAcento(VS.state.busca), qd = VS.state.busca.replace(/\D/g, '');
    var lista = S.db.funcionarios.filter(function (f) {
      if (!q) return true;
      return U.semAcento(f.nome).indexOf(q) >= 0 || (qd && f.cpf.indexOf(qd) >= 0);
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    if (!lista.length) return '<p class="vazio">Ninguém encontrado com essa busca.</p>';
    var h = '<ul class="cartoes">';
    lista.forEach(function (f) {
      var a = acessoDe(f), c = folhaDe(f, mes);
      h += '<li><button type="button" class="cartao pessoa" data-act="func-abrir" data-id="' + f.id + '">' +
        '<span class="pessoa-nome"><strong>' + e(f.nome) + '</strong><span class="sub num">' + U.cpfMask(f.cpf) + (f.papel !== 'funcionario' ? ' · ' + U.PAPEIS[f.papel] : '') + '</span></span>' +
        '<span class="pessoa-est"><span class="est est-' + a.cls + '">' + a.txt + '</span>' + (f.papel === 'admin' ? '' : '<span class="est est-' + c.cls + '">' + c.txt + '</span>') + '</span>' +
        '</button></li>';
    });
    return h + '</ul>';
  }
  VS.views.equipe = function () {
    var mes = ultimoMesFolha();
    return '<div class="acoes-topo">' +
      '<button type="button" class="btn btn-cheio" data-act="import-abrir">' + U.ic('enviar', 20) + '<span>Importar planilha</span></button>' +
      '<button type="button" class="btn btn-cheio" data-act="folha-abrir">' + U.ic('arquivo', 20) + '<span>Enviar contracheques</span></button></div>' +
      '<label class="busca" for="eq-busca">' + U.ic('busca', 20) + '<span class="so-leitor">Buscar por nome ou CPF</span><input id="eq-busca" type="search" placeholder="Buscar por nome ou CPF" value="' + e(VS.state.busca) + '" data-input="equipe-busca"></label>' +
      '<p class="sub">' + S.db.funcionarios.length + ' pessoas · situação do contracheque de ' + U.mesNome(mes) + '</p>' +
      '<div id="eq-lista">' + listaEquipe() + '</div>';
  };
  VS.changes['equipe-busca'] = function (el) {
    VS.state.busca = el.value;
    var box = document.getElementById('eq-lista');
    if (box) box.innerHTML = listaEquipe();
  };

  // ----- ficha do funcionário
  VS.acts['func-abrir'] = function (el) { VS.abrir({ tipo: 'func', id: el.getAttribute('data-id') }); };
  VS.sheets.func = function (s) {
    var f = S.porId(S.db.funcionarios, s.id), u = S.me();
    if (!f) return { titulo: 'Funcionário', html: '<p class="vazio">Funcionário não encontrado.</p>' };
    var a = acessoDe(f), mes = S.mesAtual;
    var vt = S.db.vt.filter(function (v) { return v.funcionarioId === f.id && v.mes === mes; })[0];
    var creditado = vt && vt.status === 'creditado';
    var h = '<div class="resumo"><strong>' + e(f.nome) + '</strong><span class="sub num">CPF ' + U.cpfFmt(f.cpf) + '</span><span class="est est-' + a.cls + '">' + a.txt + '</span></div>';

    if (!U.ativo(f) && f.papel === 'funcionario') {
      h += '<section class="bloco"><h3>Primeiro acesso</h3><p class="nota">' + e(U.primeiroNome(f.nome)) + ' ainda não criou a senha. Basta abrir o app, tocar em "Primeiro acesso" e digitar o CPF e o nome.</p></section>';
    } else if (f.codigo) {
      h += '<section class="bloco"><h3>Código de primeiro acesso</h3><div class="codigo"><span class="num" id="func-codigo">' + e(U.codigoFmt(f.codigo)) + '</span>' +
        '<button type="button" class="btn btn-borda btn-p" data-act="copiar" data-texto="' + e(U.codigoFmt(f.codigo)) + '">' + U.ic('copiar', 18) + '<span>Copiar</span></button></div>' +
        '<p class="nota">Entregue este código só para ' + e(U.primeiroNome(f.nome)) + '. Ele vale uma vez, para criar a senha.</p></section>';
    } else if (f.id !== u.id && (f.papel === 'funcionario' || u.papel === 'admin')) {
      h += '<section class="bloco"><h3>Senha</h3><button type="button" class="btn btn-borda" data-act="func-codigo" data-id="' + f.id + '">' + (f.papel === 'funcionario' ? 'Esqueceu a senha? Liberar novo cadastro' : 'Esqueceu a senha? Gerar novo código') + '</button></section>';
    }

    if (f.papel !== 'admin') {
      h += '<section class="bloco"><h3>Vale-transporte de ' + U.mesNome(mes) + '</h3><div class="linha-botoes"><span class="est est-' + (creditado ? 'bom' : 'atencao') + '">' + (creditado ? 'Creditado' : 'Pendente') + '</span>' +
        '<button type="button" class="btn btn-borda btn-p" data-act="func-vt" data-id="' + f.id + '" data-status="' + (creditado ? 'pendente' : 'creditado') + '">' + (creditado ? 'Voltar para pendente' : 'Marcar como creditado') + '</button></div></section>';

      h += '<section class="bloco"><h3>Férias</h3><form data-form="funcFerias" class="form" novalidate><input type="hidden" name="id" value="' + f.id + '"><div class="dupla">' +
        '<label class="campo" for="ff-saldo">Saldo em dias<input id="ff-saldo" name="feriasSaldo" type="number" min="0" max="60" inputmode="numeric" value="' + (f.feriasSaldo || 0) + '"></label>' +
        '<label class="campo" for="ff-limite">Tirar até<input id="ff-limite" name="feriasLimite" type="date" value="' + e(f.feriasLimite || '') + '"></label></div>' +
        '<p class="form-erro" role="alert" hidden></p><button type="submit" class="btn btn-borda">Salvar férias</button></form></section>';

      var folhas = S.db.contracheques.filter(function (c) { return c.funcionarioId === f.id; }).sort(function (x, y) { return x.mes < y.mes ? 1 : -1; });
      h += '<section class="bloco"><h3>Contracheques</h3>';
      if (!folhas.length) h += '<p class="sub">Nenhum contracheque enviado.</p>';
      else {
        h += '<ul class="lista-simples">';
        folhas.forEach(function (c) {
          h += '<li><span>' + U.mesNomeCap(c.mes) + '</span><span class="est est-' + (c.confirmadoEm ? 'bom' : 'neutro') + '">' + (c.confirmadoEm ? 'Recebido em ' + U.dataHora(c.confirmadoEm) : 'Enviado, sem confirmação') + '</span></li>';
        });
        h += '</ul>';
      }
      h += '</section>';
    }

    if (u.papel === 'admin' && f.id !== u.id) {
      h += '<section class="bloco"><h3>Perfil de acesso</h3><label class="campo" for="func-papel"><span class="so-leitor">Perfil de acesso</span><select id="func-papel" data-change="func-papel" data-id="' + f.id + '">';
      ['funcionario', 'rh', 'financeiro', 'admin'].forEach(function (p) { h += '<option value="' + p + '"' + (f.papel === p ? ' selected' : '') + '>' + U.PAPEIS[p] + '</option>'; });
      h += '</select></label><button type="button" class="btn ' + (f.bloqueado ? 'btn-borda' : 'btn-perigo-borda') + '" data-act="func-bloquear" data-id="' + f.id + '" data-bloq="' + (f.bloqueado ? '0' : '1') + '">' + (f.bloqueado ? 'Liberar acesso' : 'Bloquear acesso') + '</button></section>';
    }
    return { titulo: 'Funcionário', html: h };
  };
  VS.acts.copiar = function (el) {
    var t = el.getAttribute('data-texto');
    try {
      navigator.clipboard.writeText(t).then(function () { VS.toast('Copiado.'); }, function () { VS.toast('Não consegui copiar. Selecione o texto e copie.', 'erro'); });
    } catch (err) { VS.toast('Não consegui copiar. Selecione o texto e copie.', 'erro'); }
  };
  VS.acts['func-codigo'] = function (el) {
    var f = S.porId(S.db.funcionarios, el.getAttribute('data-id')), func = f && f.papel === 'funcionario';
    S.novoCodigo(el.getAttribute('data-id')).then(function () {
      VS.render();
      VS.toast(func ? 'Senha apagada. A pessoa cria outra em "Primeiro acesso", com CPF e nome.' : 'Novo código gerado. A senha antiga deixou de valer.');
    }, VS.falha);
  };
  VS.acts['func-vt'] = function (el) {
    S.setVT(el.getAttribute('data-id'), S.mesAtual, el.getAttribute('data-status')).then(function () { VS.render(); }, VS.falha);
  };
  VS.forms.funcFerias = function (d) {
    return S.atualizarFuncionario(d.id, { feriasSaldo: d.feriasSaldo, feriasLimite: d.feriasLimite }).then(function () { VS.render(); VS.toast('Férias atualizadas.'); });
  };
  VS.changes['func-papel'] = function (el) {
    S.atualizarFuncionario(el.getAttribute('data-id'), { papel: el.value }).then(function () { VS.render(); VS.toast('Perfil de acesso alterado.'); }, function (err) { VS.render(); VS.falha(err); });
  };
  VS.acts['func-bloquear'] = function (el) {
    var bloq = el.getAttribute('data-bloq') === '1';
    S.atualizarFuncionario(el.getAttribute('data-id'), { bloqueado: bloq }).then(function () { VS.render(); VS.toast(bloq ? 'Acesso bloqueado.' : 'Acesso liberado.'); }, VS.falha);
  };

  // =====================================================================
  // Importar funcionários por planilha
  // =====================================================================
  VS.acts['import-abrir'] = function () { VS.abrir({ tipo: 'importar', passo: 1 }); };

  function linhasDeCsv(txt) {
    txt = txt.replace(/^﻿/, '');
    var prim = txt.split(/\r?\n/)[0] || '';
    var sep = (prim.split(';').length > prim.split(',').length) ? ';' : (prim.indexOf('\t') >= 0 ? '\t' : ',');
    return txt.split(/\r?\n/).map(function (l) {
      return l.split(sep).map(function (c) { return c.replace(/^\s*"?|"?\s*$/g, ''); });
    });
  }
  function interpretar(linhas) {
    linhas = linhas.filter(function (l) { return l && l.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    var iNome = -1, iCpf = -1, inicio = 0;
    // O cabeçalho pode não estar na primeira linha (planilhas com título em cima): procura nas 15 primeiras.
    for (var k = 0; k < Math.min(15, linhas.length) && inicio === 0; k++) {
      var cpfK = -1, nomeK = -1;
      linhas[k].forEach(function (c, i) {
        var t = U.semAcento(c);
        if (t.length > 40) return;
        if (cpfK < 0 && t.indexOf('CPF') >= 0) cpfK = i;
        else if (nomeK < 0 && (t.indexOf('NOME') >= 0 || t.indexOf('FUNCIONARIO') >= 0 || t.indexOf('COLABORADOR') >= 0 || t.indexOf('TRABALHADOR') >= 0)) nomeK = i;
      });
      if (cpfK >= 0 && nomeK >= 0) { iCpf = cpfK; iNome = nomeK; inicio = k + 1; }
    }
    if (iCpf < 0 || iNome < 0) { // sem cabeçalho: descobre pelas colunas
      var amostra = linhas[inicio] || [];
      amostra.forEach(function (c, i) {
        var d = String(c == null ? '' : c).replace(/\D/g, '');
        if (iCpf < 0 && d.length >= 9 && d.length <= 11 && !/[a-zA-Z]/.test(String(c))) iCpf = i;
      });
      amostra.forEach(function (c, i) { if (iNome < 0 && i !== iCpf && /[a-zA-ZÀ-ú]{2,}/.test(String(c))) iNome = i; });
    }
    if (iCpf < 0 || iNome < 0) throw new Error('Não encontrei as colunas de nome e CPF. Use uma planilha com uma coluna "Nome" e outra "CPF".');
    var bons = [], ruins = [], vistos = {};
    linhas.slice(inicio).forEach(function (l, n) {
      var nome = String(l[iNome] == null ? '' : l[iNome]).replace(/\s+/g, ' ').trim();
      var bruto = String(l[iCpf] == null ? '' : l[iCpf]).trim();
      var d = bruto.replace(/\D/g, '');
      if (d.length >= 9 && d.length < 11) d = ('00' + d).slice(-11); // Excel corta zeros à esquerda
      var linha = n + inicio + 1;
      if (!nome && !d) return; // linhas de total ou observação no fim da planilha
      if (!nome) { ruins.push({ linha: linha, nome: '(sem nome)', motivo: 'Falta o nome' }); return; }
      if (!VS.cpf.valido(d)) { ruins.push({ linha: linha, nome: nome, motivo: bruto ? 'CPF inválido: ' + bruto : 'Falta o CPF' }); return; }
      if (vistos[d]) { ruins.push({ linha: linha, nome: nome, motivo: 'CPF repetido na planilha' }); return; }
      vistos[d] = true; bons.push({ nome: nome, cpf: d });
    });
    return { bons: bons, ruins: ruins, vistos: vistos };
  }
  function lerPlanilha(arq) {
    if (/\.csv$|\.txt$/i.test(arq.nome) || arq.tipo === 'text/csv') {
      return lerBytes(arq.blob).then(function (b) {
        var txt;
        try { txt = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (err) { txt = new TextDecoder('windows-1252').decode(b); }
        return interpretar(linhasDeCsv(txt));
      });
    }
    return VS.carregar('xlsx').then(function () { return lerBytes(arq.blob); }).then(function (b) {
      var wb = window.XLSX.read(b, { type: 'array' });
      var aba = wb.Sheets[wb.SheetNames[0]];
      return interpretar(window.XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: '' }));
    });
  }

  VS.sheets.importar = function (s) {
    var h;
    if (s.passo === 1) {
      h = '<p class="nota">A planilha precisa de duas colunas: <strong>Nome</strong> e <strong>CPF</strong>. Aceita Excel (.xlsx) ou CSV. Quem já está cadastrado não é duplicado.</p>' +
        '<form data-form="importarLer" class="form" novalidate>' +
        '<label class="campo" for="imp-arq">Planilha<input id="imp-arq" name="arquivo" type="file" accept=".xlsx,.xls,.csv,text/csv"></label>' +
        '<p class="form-erro" role="alert" hidden></p>' +
        '<button type="submit" class="btn btn-cheio">Conferir planilha</button></form>';
      return { titulo: 'Importar funcionários', html: h };
    }
    var r = s.resultado, novos = [], ja = 0;
    r.bons.forEach(function (l) {
      if (S.db.funcionarios.some(function (f) { return f.cpf === l.cpf; })) ja += 1; else novos.push(l);
    });
    var eu = S.me().id;
    var ausentes = S.db.funcionarios.filter(function (f) { return f.papel !== 'admin' && f.id !== eu && !f.bloqueado && !r.vistos[f.cpf]; });
    // Só sugere o bloqueio quando a planilha parece ser a lista completa (traz mais gente já cadastrada do que deixa de fora).
    var listaCompleta = ja > ausentes.length;
    h = '<ul class="resumo-lista"><li><strong class="num">' + novos.length + '</strong> novos funcionários</li><li><strong class="num">' + ja + '</strong> já cadastrados</li><li><strong class="num">' + r.ruins.length + '</strong> linhas com problema</li></ul>';
    if (novos.length) {
      h += '<h3>Novos</h3><ul class="lista-simples">';
      novos.slice(0, 30).forEach(function (l) { h += '<li><span>' + e(l.nome) + '</span><span class="sub num">' + U.cpfMask(l.cpf) + '</span></li>'; });
      if (novos.length > 30) h += '<li><span class="sub">e mais ' + (novos.length - 30) + '</span></li>';
      h += '</ul>';
    }
    if (r.ruins.length) {
      h += '<h3>Linhas que não entram</h3><ul class="lista-simples">';
      r.ruins.slice(0, 30).forEach(function (l) { h += '<li><span>Linha ' + l.linha + ': ' + e(l.nome) + '</span><span class="est est-ruim">' + e(l.motivo) + '</span></li>'; });
      h += '</ul>';
    }
    h += '<form data-form="importarConfirmar" class="form" novalidate>';
    if (ausentes.length) {
      h += '<label class="marcar" for="imp-bloq"><input id="imp-bloq" name="bloquear" type="checkbox"' + (listaCompleta ? ' checked' : '') + '><span>Bloquear quem não está na planilha<small>' + ausentes.length + (ausentes.length === 1 ? ' pessoa perde' : ' pessoas perdem') + ' o acesso: ' + e(ausentes.map(function (f) { return f.nome; }).join(', ')) + '. ' + (listaCompleta ? 'Desmarque se esta planilha traz só gente nova.' : 'Marque só se esta planilha é a lista completa da empresa.') + '</small></span></label>';
    }
    h += '<p class="form-erro" role="alert" hidden></p><button type="submit" class="btn btn-cheio">Confirmar importação</button>' +
      '<button type="button" class="link link-centro" data-act="import-abrir">Escolher outra planilha</button></form>';
    return { titulo: 'Conferir importação', html: h };
  };
  VS.forms.importarLer = function (d) {
    if (!d.arquivo) throw new Error('Escolha a planilha.');
    return lerPlanilha(d.arquivo).then(function (r) {
      if (!r.bons.length && !r.ruins.length) throw new Error('A planilha está vazia.');
      VS.abrir({ tipo: 'importar', passo: 2, resultado: r });
    });
  };
  VS.forms.importarConfirmar = function (d) {
    var r = VS.state.sheet.resultado;
    return S.importarFuncionarios(r.bons, !!d.bloquear).then(function (x) {
      VS.state.sheet = null; VS.render();
      VS.toast(x.novos + ' novos, ' + x.atualizados + ' atualizados' + (x.bloqueados ? ', ' + x.bloqueados + ' bloqueados' : '') + '.');
    });
  };

  // =====================================================================
  // Contracheques: um PDF só, separado por funcionário
  // =====================================================================
  VS.acts['folha-abrir'] = function () { VS.abrir({ tipo: 'folha', passo: 1 }); };

  function textosDoPdf(bytes) {
    return window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise.then(function (doc) {
      var saida = [], p = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) {
        (function (n) {
          p = p.then(function () { return doc.getPage(n); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            saida.push(tc.items.map(function (it) { return it.str; }).join(' '));
          });
        })(i);
      }
      return p.then(function () { return saida; });
    });
  }
  // Lê o texto do PDF de uma conta e procura a linha do boleto (valor e vencimento).
  VS.lerBoletoPdf = function (blob) {
    return VS.carregar('pdfjs').then(function () { return lerBytes(blob); }).then(textosDoPdf).then(function (textos) {
      return VS.boleto.ler(textos.join('\n'), S.db.hoje);
    });
  };
  function separarPdf(bytes, mes) {
    return VS.carregar('pdfjs').then(function () { return VS.carregar('pdflib'); }).then(function () { return textosDoPdf(bytes); }).then(function (textos) {
      var pessoas = S.db.funcionarios.filter(function (f) { return f.papel !== 'admin' && !f.bloqueado; });
      var porCpf = {}, grupos = {}, semDono = [];
      pessoas.forEach(function (f) { porCpf[f.cpf] = f; });
      var nomes = pessoas.map(function (f) { return { f: f, n: U.semAcento(f.nome) }; }).sort(function (a, b) { return b.n.length - a.n.length; });
      textos.forEach(function (t, i) {
        var dono = null, m, re = /\d{3}\.?\d{3}\.?\d{3}\s?-?\s?\d{2}/g;
        while (!dono && (m = re.exec(t))) { var d = m[0].replace(/\D/g, ''); if (porCpf[d]) dono = porCpf[d]; }
        if (!dono) { var tn = U.semAcento(t); for (var k = 0; k < nomes.length && !dono; k++) if (nomes[k].n.length > 5 && tn.indexOf(nomes[k].n) >= 0) dono = nomes[k].f; }
        if (dono) (grupos[dono.id] = grupos[dono.id] || []).push(i); else semDono.push(i + 1);
      });
      return window.PDFLib.PDFDocument.load(bytes).then(function (origem) {
        var itens = [], p = Promise.resolve();
        Object.keys(grupos).forEach(function (id) {
          p = p.then(function () { return window.PDFLib.PDFDocument.create(); }).then(function (novo) {
            return novo.copyPages(origem, grupos[id]).then(function (pgs) { pgs.forEach(function (pg) { novo.addPage(pg); }); return novo.save(); });
          }).then(function (out) {
            var blob = new Blob([out], { type: 'application/pdf' });
            itens.push({ funcionarioId: id, paginas: grupos[id].length, arquivo: U.registrar({ nome: 'contracheque-' + mes + '.pdf', tipo: 'application/pdf', url: URL.createObjectURL(blob), blob: blob }) });
          });
        });
        return p.then(function () {
          var faltam = pessoas.filter(function (f) { return !grupos[f.id]; });
          return { itens: itens, semDono: semDono, faltam: faltam, total: textos.length };
        });
      });
    });
  }
  function pdfDeExemplo(mes) {
    return VS.carregar('pdflib').then(function () { return window.PDFLib.PDFDocument.create(); }).then(function (doc) {
      return doc.embedFont(window.PDFLib.StandardFonts.Helvetica).then(function (fonte) {
        var pessoas = S.db.funcionarios.filter(function (f) { return f.papel !== 'admin' && !f.bloqueado; });
        pessoas.slice(0, Math.max(1, pessoas.length - 1)).forEach(function (f) {
          var pg = doc.addPage([595, 842]);
          pg.drawText('RECIBO DE PAGAMENTO DE SALARIO (EXEMPLO)', { x: 50, y: 780, size: 14, font: fonte });
          pg.drawText('Van Service - referencia ' + mes, { x: 50, y: 755, size: 11, font: fonte });
          pg.drawText('Funcionario: ' + U.semAcento(f.nome), { x: 50, y: 720, size: 12, font: fonte });
          pg.drawText('CPF: ' + U.cpfFmt(f.cpf), { x: 50, y: 700, size: 12, font: fonte });
          pg.drawText('Documento de exemplo, sem valores reais.', { x: 50, y: 660, size: 11, font: fonte });
        });
        var resumo = doc.addPage([595, 842]);
        resumo.drawText('RESUMO DA FOLHA (EXEMPLO)', { x: 50, y: 780, size: 14, font: fonte });
        resumo.drawText('Pagina sem funcionario, para mostrar como o app avisa.', { x: 50, y: 755, size: 11, font: fonte });
        return doc.save();
      });
    });
  }

  VS.sheets.folha = function (s) {
    var h;
    if (s.passo === 1) {
      var mesPadrao = VS.datas.addMonthsYM(S.mesAtual, -1);
      h = '<p class="nota">Envie o PDF único com todos os contracheques. O app encontra o CPF (ou o nome) em cada página e separa um arquivo para cada funcionário. O PDF é lido neste aparelho.</p>' +
        '<form data-form="folhaLer" class="form" novalidate>' +
        '<label class="campo" for="fo-mes">Mês de referência<input id="fo-mes" name="mes" type="month" value="' + mesPadrao + '"></label>' +
        '<label class="campo" for="fo-arq">PDF dos contracheques<input id="fo-arq" name="arquivo" type="file" accept="application/pdf,.pdf"></label>' +
        '<p class="form-erro" role="alert" hidden></p>' +
        '<button type="submit" class="btn btn-cheio">Separar por funcionário</button>' +
        (S.demo ? '<button type="submit" class="btn btn-borda" name="exemplo" value="1" data-act="folha-exemplo">Testar com um PDF de exemplo</button>' : '') +
        '</form>';
      return { titulo: 'Enviar contracheques', html: h };
    }
    if (s.passo === 2) return { titulo: 'Enviar contracheques', html: '<p class="vazio" role="status">Lendo o PDF e separando as páginas…</p>' };
    var r = s.resultado;
    h = '<ul class="resumo-lista"><li><strong class="num">' + r.itens.length + '</strong> funcionários encontrados</li><li><strong class="num">' + r.faltam.length + '</strong> sem contracheque no PDF</li><li><strong class="num">' + r.semDono.length + '</strong> páginas sem dono</li></ul>' +
      '<p class="sub">Contracheques de ' + U.mesNome(s.mes) + ' · ' + r.total + ' páginas lidas</p>';
    if (r.itens.length) {
      h += '<h3>Encontrados</h3><ul class="lista-simples">';
      r.itens.forEach(function (it) {
        h += '<li><span>' + e(U.nomeDe(it.funcionarioId)) + '</span><button type="button" class="link" data-act="abrir-arquivo" data-arq="' + U.refArq(it.arquivo) + '" data-nome="' + e(U.nomeDe(it.funcionarioId)) + '">' + it.paginas + (it.paginas === 1 ? ' página' : ' páginas') + ' · conferir</button></li>';
      });
      h += '</ul>';
    }
    if (r.faltam.length) {
      h += '<h3>Não encontrados no PDF</h3><ul class="lista-simples">';
      r.faltam.forEach(function (f) { h += '<li><span>' + e(f.nome) + '</span><span class="est est-ruim">Sem página</span></li>'; });
      h += '</ul>';
    }
    if (r.semDono.length) h += '<p class="nota">Páginas sem funcionário identificado: ' + r.semDono.join(', ') + '. Elas não são enviadas a ninguém.</p>';
    h += '<form data-form="folhaPublicar" class="form" novalidate><p class="form-erro" role="alert" hidden></p>' +
      (r.itens.length ? '<button type="submit" class="btn btn-cheio">Publicar e avisar ' + r.itens.length + (r.itens.length === 1 ? ' funcionário' : ' funcionários') + '</button>' : '') +
      '<button type="button" class="link link-centro" data-act="folha-abrir">Escolher outro PDF</button></form>';
    return { titulo: 'Conferir contracheques', html: h };
  };
  var querExemplo = false;
  VS.acts['folha-exemplo'] = function () { querExemplo = true; };
  VS.forms.folhaLer = function (d) {
    var exemplo = querExemplo; querExemplo = false;
    if (!/^\d{4}-\d{2}$/.test(d.mes || '')) throw new Error('Escolha o mês de referência.');
    if (!exemplo && !d.arquivo) throw new Error('Escolha o PDF dos contracheques.');
    var mes = d.mes;
    VS.abrir({ tipo: 'folha', passo: 2 });
    var bytes = exemplo ? pdfDeExemplo(mes) : lerBytes(d.arquivo.blob);
    return bytes.then(function (b) { return separarPdf(b, mes); }).then(function (r) {
      VS.abrir({ tipo: 'folha', passo: 3, mes: mes, resultado: r });
    }, function (err) {
      VS.abrir({ tipo: 'folha', passo: 1 });
      VS.toast(err && err.message && /carregar|internet/.test(err.message) ? err.message : 'Não consegui ler esse PDF. Confira se o arquivo abre normalmente e não tem senha.', 'erro');
    });
  };
  VS.forms.folhaPublicar = function (d, form) {
    var s = VS.state.sheet, botao = form.querySelector('button[type=submit]');
    if (botao) { botao.disabled = true; botao.textContent = 'Publicando…'; }
    return S.publicarContracheques(s.mes, s.resultado.itens).then(function (n) {
      VS.state.sheet = null; VS.render();
      VS.toast(n + (n === 1 ? ' contracheque publicado.' : ' contracheques publicados.') + ' Os funcionários foram avisados.');
    }, function (err) { if (botao) { botao.disabled = false; botao.textContent = 'Tentar publicar de novo'; } throw err; });
  };

  // ----- leitor de PDF dentro do app
  VS.sheets.pdf = function (s) {
    return { titulo: s.nome || 'Documento', largo: true, html: '<div class="pdf-paginas" id="pdf-paginas"><p class="vazio" role="status">Abrindo o documento…</p></div>' };
  };
  VS.depois.pdf = function (s) {
    var alvo = document.getElementById('pdf-paginas');
    if (!alvo) return;
    VS.carregar('pdfjs').then(function () {
      if (VS.blobs[s.url]) return lerBytes(VS.blobs[s.url]);
      return fetch(s.url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
    }).then(function (bytes) {
      return window.pdfjsLib.getDocument({ data: bytes }).promise;
    }).then(function (doc) {
      if (VS.state.sheet !== s || !document.body.contains(alvo)) return;
      alvo.innerHTML = '';
      var p = Promise.resolve();
      for (var i = 1; i <= Math.min(doc.numPages, 20); i++) {
        (function (n) {
          p = p.then(function () { return doc.getPage(n); }).then(function (pg) {
            var largura = Math.max(280, Math.min(alvo.clientWidth || 600, 900));
            var base = pg.getViewport({ scale: 1 });
            var vp = pg.getViewport({ scale: (largura / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
            var cv = document.createElement('canvas');
            cv.width = vp.width; cv.height = vp.height; cv.className = 'pdf-pagina';
            cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Página ' + n);
            alvo.appendChild(cv);
            return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          });
        })(i);
      }
      return p;
    }).then(null, function () {
      if (document.body.contains(alvo)) alvo.innerHTML = '<p class="vazio">Não consegui abrir este documento aqui.</p>';
    });
  };

  // =====================================================================
  // Pedidos (RH e administrador): férias e documentos recebidos
  // =====================================================================
  var ST_PEDIDO = { pendente: ['Aguardando resposta', 'atencao'], aprovada: ['Aprovadas', 'bom'], recusada: ['Recusadas', 'ruim'] };
  VS.titulos.pedidos = 'Pedidos da equipe';
  VS.views.pedidos = function () {
    var ordem = { pendente: 0, aprovada: 1, recusada: 2 };
    var sol = S.db.solicitacoes.slice().sort(function (a, b) { return ordem[a.status] - ordem[b.status] || (a.criadoEm < b.criadoEm ? 1 : -1); });
    var h = '<h2 class="secao">Férias</h2>';
    if (!sol.length) h += '<p class="vazio">Nenhum pedido de férias.</p>';
    else {
      h += '<ul class="cartoes">';
      sol.forEach(function (s) {
        var fim = VS.datas.addDays(s.inicio, s.dias - 1), st = ST_PEDIDO[s.status];
        h += '<li class="cartao"><div class="conta-topo"><span class="conta-nome"><strong>' + e(U.quem(s, 'funcionario')) + '</strong><span class="sub">' + s.dias + ' dias, de ' + U.dataBR(s.inicio) + ' a ' + U.dataBR(fim) + '</span>' +
          (s.obs ? '<span class="sub">' + e(s.obs) + '</span>' : '') + '<span class="sub">Pedido em ' + U.dataHora(s.criadoEm) + '</span></span></div><div class="conta-pe">';
        if (s.status === 'pendente') {
          h += '<button type="button" class="btn btn-ok btn-p" data-act="pedido-decidir" data-id="' + s.id + '" data-status="aprovada">Aprovar</button>' +
            '<button type="button" class="btn btn-perigo-borda btn-p" data-act="pedido-decidir" data-id="' + s.id + '" data-status="recusada">Recusar</button>';
        } else {
          h += '<span class="est est-' + st[1] + '">' + st[0] + ' por ' + e(U.primeiroNome(U.quem(s, 'decididoPor'))) + '</span>';
        }
        h += '</div></li>';
      });
      h += '</ul>';
    }
    h += '<h2 class="secao">Documentos recebidos</h2>';
    if (!S.db.documentos.length) h += '<p class="vazio">Nenhum documento recebido.</p>';
    else {
      h += '<ul class="cartoes">';
      S.db.documentos.forEach(function (d) {
        h += '<li class="cartao"><div class="conta-topo"><span class="conta-nome"><strong>' + e(d.tipo) + ' · ' + e(U.quem(d, 'funcionario')) + '</strong>' +
          (d.obs ? '<span class="sub">' + e(d.obs) + '</span>' : '') + '<span class="sub">Enviado em ' + U.dataHora(d.criadoEm) + '</span></span></div><div class="conta-pe">' +
          (d.arquivo ? U.botaoArquivo(d.arquivo, 'Abrir') : '<span class="sub">Exemplo sem arquivo</span>') +
          (d.vistoEm ? '<span class="est est-bom">Visto por ' + e(U.primeiroNome(U.quem(d, 'vistoPor'))) + '</span>' : '<button type="button" class="btn btn-borda btn-p" data-act="doc-visto" data-id="' + d.id + '">Marcar como visto</button>') +
          '</div></li>';
      });
      h += '</ul>';
    }
    return h;
  };
  VS.acts['pedido-decidir'] = function (el) {
    var st = el.getAttribute('data-status');
    S.decidirSolicitacao(el.getAttribute('data-id'), st).then(function () { VS.render(); VS.toast(st === 'aprovada' ? 'Férias aprovadas. O funcionário foi avisado.' : 'Pedido recusado. O funcionário foi avisado.'); }, VS.falha);
  };
  VS.acts['doc-visto'] = function (el) { S.marcarDocumentoVisto(el.getAttribute('data-id')).then(function () { VS.render(); }, VS.falha); };

  // =====================================================================
  // Meu espaço (cada pessoa vê só o que é seu)
  // =====================================================================
  VS.views.meu = function () {
    var u = S.me(), mes = S.mesAtual;
    var folhas = S.db.contracheques.filter(function (c) { return c.funcionarioId === u.id; }).sort(function (a, b) { return a.mes < b.mes ? 1 : -1; });
    var h = '<section class="cartao bloco-cartao"><h2>Contracheques</h2>';
    if (!folhas.length) h += '<p class="sub">Nenhum contracheque disponível ainda.</p>';
    else {
      h += '<ul class="folhas">';
      folhas.forEach(function (c, i) {
        h += '<li class="folha' + (i === 0 ? ' folha-nova' : '') + '"><div class="folha-topo"><span><strong>' + U.mesNomeCap(c.mes) + '</strong><span class="sub">Disponível desde ' + U.dataCurta(c.enviadoEm) + '</span></span>' +
          '<button type="button" class="btn ' + (i === 0 ? 'btn-cheio' : 'btn-borda') + ' btn-p" data-act="abrir-arquivo" data-arq="' + U.refArq(c.arquivo) + '" data-nome="Contracheque de ' + U.mesNome(c.mes) + '">Abrir PDF</button></div>' +
          (c.confirmadoEm
            ? '<span class="est est-bom">' + U.ic('check', 16) + ' Recebido em ' + U.dataHora(c.confirmadoEm) + '</span>'
            : '<button type="button" class="btn btn-ok btn-p" data-act="folha-confirmar" data-id="' + c.id + '">' + U.ic('check', 18) + '<span>Confirmar que recebi</span></button>') +
          '</li>';
      });
      h += '</ul>';
    }
    h += '</section>';

    var vt = S.db.vt.filter(function (v) { return v.funcionarioId === u.id && v.mes === mes; })[0];
    var cred = vt && vt.status === 'creditado';
    h += '<section class="cartao bloco-cartao bloco-linha"><span class="bloco-ic">' + U.ic('onibus') + '</span><span class="bloco-txt"><h2>Vale-transporte</h2><span class="sub">' + U.mesNomeCap(mes) + '</span></span>' +
      '<span class="est est-' + (cred ? 'bom' : 'atencao') + '">' + (cred ? 'Creditado' : 'Ainda não creditado') + '</span></section>';

    var extras = S.meusPagamentos ? S.meusPagamentos() : [];
    if (extras.length) {
      h += '<section class="cartao bloco-cartao"><div class="bloco-linha"><span class="bloco-ic">' + U.ic('check') + '</span><span class="bloco-txt"><h2>Pagamentos extras</h2><span class="sub">Pagamentos feitos a você fora da folha</span></span></div><ul class="lista-simples">';
      extras.forEach(function (p) {
        h += '<li><span>' + e(p.descricao) + (p.obs ? '<span class="sub">' + e(p.obs) + '</span>' : '') + '<span class="sub">Pago em ' + U.dataHora(p.pagoEm) + '</span></span><strong class="num">' + U.brl(p.valor) + '</strong></li>';
      });
      h += '</ul></section>';
    }

    var meus = S.db.solicitacoes.filter(function (s) { return s.funcionarioId === u.id; });
    h += '<section class="cartao bloco-cartao"><div class="bloco-linha"><span class="bloco-ic">' + U.ic('calendario') + '</span><span class="bloco-txt"><h2>Férias</h2><span class="sub">Saldo: ' + (u.feriasSaldo || 0) + ' dias' + (u.feriasLimite ? ' · tirar até ' + U.dataBR(u.feriasLimite) : '') + '</span></span></div>';
    if (meus.length) {
      h += '<ul class="lista-simples">';
      meus.forEach(function (s) {
        var st = { pendente: ['Aguardando o RH', 'atencao'], aprovada: ['Aprovadas', 'bom'], recusada: ['Recusadas', 'ruim'] }[s.status];
        h += '<li><span>' + s.dias + ' dias a partir de ' + U.dataBR(s.inicio) + '</span><span class="est est-' + st[1] + '">' + st[0] + '</span></li>';
      });
      h += '</ul>';
    }
    h += '<button type="button" class="btn btn-borda" data-act="ferias-pedir"' + (u.feriasSaldo >= 5 ? '' : ' disabled') + '>Pedir férias</button></section>';

    var docs = S.db.documentos.filter(function (d) { return d.funcionarioId === u.id; });
    h += '<section class="cartao bloco-cartao"><div class="bloco-linha"><span class="bloco-ic">' + U.ic('enviar') + '</span><span class="bloco-txt"><h2>Atestados e documentos</h2><span class="sub">Envie a foto ou o PDF para o RH</span></span></div>';
    if (docs.length) {
      h += '<ul class="lista-simples">';
      docs.forEach(function (d) { h += '<li><span>' + e(d.tipo) + ' · ' + U.dataCurta(d.criadoEm) + '</span><span class="est est-' + (d.vistoEm ? 'bom' : 'neutro') + '">' + (d.vistoEm ? 'Visto pelo RH' : 'Enviado') + '</span></li>'; });
      h += '</ul>';
    }
    h += '<button type="button" class="btn btn-borda" data-act="doc-enviar">Enviar documento</button></section>';
    return h;
  };
  VS.acts['folha-confirmar'] = function (el) {
    S.confirmarContracheque(el.getAttribute('data-id')).then(function () { VS.render(); VS.toast('Recebimento registrado.'); }, VS.falha);
  };

  VS.acts['ferias-pedir'] = function () { VS.abrir({ tipo: 'feriasPedir' }); };
  VS.sheets.feriasPedir = function () {
    var u = S.me();
    return {
      titulo: 'Pedir férias',
      html: '<p class="nota">Você tem ' + (u.feriasSaldo || 0) + ' dias de saldo. O RH responde pelo app.</p>' +
        '<form data-form="feriasPedir" class="form" novalidate><div class="dupla">' +
        '<label class="campo" for="fp-inicio">Primeiro dia<input id="fp-inicio" name="inicio" type="date" min="' + VS.datas.addDays(S.db.hoje, 1) + '" autofocus></label>' +
        '<label class="campo" for="fp-dias">Quantos dias<input id="fp-dias" name="dias" type="number" inputmode="numeric" min="5" max="' + Math.min(30, u.feriasSaldo || 0) + '" placeholder="Ex.: 15"></label></div>' +
        '<label class="campo" for="fp-obs">Observação (opcional)<textarea id="fp-obs" name="obs" rows="2"></textarea></label>' +
        '<p class="form-erro" role="alert" hidden></p><button type="submit" class="btn btn-cheio">Enviar pedido ao RH</button></form>'
    };
  };
  VS.forms.feriasPedir = function (d) {
    return S.pedirFerias(d).then(function () { VS.state.sheet = null; VS.render(); VS.toast('Pedido enviado ao RH.'); });
  };

  VS.acts['doc-enviar'] = function () { VS.abrir({ tipo: 'docEnviar' }); };
  VS.sheets.docEnviar = function () {
    return {
      titulo: 'Enviar documento',
      html: '<form data-form="docEnviar" class="form" novalidate>' +
        '<label class="campo" for="de-tipo">Tipo<select id="de-tipo" name="tipo"><option>Atestado médico</option><option>Declaração de comparecimento</option><option>Comprovante de endereço</option><option>Outro documento</option></select></label>' +
        '<label class="campo" for="de-arq">Foto ou PDF<input id="de-arq" name="arquivo" type="file" accept="image/*,application/pdf"></label>' +
        '<label class="campo" for="de-obs">Observação (opcional)<textarea id="de-obs" name="obs" rows="2"></textarea></label>' +
        '<p class="form-erro" role="alert" hidden></p><button type="submit" class="btn btn-cheio">Enviar ao RH</button></form>'
    };
  };
  VS.forms.docEnviar = function (d) {
    return S.enviarDocumento(d).then(function () { VS.state.sheet = null; VS.render(); VS.toast('Documento enviado ao RH.'); });
  };
})();
