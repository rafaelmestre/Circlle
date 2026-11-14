// Troca de tom: acordes da cifra transpostos para o tom escolhido

const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const INDICE = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11
};
// Tons que se escrevem com bemol
const TONS_BEMOL = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

// Acorde: nota, complemento (m, 7, sus4, maj7, 7(9)...) e baixo opcional (C/E)
const ACORDE = /^([A-G](?:#|b)?)((?:m|maj|min|dim|aug|sus|add|M|º|°|\+|-|\d|\(|\)|b|#|\/(?=\d))*)(?:\/([A-G](?:#|b)?))?$/;

export const ehAcorde = (t) => ACORDE.test(t);

// "Am" → { nota: 'A', menor: true }
export function lerTom(tom) {
  const m = /^([A-G](?:#|b)?)(m)?/.exec(String(tom ?? '').trim());
  return m && INDICE[m[1]] !== undefined ? { nota: m[1], menor: Boolean(m[2]) } : null;
}

const nomeNota = (indice, bemol) => (bemol ? BEMOIS : SUSTENIDOS)[((indice % 12) + 12) % 12];

// Semitons entre dois tons (só a nota importa)
export function distancia(de, para) {
  const a = lerTom(de);
  const b = lerTom(para);
  return a && b ? INDICE[b.nota] - INDICE[a.nota] : 0;
}

export function usaBemol(tom) {
  const t = lerTom(tom);
  return t ? TONS_BEMOL.has(`${t.nota}${t.menor ? 'm' : ''}`) : false;
}

export function transporAcorde(acorde, semitons, bemol) {
  const m = ACORDE.exec(acorde);
  if (!m) return acorde;
  const [, nota, resto, baixo] = m;
  const nova = nomeNota(INDICE[nota] + semitons, bemol);
  return `${nova}${resto}${baixo ? `/${nomeNota(INDICE[baixo] + semitons, bemol)}` : ''}`;
}

// Tom de destino a partir do original + semitons
export function tomTransposto(original, semitons) {
  const t = lerTom(original);
  if (!t) return '';
  const bemol = TONS_BEMOL.has(`${nomeNota(INDICE[t.nota] + semitons, true)}${t.menor ? 'm' : ''}`);
  return `${nomeNota(INDICE[t.nota] + semitons, bemol)}${t.menor ? 'm' : ''}`;
}

// Primeiro acorde da cifra, para quando a música não tem tom cadastrado
export function primeiroAcorde(cifra) {
  for (const linha of String(cifra ?? '').split('\n')) {
    const colchete = /\[([^\]]+)\]/.exec(linha);
    if (colchete && ehAcorde(colchete[1])) return colchete[1];
    const tokens = linha.trim().split(/\s+/).filter(Boolean).filter((x) => !/:$/.test(x));
    if (tokens.length && tokens.every(ehAcorde)) return tokens[0];
  }
  return '';
}

// Uma linha só de acordes (cifra no formato "acordes em cima da letra"),
// aceitando um rótulo no começo, como "Intro:" ou "Solo:"
const linhaDeAcordes = (linha) => {
  const tokens = linha.trim().split(/\s+/).filter(Boolean);
  const resto = /:$/.test(tokens[0] ?? '') ? tokens.slice(1) : tokens;
  return resto.length > 0 && resto.every((t) => ehAcorde(t) || /^[|\-–/x\d()]+$/.test(t));
};

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Transpõe a cifra e devolve HTML: acordes destacados, letra embaixo.
// Aceita os dois jeitos de escrever: [G]letra (ChordPro) e acordes na linha de cima.
export function cifraHtml(cifra, semitons = 0, bemol = false) {
  const t = (a) => transporAcorde(a, semitons, bemol);
  return String(cifra ?? '').split('\n').map((linha) => {
    // [G]Letra com [D]acordes no meio → duas linhas alinhadas
    if (/\[[^\]]+\]/.test(linha)) {
      let acordes = '';
      let letra = '';
      const partes = linha.split(/(\[[^\]]+\])/);
      for (const parte of partes) {
        const m = /^\[([^\]]+)\]$/.exec(parte);
        if (m) {
          const a = ehAcorde(m[1]) ? t(m[1]) : m[1];
          if (acordes.length > letra.length) letra = letra.padEnd(acordes.length, ' ');
          acordes = acordes.padEnd(letra.length, ' ') + a + ' ';
        } else {
          letra += parte;
        }
      }
      return `<span class="cifra__acordes">${escapar(acordes.trimEnd())}</span>\n${escapar(letra)}`;
    }
    // Linha só de acordes: troca cada um mantendo as posições o mais perto possível
    if (linhaDeAcordes(linha)) {
      let saida = '';
      let falta = 0; // espaços a compensar quando o acorde novo fica maior
      for (const pedaco of linha.split(/(\s+)/)) {
        if (!pedaco) continue;
        if (/^\s+$/.test(pedaco)) {
          const n = Math.max(1, pedaco.length - falta);
          falta = Math.max(0, falta - (pedaco.length - 1));
          saida += ' '.repeat(n);
        } else if (!ehAcorde(pedaco)) {
          saida += pedaco; // rótulo ("Intro:") ou marcação ("|", "x2")
        } else {
          const novo = t(pedaco);
          falta += novo.length - pedaco.length;
          saida += novo;
        }
      }
      return `<span class="cifra__acordes">${escapar(saida)}</span>`;
    }
    // Título de parte: [Refrão] já caiu acima; "Refrão:" fica em destaque
    if (/^\s*(intro|refr[aã]o|ponte|verso|final|solo|pr[eé]-refr[aã]o|coro)\b.*:?\s*$/i.test(linha)) {
      return `<span class="cifra__parte">${escapar(linha)}</span>`;
    }
    return escapar(linha);
  }).join('\n');
}
