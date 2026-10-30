/**
 * Destaca ocorrências de `termo` dentro de `texto`, ignorando acentos e maiúsculas
 * (mesma regra da busca no backend: "conferencia" destaca "Conferência").
 */
const semAcento = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()[0] ?? c;

export function Highlight({ texto, termo }: { texto: string; termo: string }) {
  const t = [...termo.trim()].map(semAcento).join('');
  if (!t) return <>{texto}</>;

  // Normaliza caractere a caractere para manter índices alinhados com o texto original
  const chars = [...texto];
  const norm = chars.map(semAcento).join('');
  const partes: { s: string; hit: boolean }[] = [];
  let i = 0;
  for (let pos = norm.indexOf(t); pos !== -1; pos = norm.indexOf(t, pos + t.length)) {
    if (pos > i) partes.push({ s: chars.slice(i, pos).join(''), hit: false });
    partes.push({ s: chars.slice(pos, pos + t.length).join(''), hit: true });
    i = pos + t.length;
  }
  if (i < chars.length) partes.push({ s: chars.slice(i).join(''), hit: false });

  return (
    <>
      {partes.map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded-sm bg-yellow-200 text-inherit">{p.s}</mark>
        ) : (
          <span key={k}>{p.s}</span>
        ),
      )}
    </>
  );
}
