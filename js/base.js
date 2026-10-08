/* App Van Service — utilidades de data e CPF, usadas pela demonstração e pela versão real. */
(function () {
  'use strict';
  var VS = window.VS = window.VS || {};

  // ---------- datas e CPF
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(iso, n) { var p = iso.split('-'); return isoDate(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function addMonths(iso, n) {
    var p = iso.split('-').map(Number);
    var first = new Date(p[0], p[1] - 1 + n, 1);
    var last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return isoDate(new Date(first.getFullYear(), first.getMonth(), Math.min(p[2], last)));
  }
  function addMonthsYM(ym, n) { var p = ym.split('-').map(Number); var d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function agora() { var d = new Date(); return isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function cpfDigits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function cpfDV(b) {
    var s = 0, i;
    for (i = 0; i < 9; i++) s += +b[i] * (10 - i);
    var d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
    var c = b + d1; s = 0;
    for (i = 0; i < 10; i++) s += +c[i] * (11 - i);
    var d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
    return '' + d1 + d2;
  }
  function cpfValido(s) {
    var d = cpfDigits(s);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    return cpfDV(d.slice(0, 9)) === d.slice(9);
  }
  function limparCodigo(c) { return String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }
  // Próximo vencimento de uma conta mensal, mantendo o dia original (31 vira 28 em fevereiro e volta a 31 em março).
  function proximoVenc(venc, dia) {
    var p = venc.split('-').map(Number), prim = new Date(p[0], p[1], 1);
    var ult = new Date(prim.getFullYear(), prim.getMonth() + 1, 0).getDate();
    return isoDate(new Date(prim.getFullYear(), prim.getMonth(), Math.min(dia || p[2], ult)));
  }

  VS.datas = { isoDate: isoDate, addDays: addDays, addMonths: addMonths, addMonthsYM: addMonthsYM, agora: agora, proximoVenc: proximoVenc };
  VS.cpf = { digits: cpfDigits, valido: cpfValido, dv: cpfDV };
  VS.limparCodigo = limparCodigo;

  // Primeiro acesso sem código: o primeiro nome tem que ser igual ao do cadastro e cada
  // sobrenome digitado tem que existir nele (pode pular nomes do meio). Mesma regra do banco.
  function palavrasDoNome(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(Boolean);
  }
  VS.nomeConfere = function (cadastro, digitado) {
    var c = palavrasDoNome(cadastro), d = palavrasDoNome(digitado), sobrenomes = 0;
    if (!c.length || d.length < 2 || c[0] !== d[0]) return false;
    var resto = c.slice(1);
    for (var i = 1; i < d.length; i++) {
      if (resto.indexOf(d[i]) < 0) return false;
      if (['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].indexOf(d[i]) < 0) sobrenomes += 1;
    }
    return sobrenomes > 0;
  };

  // ---------- boleto: tira valor e vencimento da linha digitável que vem escrita no PDF
  function mod10(num) {
    var soma = 0, peso = 2;
    for (var i = num.length - 1; i >= 0; i--) { var p = +num[i] * peso; soma += p > 9 ? p - 9 : p; peso = peso === 2 ? 1 : 2; }
    return (10 - (soma % 10)) % 10;
  }
  // O "fator de vencimento" conta dias desde 07/10/1997 e recomeçou em 22/02/2025; fica a data mais próxima de hoje.
  function dataDoFator(fator, hojeISO) {
    if (!fator) return null;
    var h = (hojeISO || isoDate(new Date())).split('-').map(Number), hoje = new Date(h[0], h[1] - 1, h[2]);
    var a = new Date(1997, 9, 7 + fator), b = new Date(2022, 4, 29 + fator);
    return isoDate(Math.abs(a - hoje) <= Math.abs(b - hoje) ? a : b);
  }
  function lerBoleto(texto, hojeISO) {
    texto = String(texto || '');
    var m, re = /(^|\D)(\d{5})[.\s]?(\d{5})\s*(\d{5})[.\s]?(\d{6})\s*(\d{5})[.\s]?(\d{6})\s*(\d)\s*(\d{14})(?!\d)/g;
    while ((m = re.exec(texto))) {
      var c1 = m[2] + m[3], c2 = m[4] + m[5], c3 = m[6] + m[7];
      if (mod10(c1.slice(0, 9)) === +c1[9] && mod10(c2.slice(0, 10)) === +c2[10] && mod10(c3.slice(0, 10)) === +c3[10]) {
        var cent = +m[9].slice(4);
        return { tipo: 'boleto', valor: cent ? cent / 100 : null, vencimento: dataDoFator(+m[9].slice(0, 4), hojeISO), linha: c1 + c2 + c3 + m[8] + m[9] };
      }
      re.lastIndex = m.index + 1;
    }
    // contas de consumo e tributos (linha de 48 números que começa com 8): só o valor vem na linha
    var rc = /(^|\D)(8\d{10})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)(?!\d)/;
    m = rc.exec(texto);
    if (m) {
      var barra = m[2] + m[4] + m[6] + m[8], centavos = +barra.slice(4, 15);
      if ((barra[2] === '6' || barra[2] === '8') && centavos) return { tipo: 'arrecadacao', valor: centavos / 100, vencimento: null, linha: m[2] + m[3] + m[4] + m[5] + m[6] + m[7] + m[8] + m[9] };
      return { tipo: 'arrecadacao', valor: null, vencimento: null, linha: m[2] + m[3] + m[4] + m[5] + m[6] + m[7] + m[8] + m[9] };
    }
    return null;
  }
  // DV do código de barras do boleto bancário (módulo 11, pesos 2 a 9).
  function mod11Banco(num) {
    var soma = 0, peso = 2;
    for (var i = num.length - 1; i >= 0; i--) { soma += +num[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
    var dv = 11 - (soma % 11);
    return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
  }
  // DV das contas de consumo e tributos quando o 3º número é 8 ou 9 (módulo 11).
  function mod11Arrec(num) {
    var soma = 0, peso = 2;
    for (var i = num.length - 1; i >= 0; i--) { soma += +num[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
    var r = soma % 11;
    return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r;
  }
  // Código de barras lido de uma foto (44 números) -> valor, vencimento e linha digitável.
  function deBarras(bc, hojeISO) {
    bc = String(bc || '').replace(/\D/g, '');
    if (bc.length !== 44) return null;
    if (bc[0] === '8') {
      var modo10 = bc[2] === '6' || bc[2] === '7';
      var dvg = modo10 ? mod10(bc.slice(0, 3) + bc.slice(4)) : mod11Arrec(bc.slice(0, 3) + bc.slice(4));
      if (dvg !== +bc[3]) return null;
      var linha = '';
      for (var i = 0; i < 4; i++) { var b = bc.slice(i * 11, i * 11 + 11); linha += b + (modo10 ? mod10(b) : mod11Arrec(b)); }
      var cent = (bc[2] === '6' || bc[2] === '8') ? +bc.slice(4, 15) : 0;
      return { tipo: 'arrecadacao', valor: cent ? cent / 100 : null, vencimento: null, linha: linha };
    }
    if (mod11Banco(bc.slice(0, 4) + bc.slice(5)) !== +bc[4]) return null;
    var c1 = bc.slice(0, 4) + bc.slice(19, 24), c2 = bc.slice(24, 34), c3 = bc.slice(34, 44);
    var centavos = +bc.slice(9, 19);
    return {
      tipo: 'boleto', valor: centavos ? centavos / 100 : null, vencimento: dataDoFator(+bc.slice(5, 9), hojeISO),
      linha: c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + bc[4] + bc.slice(5, 19)
    };
  }
  // Linha digitável no formato que vem impresso no boleto.
  function linhaFormatada(l) {
    l = String(l || '').replace(/\D/g, '');
    if (l.length === 47) return l.slice(0, 5) + '.' + l.slice(5, 10) + ' ' + l.slice(10, 15) + '.' + l.slice(15, 21) + ' ' + l.slice(21, 26) + '.' + l.slice(26, 32) + ' ' + l[32] + ' ' + l.slice(33);
    if (l.length === 48) return [0, 12, 24, 36].map(function (i) { return l.slice(i, i + 11) + '-' + l[i + 11]; }).join(' ');
    return l;
  }

  // ---------- Pix "copia e cola" (formato EMV, termina com 6304 + CRC)
  function crc16(s) {
    var crc = 0xFFFF;
    for (var i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  function campos(p) {
    var out = {}, i = 0;
    while (i + 4 <= p.length) { var id = p.substr(i, 2), n = +p.substr(i + 2, 2); if (!isFinite(n)) break; out[id] = p.substr(i + 4, n); i += 4 + n; }
    return out;
  }
  // O código tem espaços de verdade (nome e cidade), mas o PDF pode quebrar linhas no meio:
  // tenta tirando só as quebras de linha e, se não fechar a conferência, tirando todos os espaços.
  function lerPix(texto) {
    var bruto = String(texto || ''), versoes = [bruto.replace(/[ \t]*[\r\n]+[ \t]*/g, ''), bruto.replace(/\s+/g, '')];
    for (var v = 0; v < versoes.length; v++) {
      var t = versoes[v], i = -1;
      while ((i = t.indexOf('000201', i + 1)) >= 0) {
        var fim = t.indexOf('6304', i);
        while (fim >= 0 && fim - i < 600) {
          var p = t.slice(i, fim + 8);
          if (/^[0-9A-F]{4}$/i.test(p.slice(-4)) && crc16(p.slice(0, -4)) === p.slice(-4).toUpperCase()) {
            var c = campos(p);
            return { payload: p, nome: (c['59'] || '').trim(), valor: c['54'] ? parseFloat(c['54']) : null };
          }
          fim = t.indexOf('6304', fim + 1);
        }
      }
    }
    return null;
  }

  // ---------- quem cobra, e valor e vencimento de faturas sem linha de boleto
  function beneficiario(texto) {
    var linhas = String(texto || '').split(/\n/);
    for (var i = 0; i < linhas.length; i++) {
      var m = /(benefici[aá]rio|cedente)(?!\s*final)\s*:?\s*(.*)$/i.exec(linhas[i]);
      if (!m) continue;
      var resto = m[2];
      if (!/[A-Za-zÀ-ú]{3}/.test(resto) && linhas[i + 1]) resto = linhas[i + 1];
      resto = resto.split(/\s(CNPJ|CPF|Ag[eê]ncia|Ag\.|C[oó]digo|Nosso)/i)[0];
      resto = resto.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, '').replace(/[-–:;,\s]+$/, '').replace(/^[-–:;,\s]+/, '').trim();
      if (/[A-Za-zÀ-ú]{3}/.test(resto)) return resto.slice(0, 60);
    }
    return '';
  }
  function fatura(texto) {
    var t = String(texto || '').replace(/\s+/g, ' '), r = {};
    var v = /vencimento[^0-9]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i.exec(t);
    if (v) r.vencimento = v[3] + '-' + v[2] + '-' + v[1];
    var q = /(valor\s+(do\s+documento|a\s+pagar|total|cobrado)|total\s+a\s+pagar)[^0-9]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(t);
    if (q) r.valor = parseFloat(q[3].replace(/\./g, '').replace(',', '.'));
    return r;
  }
  // Nome provisório quando não dá para ler quem cobra: o banco do boleto ou o tipo da conta de consumo.
  var BANCOS = { '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '077': 'Inter', '104': 'Caixa', '208': 'BTG Pactual', '212': 'Banco Original',
    '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '422': 'Safra', '748': 'Sicredi', '756': 'Sicoob' };
  var SEGMENTOS = { '1': 'Prefeitura', '2': 'Água e esgoto', '3': 'Energia elétrica ou gás', '4': 'Telefone ou internet', '5': 'Órgão público', '7': 'Multa de trânsito' };
  function rotuloDoCodigo(linha) {
    linha = String(linha || '');
    if (linha[0] === '8') return SEGMENTOS[linha[1]] ? 'Conta de ' + SEGMENTOS[linha[1]].toLowerCase() : 'Conta de consumo';
    return BANCOS[linha.slice(0, 3)] ? 'Boleto ' + BANCOS[linha.slice(0, 3)] : (linha ? 'Boleto' : '');
  }

  // Junta tudo o que dá para tirar do texto de uma conta.
  function lerTextoConta(texto, hojeISO) {
    var r = {}, b = lerBoleto(texto, hojeISO), p = lerPix(texto), f = fatura(texto);
    if (b) { r.linha = b.linha; r.valor = b.valor; r.vencimento = b.vencimento; }
    if (p) { r.pix = p.payload; if (!r.valor && p.valor) r.valor = p.valor; }
    if (!r.valor && f.valor) r.valor = f.valor;
    if (!r.vencimento && f.vencimento) r.vencimento = f.vencimento;
    r.descricao = beneficiario(texto) || (p && p.nome) || rotuloDoCodigo(r.linha);
    return r;
  }
  VS.boleto = { ler: lerBoleto, mod10: mod10, deBarras: deBarras, linhaFormatada: linhaFormatada, lerTexto: lerTextoConta, rotulo: rotuloDoCodigo };
  VS.pix = { ler: lerPix, crc16: crc16 };
})();
