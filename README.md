# C4pital — ¡Multiplica tus ideas!

Simulador bancario educativo para 4.º A. Los estudiantes usan **dinero didáctico** (₵) para abrir cuentas, depositar, retirar, transferir, ahorrar con interés compuesto y pedir préstamos con cuota fija, mientras practican Matemática Financiera.

Es una página web que funciona en cualquier navegador, sin instalar nada y sin servidor.

## Qué puede hacer

La app imita una banca móvil real, organizada por **departamentos**: cuentas, tarjeta de crédito, préstamos, certificados de depósito, divisas, calculadoras financieras y tarifario. Cada operación va paso a paso, muestra sus cargos antes de confirmar, se autoriza con clave y entrega un comprobante.

**Estudiantes** (entran con su nombre o número de cuenta y una clave de 4 números)

- **Cuentas**: corriente, ahorro (interés compuesto) y dólares. Depositar, retirar, transferir a un compañero o entre sus cuentas y pagar servicios.
- **Tarjeta de crédito**: solicitarla, comprar en comercios, avance de efectivo, estado de cuenta con saldo al corte y pago mínimo, pagar mínimo / saldo al corte / total.
- **Préstamos**: personal, educativo o de emprendimiento, con sistema **francés** (cuota fija) o **alemán** (capital fijo), tabla de amortización, comisión de apertura y mora.
- **Certificados de depósito**: plazo fijo con interés simple o compuesto, comparación de ambos y penalidad por cancelar antes de tiempo.
- **Divisas**: comprar y vender dólares con tasa de compra y de venta (diferencial cambiario).
- **Calculadoras**: interés simple, compuesto, ahorro programado (anualidad), tasas equivalentes y comparación francés vs. alemán, con su fórmula.
- **Tarifario**: todos los cargos del banco en un solo lugar.
- Historial de movimientos, ocultar saldos, cambio de clave y sección de educación financiera.

**Docente** (entra con la clave de docente, al inicio `1234`)

- Resumen del banco: dinero en cuentas, ahorros, préstamos, tarjetas, certificados y dólares, y **cuánto ha ganado el banco** (comisiones, impuestos, moras e intereses).
- Abrir cuentas una por una o pegando toda la lista del curso (la clave se crea sola y se puede imprimir).
- Ver cada cliente, dar premios o multas, cambiar su clave, cerrar su cuenta y **ver su app como la ve el estudiante**.
- Aprobar o rechazar solicitudes de préstamo.
- **Cerrar el mes**: paga intereses del ahorro y los certificados, hace el corte de las tarjetas (mora e intereses), cobra cuotas de préstamos (mora si no hay saldo) y el mantenimiento de cuentas con saldo bajo.
- Cambiar todas las tasas y tarifas, y descargar o cargar copias de seguridad.

## Cargos y tasas iniciales

| Departamento | Cargo o tasa | Valor |
| --- | --- | --- |
| Cuentas | Depósito de apertura | ₵1,000.00 |
| Cuentas | Interés del ahorro | 1% mensual (compuesto) |
| Cuentas | Saldo mínimo / mantenimiento | ₵500.00 / ₵25.00 al mes |
| Cuentas | Comisión por retiro / transferencia | ₵10.00 / ₵5.00 |
| Cuentas | Impuesto a transacciones | 0.15% |
| Préstamos | Personal / educativo / emprendimiento | 2% / 1.5% / 1.8% mensual |
| Préstamos | Comisión de apertura / mora | 2% / ₵50.00 por mes atrasado |
| Préstamos | Máximo y plazos | ₵2,000.00 · 3, 6 o 12 meses |
| Tarjeta | Límite / interés | ₵1,500.00 / 4% mensual |
| Tarjeta | Pago mínimo | 5% del saldo (mínimo ₵50.00) |
| Tarjeta | Mora / avance / emisión | ₵100.00 / 5% / ₵100.00 |
| Certificados | Tasa / mínimo / penalidad | 1.5% mensual / ₵500.00 / 2% |
| Divisas | Compra / venta del dólar | 58.50 / 60.50 |

Todas se pueden cambiar en **Panel docente → Ajustes**.

## Dónde se guardan los datos

Los datos se guardan en el navegador de la computadora donde se usa la app (no en internet). Por eso:

- Si el curso usa **una sola computadora** (por ejemplo, la del aula o la del docente como "ventanilla del banco"), todo queda junto.
- Si se usan varias computadoras, cada una tendrá su propio banco. Para pasar los datos de una a otra, usa **Ajustes → Descargar copia** y luego **Cargar copia**.
- Descarga una copia al final de cada clase por si se borra el historial del navegador.

## Cómo publicarla con GitHub Pages

1. En GitHub, entra a **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`. Guarda.
3. En un par de minutos la app estará en `https://danndres1998-source.github.io/c4pital-banco/`.

También se puede abrir directamente el archivo `index.html` en el navegador.

## Para desarrolladores

- `index.html`, `css/estilos.css`: la página.
- `js/banco.js`: las reglas del banco (cálculos de interés, préstamos, validaciones). Todo el dinero se maneja en centavos enteros.
- `js/app.js`: la interfaz (pantallas del estudiante y panel docente).
- `js/iconos.js`: los iconos.
- `tests/`: pruebas de las reglas del banco. Se ejecutan con `npm test` (Node 18 o superior).
