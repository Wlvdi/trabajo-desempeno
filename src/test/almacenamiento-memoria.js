// src/test/almacenamiento-memoria.js
// localStorage en memoria para los tests en Node (no existe fuera del navegador).
// Se vacía antes de cada test.
import { beforeEach } from 'vitest'

class AlmacenamientoMemoria {
  constructor() {
    this.datos = new Map()
  }
  getItem(clave) {
    return this.datos.has(clave) ? this.datos.get(clave) : null
  }
  setItem(clave, valor) {
    this.datos.set(clave, String(valor))
  }
  removeItem(clave) {
    this.datos.delete(clave)
  }
  clear() {
    this.datos.clear()
  }
}

globalThis.localStorage = new AlmacenamientoMemoria()

beforeEach(() => {
  globalThis.localStorage.clear()
})
