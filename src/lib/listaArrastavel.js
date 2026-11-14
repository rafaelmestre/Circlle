// Lista estilo playlist:
//  • segurar a alça (⋮⋮, opcional) e arrastar reordena, com as outras linhas abrindo espaço;
//  • deslizar a linha para a esquerda mostra o botão vermelho de apagar (como no WhatsApp).
//
// Estrutura esperada de cada item:
//   <li data-item="id">
//     <button data-apagar>…</button>            ← fica atrás, à direita
//     <div data-frente> <button data-alca> … </div>
//   </li>

const LARGURA_APAGAR = 88;   // px revelados ao deslizar
const DURACAO = 200;         // ms das transições

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function listaArrastavel(lista, { aoReordenar = () => {}, aoApagar, confirmar = () => true }) {
  const itens = () => [...lista.querySelectorAll(':scope > [data-item]')];
  const ordemAtual = () => itens().map((li) => li.dataset.item);
  let aberto = null; // linha com o "Apagar" à mostra

  const fechar = (li = aberto) => {
    if (!li) return;
    const frente = li.querySelector('[data-frente]');
    frente.style.transition = `transform ${DURACAO}ms ease`;
    frente.style.transform = '';
    li.classList.remove('arrastavel--aberto');
    if (aberto === li) aberto = null;
    setTimeout(() => { if (aberto !== li) li.classList.remove('arrastavel--deslizando'); }, DURACAO);
  };
  const abrir = (li) => {
    if (aberto && aberto !== li) fechar();
    const frente = li.querySelector('[data-frente]');
    frente.style.transition = `transform ${DURACAO}ms ease`;
    frente.style.transform = `translateX(${-LARGURA_APAGAR}px)`;
    li.classList.add('arrastavel--aberto');
    aberto = li;
  };

  // Toque fora da linha aberta fecha
  lista.closest('main')?.addEventListener('pointerdown', (e) => {
    if (aberto && !aberto.contains(e.target)) fechar();
  });

  // ---------- Reordenar ----------
  const reordenar = (e, li) => {
    const todos = itens();
    const de = todos.indexOf(li);
    const gap = parseFloat(getComputedStyle(lista).rowGap) || 0;
    const caixas = todos.map((x) => x.getBoundingClientRect());
    const meios = caixas.map((c) => c.top + window.scrollY + c.height / 2);
    const passo = caixas[de].height + gap;
    const inicioY = e.clientY + window.scrollY;
    let ultimoY = e.clientY;
    let para = de;
    let rolando = 0;

    fechar();
    li.classList.add('arrastavel--movendo');
    todos.forEach((x) => { if (x !== li) x.style.transition = `transform ${DURACAO}ms ease`; });
    navigator.vibrate?.(8);

    const atualizar = () => {
      const dy = ultimoY + window.scrollY - inicioY;
      li.style.transform = `translateY(${dy}px) scale(1.02)`;
      const centro = meios[de] + dy;
      para = todos.filter((x, j) => j !== de && meios[j] < centro).length;
      todos.forEach((x, j) => {
        if (x === li) return;
        let desloca = 0;
        if (j > de && j <= para) desloca = -passo;
        if (j < de && j >= para) desloca = passo;
        x.style.transform = desloca ? `translateY(${desloca}px)` : '';
      });
    };

    // Rola a tela quando o dedo chega perto das bordas
    const borda = () => {
      const baixo = window.innerHeight - 110; // acima da barra de navegação
      const vel = ultimoY < 90 ? -8 : ultimoY > baixo ? 8 : 0;
      if (vel) { window.scrollBy(0, vel); atualizar(); }
      rolando = requestAnimationFrame(borda);
    };
    rolando = requestAnimationFrame(borda);

    const mover = (ev) => { ultimoY = ev.clientY; atualizar(); };
    const soltar = async () => {
      cancelAnimationFrame(rolando);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);

      // Desliza a linha até o lugar novo e só então troca no HTML
      let destino = 0;
      for (let j = Math.min(de, para); j <= Math.max(de, para); j++) {
        if (j !== de) destino += caixas[j].height + gap;
      }
      if (para < de) destino = -destino;
      li.style.transition = `transform ${DURACAO}ms ease`;
      li.style.transform = `translateY(${destino}px)`;
      await esperar(DURACAO);

      todos.forEach((x) => { x.style.transition = 'none'; x.style.transform = ''; });
      li.classList.remove('arrastavel--movendo');
      if (para !== de) {
        const resto = todos.filter((x) => x !== li);
        lista.insertBefore(li, resto[para] ?? null);
      }
      void lista.offsetHeight; // aplica sem animar
      todos.forEach((x) => { x.style.transition = ''; });
      if (para !== de) aoReordenar(ordemAtual());
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  };

  // ---------- Deslizar para apagar ----------
  const deslizar = (e, li) => {
    const frente = li.querySelector('[data-frente]');
    const x0 = e.clientX;
    const y0 = e.clientY;
    const base = li === aberto ? -LARGURA_APAGAR : 0;
    let estado = 'talvez';
    let x = base;

    const mover = (ev) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (estado === 'talvez') {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { estado = 'vertical'; return terminar(); }
        if (Math.abs(dx) < 10) return;
        estado = 'lado';
        li.classList.add('arrastavel--deslizando');
        if (aberto && aberto !== li) fechar();
        frente.style.transition = 'none';
      }
      // Passou do limite: anda mais devagar, como elástico
      x = base + dx;
      if (x > 0) x = x / 4;
      if (x < -LARGURA_APAGAR) x = -LARGURA_APAGAR + (x + LARGURA_APAGAR) / 3;
      frente.style.transform = `translateX(${x}px)`;
    };
    const terminar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', terminar);
      window.removeEventListener('pointercancel', terminar);
      if (estado === 'talvez' && base === 0) return; // toque normal: abre a cifra
      if (estado === 'vertical') return;
      if (estado === 'talvez') x = 0; // toque na linha aberta: fecha
      // Evita que o fim do gesto vire um toque no link
      const engolir = (c) => { c.preventDefault(); c.stopPropagation(); };
      frente.addEventListener('click', engolir, { capture: true, once: true });
      setTimeout(() => frente.removeEventListener('click', engolir, { capture: true }), 300);
      if (x < -LARGURA_APAGAR / 2) abrir(li); else fechar(li);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', terminar);
    window.addEventListener('pointercancel', terminar);
  };

  // ---------- Apagar com a linha recolhendo ----------
  const apagar = async (li) => {
    if (!(await confirmar(li.dataset.item))) return fechar(li);
    const altura = li.getBoundingClientRect().height;
    li.style.height = `${altura}px`;
    void li.offsetHeight;
    li.classList.add('arrastavel--saindo');
    li.style.height = '0px';
    const ok = await aoApagar(li.dataset.item);
    if (ok === false) {
      li.classList.remove('arrastavel--saindo');
      li.style.height = '';
      fechar(li);
      return;
    }
    await esperar(DURACAO);
    if (aberto === li) aberto = null;
    li.remove();
    aoReordenar(ordemAtual(), { apagou: true });
  };

  itens().forEach((li) => {
    const alca = li.querySelector('[data-alca]');
    const frente = li.querySelector('[data-frente]');

    alca?.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      reordenar(e, li);
    });
    // Teclado: setas sobem e descem a música
    alca?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const vizinho = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
      if (!vizinho?.dataset.item) return;
      lista.insertBefore(li, e.key === 'ArrowUp' ? vizinho : vizinho.nextElementSibling);
      alca.focus();
      aoReordenar(ordemAtual());
    });

    frente.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('[data-alca], input, button')) return;
      deslizar(e, li);
    });
    // Sem toque: o botão de apagar aparece ao receber foco pelo teclado
    const botao = li.querySelector('[data-apagar]');
    botao.addEventListener('focus', () => abrir(li));
    botao.addEventListener('click', () => apagar(li));
  });

  return { fechar };
}
