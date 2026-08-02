const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '←']

export function Numpad({ onTecla }: { onTecla: (tecla: string) => void }) {
  return (
    <div className="numpad">
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          className={`num-key ${tecla === '←' || tecla === '00' ? 'muted-key' : ''}`}
          onClick={() => onTecla(tecla)}
        >
          {tecla}
        </button>
      ))}
    </div>
  )
}
