/* App Van Service — notificações no celular (push). O aparelho se inscreve aqui e o banco
   chama a função "avisar" do Supabase a cada aviso novo. */
(function () {
  'use strict';
  var VS = window.VS, S = VS.store, U = VS.u;
  var CFG = window.VS_CONFIG || {};
  var CHAVE_DEPOIS = 'vs-avisos-depois';

  function temSuporte() {
    return !S.demo && !!CFG.vapidPublica && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function ehIphone() { return /iPhone|iPad|iPod/.test(navigator.userAgent || ''); }
  function chaveBytes(b64) {
    var s = (b64 + '===='.slice((b64.length + 3) % 4 + 1)).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function lerDepois() { try { return window.localStorage.getItem(CHAVE_DEPOIS) === '1'; } catch (e) { return false; } }
  function gravarDepois() { try { window.localStorage.setItem(CHAVE_DEPOIS, '1'); } catch (e) { /* sem armazenamento */ } }

  var P = VS.push = { ativo: false, conferido: false };

  // 'ativo' | 'desligado' | 'bloqueado' | 'iphone' | 'sem-suporte' | 'demo'
  P.estado = function () {
    if (S.demo) return 'demo';
    if (!temSuporte()) return ehIphone() ? 'iphone' : 'sem-suporte';
    if (Notification.permission === 'denied') return 'bloqueado';
    return P.ativo && Notification.permission === 'granted' ? 'ativo' : 'desligado';
  };

  // Confere se este aparelho já está inscrito (ao abrir o app).
  P.conferir = function () {
    if (!temSuporte() || !S.me()) return Promise.resolve();
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      return reg ? reg.pushManager.getSubscription() : null;
    }).then(function (sub) {
      var antes = P.ativo, primeira = !P.conferido;
      P.ativo = !!sub && Notification.permission === 'granted';
      P.conferido = true;
      // Garante que a inscrição está guardada para a pessoa que entrou agora neste aparelho.
      if (sub && P.ativo) S.salvarPush(sub.toJSON()).catch(function () {});
      if ((primeira || antes !== P.ativo) && !VS.state.sheet) VS.render();
    }).catch(function () {});
  };

  function comPrazo(promessa, ms, msg) {
    return new Promise(function (ok, falha) {
      var t = setTimeout(function () { falha(new Error(msg)); }, ms);
      promessa.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); falha(e); });
    });
  }
  function detalhe(e) { return e ? ((e.name && e.name !== 'Error' ? e.name + ': ' : '') + (e.message || String(e))) : ''; }

  // Cada passo tem a sua mensagem, para saber exatamente onde parou.
  P.ativar = function () {
    if (!temSuporte()) return Promise.reject(new Error('Este navegador não recebe notificações.'));
    var reg;
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error(perm === 'denied'
        ? 'As notificações estão bloqueadas para o app. Libere em Configurações do celular → Notificações → Van Service (ou no cadeado do navegador) e tente de novo.'
        : 'Para receber os avisos, toque em "Permitir" quando o celular perguntar.');
      if (!navigator.serviceWorker.controller && !location.protocol.startsWith('https')) throw new Error('Abra o app pelo endereço com https.');
      return comPrazo(navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }), 10000,
        'O app ainda não terminou de carregar. Feche o app, abra de novo pelo ícone e tente outra vez.');
    }).then(function (r) {
      reg = r;
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (sub) return sub;
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(CFG.vapidPublica) }).catch(function (e) {
        throw new Error('O celular não aceitou ativar os avisos. No Android, use o Chrome; no iPhone, abra o app pelo ícone instalado. (Detalhe: ' + detalhe(e) + ')');
      });
    }).then(function (sub) {
      return S.salvarPush(sub.toJSON()).catch(function (e) {
        throw new Error('O celular aceitou, mas não consegui guardar no banco. ' + (e && e.message ? e.message : ''));
      });
    }).then(function () { P.ativo = true; });
  };

  P.desativar = function () {
    if (!temSuporte()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return null;
      var end = sub.endpoint;
      return S.removerPush(end).catch(function () {}).then(function () { return sub.unsubscribe(); });
    }).then(function () { P.ativo = false; });
  };

  // Ao sair do app, este aparelho deixa de receber os avisos dessa pessoa.
  P.aoSair = function () {
    if (!P.ativo) return Promise.resolve();
    return P.desativar().catch(function () {});
  };

  function erroHtml() { return P.ultimoErro ? '<p class="form-erro" role="alert">' + U.esc(P.ultimoErro) + '</p>' : ''; }
  function textoDoPapel(papel) {
    if (papel === 'admin' || papel === 'financeiro') return 'Receba um aviso no celular quando o RH / Fiscal mandar uma conta nova para pagar.';
    if (papel === 'rh') return 'Receba um aviso no celular quando chegar pedido de férias ou documento de funcionário.';
    return 'Receba um aviso no celular quando chegar seu contracheque, vale-transporte ou um pagamento.';
  }

  // Cartão completo, para o Perfil.
  P.cartao = function () {
    var u = S.me(), st = P.estado(), h = '<section class="cartao bloco-cartao"><h2>Notificações no celular</h2>';
    if (st === 'demo') return h + '<p class="sub">Na demonstração os avisos aparecem só no sino. No app de verdade, eles chegam como notificação no celular.</p></section>';
    if (st === 'ativo') {
      return h + '<p class="linha-botoes"><span class="est est-bom">' + U.ic('check', 16) + 'Ativadas neste aparelho</span></p>' +
        '<p class="sub">' + textoDoPapel(u.papel).replace('Receba', 'Você recebe') + '</p>' +
        '<button type="button" class="btn btn-borda" data-act="push-desativar">Desativar neste aparelho</button></section>';
    }
    if (st === 'bloqueado') return h + '<p class="sub">As notificações estão bloqueadas para o app neste aparelho. Libere nas configurações do celular (Notificações → Van Service) ou do navegador e abra o app de novo.</p></section>';
    if (st === 'iphone') return h + '<p class="sub">No iPhone, os avisos só funcionam com o app instalado. Abra no Safari, toque em Compartilhar → <strong>Adicionar à Tela de Início</strong> e abra o app pelo ícone. Depois volte aqui.</p></section>';
    if (st === 'sem-suporte') return h + '<p class="sub">Este navegador não recebe notificações. No Android use o Chrome; no computador, Chrome ou Edge.</p></section>';
    return h + '<p class="sub">' + textoDoPapel(u.papel) + '</p>' + erroHtml() +
      '<button type="button" class="btn btn-cheio" data-act="push-ativar">' + U.ic('sino', 20) + '<span>Ativar avisos neste aparelho</span></button></section>';
  };

  // Convite curto no topo das telas principais, enquanto não ativou.
  P.convite = function () {
    var st = P.estado();
    if (!P.conferido || lerDepois() || (st !== 'desligado' && st !== 'iphone')) return '';
    var u = S.me();
    if (st === 'iphone') {
      return '<section class="cartao convite"><span class="bloco-ic">' + U.ic('sino') + '</span><div class="convite-txt"><strong>Quer receber avisos no celular?</strong>' +
        '<span class="sub">No iPhone, instale o app pelo Safari: Compartilhar → Adicionar à Tela de Início.</span></div>' +
        '<button type="button" class="link" data-act="push-depois">Agora não</button></section>';
    }
    return '<section class="cartao convite"><span class="bloco-ic">' + U.ic('sino') + '</span><div class="convite-txt"><strong>Avisos no celular</strong>' +
      '<span class="sub">' + textoDoPapel(u.papel) + '</span>' + erroHtml() + '</div>' +
      '<div class="convite-botoes"><button type="button" class="btn btn-cheio btn-p" data-act="push-ativar">Ativar</button>' +
      '<button type="button" class="link" data-act="push-depois">Agora não</button></div></section>';
  };

  VS.acts['push-ativar'] = function (el) {
    el.disabled = true;
    P.ultimoErro = '';
    P.ativar().then(function () {
      VS.render(); VS.toast('Pronto. Os avisos vão chegar neste aparelho.');
    }, function (e) { el.disabled = false; P.ultimoErro = e && e.message ? e.message : 'Algo deu errado.'; VS.render(); });
  };
  VS.acts['push-desativar'] = function () {
    P.desativar().then(function () { VS.render(); VS.toast('Avisos desativados neste aparelho.'); }, VS.falha);
  };
  VS.acts['push-depois'] = function () { gravarDepois(); VS.render(); };

  // Confere a inscrição logo depois de entrar, e larga a inscrição ao sair.
  var conferindo = false, renderOriginal = VS.render;
  VS.render = function () {
    renderOriginal.apply(this, arguments);
    if (S.me() && !P.conferido && !conferindo && temSuporte()) {
      conferindo = true;
      P.conferir().then(function () { conferindo = false; P.conferido = true; });
    }
    if (!S.me()) { P.conferido = false; P.ativo = false; }
  };
  var sairOriginal = VS.acts.sair;
  VS.acts.sair = function (el, ev) { P.aoSair().then(function () { sairOriginal(el, ev); }); };

  // Mostra o convite no topo das telas principais.
  ['contas', 'meu', 'inicio', 'pedidos'].forEach(function (nome) {
    var original = VS.views[nome];
    if (!original) return;
    VS.views[nome] = function () {
      var u = S.me(), quer = nome === 'contas' ||
        (nome === 'inicio' && u.papel === 'admin') || (nome === 'meu' && u.papel === 'funcionario') || (nome === 'pedidos' && u.papel === 'rh');
      return (quer ? P.convite() : '') + original.apply(this, arguments);
    };
  });
})();
