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
        return { tipo: 'boleto', valor: cent ? cent / 100 : null, vencimento: dataDoFator(+m[9].slice(0, 4), hojeISO) };
      }
      re.lastIndex = m.index + 1;
    }
    // contas de consumo e tributos (linha de 48 números que começa com 8): só o valor vem na linha
    var rc = /(^|\D)(8\d{10})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)(?!\d)/;
    m = rc.exec(texto);
    if (m) {
      var barra = m[2] + m[4] + m[6] + m[8], centavos = +barra.slice(4, 15);
      if ((barra[2] === '6' || barra[2] === '8') && centavos) return { tipo: 'arrecadacao', valor: centavos / 100, vencimento: null };
    }
    return null;
  }
  VS.boleto = { ler: lerBoleto, mod10: mod10 };
})();
