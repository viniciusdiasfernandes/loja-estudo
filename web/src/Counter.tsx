import { useState } from 'react'

export function Counter() {
    const [count, setCount] = useState(0)

    return (
        <div>
            <p>Cliques: {count}</p>
            <button onClick={() => setCount(count + 1)}>Clicar</button>
            {count > 0  && <button onClick={() => setCount(count - 1)}>-</button>}
            {count > 0 && <button onClick={() => setCount(0)}>Zerar</button>}
        </div>
    )
}