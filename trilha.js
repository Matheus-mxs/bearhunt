(function () {
  "use strict";

  // Os arquivos ficam na mesma pasta do index.html.
  const principal = new Audio("sons/trilha.m4a");
  const batalha = new Audio("sons/" + encodeURIComponent("Doom Eternal.m4a"));

  principal.preload = "auto";
  principal.volume = 0.45;
  principal.loop = true;

  batalha.preload = "auto";
  batalha.volume = 0;
  batalha.loop = true;

  let mutada = false;
  let fadePrincipal = null;
  let fadeBatalha = null;
  let botaoSom = null;
  let batalhaSolicitada = false;

  function cancelarFade(ref) {
    if (ref) clearInterval(ref);
  }

  function fade(audio, alvo, duracao, aoFinal) {
    const volumeInicial = audio.volume;
    const inicio = performance.now();
    const id = setInterval(function () {
      const progresso = Math.min(1, (performance.now() - inicio) / duracao);
      audio.volume = Math.max(0, Math.min(1,
        volumeInicial + (alvo - volumeInicial) * progresso
      ));
      if (progresso >= 1) {
        clearInterval(id);
        if (aoFinal) aoFinal();
      }
    }, 30);
    return id;
  }

  function prepararEntradaNivel3() {
    cancelarFade(fadePrincipal);
    cancelarFade(fadeBatalha);
    batalhaSolicitada = false;
    principal.loop = true;
    const concluir = function () {
      principal.pause();
      principal.currentTime = 0;
      principal.volume = 0;
      if (window.iniciarCutsceneAbbeyNivel3) {
        window.iniciarCutsceneAbbeyNivel3();
      }
    };
    if (principal.paused) {
      concluir();
      return;
    }
    fadePrincipal = fade(principal, 0, 1800, concluir);
  }

  function iniciarMusicaPrincipal(reiniciar) {
    if (mutada || window.telaDerrotaNivel3) return;

    cancelarFade(fadePrincipal);
    principal.volume = 0.45;
    principal.loop = true;
    if (reiniciar) principal.currentTime = 0;

    const tentativa = principal.play();
    if (tentativa && tentativa.catch) tentativa.catch(function () {
      // O navegador pode exigir uma interação do usuário.
    });
  }

  function iniciarMusicaBatalha() {
    if (mutada) return;

    batalhaSolicitada = true;
    cancelarFade(fadePrincipal);
    cancelarFade(fadeBatalha);

    // A música principal desaparece suavemente antes da batalha.
    fadePrincipal = fade(principal, 0, 1800, function () {
      principal.pause();
      principal.currentTime = 0;
    });

    batalha.loop = true;
    batalha.volume = 0;
    batalha.currentTime = 0;

    // load() força o navegador a preparar o arquivo enviado.
    try { batalha.load(); } catch (erro) {}

    const tocar = function () {
      if (mutada || !batalhaSolicitada) return;
      const tentativa = batalha.play();
      if (tentativa && tentativa.catch) tentativa.catch(function () {
        // Será tentado novamente na primeira interação do usuário.
      });
    };

    tocar();
    fadeBatalha = fade(batalha, 0.55, 1800);
  }

  function desvanecerMusicaBatalha() {
    batalhaSolicitada = false;
    cancelarFade(fadeBatalha);
    fadeBatalha = fade(batalha, 0, 2200, function () {
      batalha.pause();
      batalha.currentTime = 0;
    });
  }

  function pararMusicaBatalha(comFade) {
    batalhaSolicitada = false;
    cancelarFade(fadeBatalha);
    if (comFade) {
      fadeBatalha = fade(batalha, 0, 1200, function () {
        batalha.pause();
        batalha.currentTime = 0;
      });
    } else {
      batalha.pause();
      batalha.currentTime = 0;
      batalha.volume = 0;
    }
  }

  function alternarMusica() {
    mutada = !mutada;
    principal.muted = mutada;
    batalha.muted = mutada;

    if (mutada) {
      principal.pause();
      batalha.pause();
    } else if (batalhaSolicitada && !window.telaDerrotaNivel3) {
      batalha.play().catch(function () {});
    } else if (!window.telaDerrotaNivel3) {
      iniciarMusicaPrincipal(false);
    }

    atualizarBotao();
  }

  function atualizarBotao() {
    if (!botaoSom) return;
    botaoSom.textContent = mutada ? "🔇" : "🔊";
    botaoSom.title = mutada ? "Ativar música" : "Silenciar música";
    botaoSom.setAttribute("aria-label", botaoSom.title);
  }

  function criarBotaoSom() {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!touch || botaoSom) return;

    botaoSom = document.createElement("button");
    botaoSom.type = "button";
    botaoSom.style.cssText = [
      "position:fixed", "right:12px", "bottom:12px", "z-index:99999",
      "width:46px", "height:46px", "border-radius:50%",
      "border:2px solid white", "background:rgba(0,0,0,.65)",
      "color:white", "font-size:21px", "padding:0", "cursor:pointer",
      "touch-action:manipulation"
    ].join(";");
    botaoSom.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      alternarMusica();
    });
    document.body.appendChild(botaoSom);
    atualizarBotao();
  }

  batalha.addEventListener("canplaythrough", function () {
    if (batalhaSolicitada && !mutada && batalha.paused) {
      batalha.play().catch(function () {});
    }
  });

  window.prepararEntradaNivel3 = prepararEntradaNivel3;
  window.iniciarMusicaPrincipal = iniciarMusicaPrincipal;
  window.iniciarMusicaBatalha = iniciarMusicaBatalha;
  window.desvanecerMusicaBatalha = desvanecerMusicaBatalha;
  window.pararMusicaBatalha = pararMusicaBatalha;

  function iniciarSistemaDeAudio() {
    criarBotaoSom();
    principal.load();
    batalha.load();
    iniciarMusicaPrincipal(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarSistemaDeAudio, { once: true });
  } else {
    iniciarSistemaDeAudio();
  }

  // Libera o áudio quando o navegador exigir gesto do usuário.
  function liberarAudio() {
    if (mutada) return;
    if (batalhaSolicitada && !window.telaDerrotaNivel3 && batalha.paused) {
      batalha.play().catch(function () {});
    } else if (!batalhaSolicitada && principal.paused && !window.telaDerrotaNivel3) {
      principal.play().catch(function () {});
    }
  }

  document.addEventListener("click", liberarAudio, { passive: true });
  document.addEventListener("touchstart", liberarAudio, { passive: true });
  document.addEventListener("keydown", liberarAudio);

  document.addEventListener("keydown", function (event) {
    const elemento = document.activeElement;
    const digitando = elemento && (
      elemento.tagName === "INPUT" ||
      elemento.tagName === "TEXTAREA" ||
      elemento.isContentEditable
    );
    if (digitando) return;
    if (event.key && event.key.toLowerCase() === "m") alternarMusica();
  });
})();
