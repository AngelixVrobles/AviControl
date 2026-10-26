import { useNavigate } from 'react-router-dom'
import { db } from '../db/schema'
import { guardarCicloCompartido } from '../db/compartido'
import { entregarArchivo, nombreArchivo } from '../lib/archivo'
import { claveOrigen, leerCiclo, type CicloCompartido } from '../lib/compartido'
import { diaLocal, enumerar, fecha } from '../lib/format'
import { confirmar, toast } from './confirm'

// Manda el ciclo como archivo: por WhatsApp o donde quieras, y el socio lo abre
// en su AviControl desde Ajustes.
export async function mandarCiclo(ciclo: CicloCompartido) {
  const archivo = new File([JSON.stringify(ciclo)], `ciclo-${nombreArchivo(ciclo.lote.nombre)}.json`, {
    type: 'application/json',
  })
  try {
    const como = await entregarArchivo(archivo, { comoTexto: true })
    if (como === 'descargado')
      toast('Ciclo descargado: mándale el archivo a tu socio por WhatsApp o el correo.')
  } catch {
    toast('No se pudo armar el archivo. Inténtalo de nuevo.')
  }
}

// Abre el ciclo que mandó un socio. La primera vez queda como una copia nueva;
// si ya estaba, se pone al día con lo que trae.
export function useAbrirCiclo() {
  const nav = useNavigate()

  return async function abrirCiclo(data: unknown) {
    const lectura = leerCiclo(data)
    if (!lectura.ok) {
      toast(lectura.error)
      return
    }
    const { ciclo } = lectura
    const lotes = await db.lotes.toArray()
    const origen = claveOrigen(ciclo.lote)
    if (lotes.some((l) => !l.compartido && `${l.creado}:${l.id}` === origen)) {
      toast('Ese ciclo es tuyo: ya está en este teléfono.')
      return
    }
    const previa = lotes.find((l) => l.compartido?.origen === origen)
    const trae = enumerar([
      [ciclo.registros.length, 'día anotado', 'días anotados'],
      [ciclo.gastos.length, 'gasto', 'gastos'],
      [ciclo.ingresos.length, 'venta', 'ventas'],
    ])
    const ok = await confirmar({
      titulo: previa ? 'Poner al día el ciclo' : 'Abrir el ciclo',
      mensaje: previa
        ? `${ciclo.lote.nombre}, de ${ciclo.de}, se pone al día con lo que mandó el ${fecha(diaLocal(ciclo.exportado))}${trae ? `: ${trae}` : ''}.`
        : `${ciclo.lote.nombre}, de ${ciclo.de}${trae ? `, con ${trae}` : ''}. Queda como una copia para mirar: no se puede cambiar, y no entra en las cuentas de tu granja.`,
      confirmar: previa ? 'Poner al día' : 'Abrir',
    })
    if (!ok) return
    try {
      const { id, actualizado } = await guardarCicloCompartido(ciclo)
      toast(actualizado ? 'Ciclo puesto al día.' : 'Ciclo abierto.')
      nav(`/lotes/${id}`)
    } catch {
      toast('No se pudo abrir el ciclo. Nada cambió.')
    }
  }
}
