# C4pital — ¡Multiplica tus ideas!

Simulador bancario educativo para 4.º A. Los estudiantes usan **dinero didáctico** (₵) para abrir cuentas, depositar, retirar, transferir, ahorrar con interés compuesto y pedir préstamos con cuota fija, mientras practican Matemática Financiera.

Es una página web que funciona en cualquier navegador, sin instalar nada y sin servidor.

## Qué puede hacer

**Estudiantes** (entran con su nombre y un PIN de 4 números)

- Ver sus saldos (cuenta corriente, ahorro y deuda) y el historial de movimientos.
- Depositar y retirar dinero.
- Transferir dinero a un compañero.
- Pasar dinero a su cuenta de ahorro y calcular cuánto tendrán con la fórmula M = C · (1 + i)ⁿ.
- Simular un préstamo (cuota, total a pagar, intereses y tabla de amortización) y solicitarlo.
- Pagar cuotas de su préstamo.

**Docente** (entra con el PIN de docente, al inicio `1234`)

- Abrir cuentas una por una o pegando toda la lista del curso (el PIN se crea solo y se puede imprimir).
- Ver los saldos de todo el curso, sumar premios o restar multas, cambiar PIN y cerrar cuentas.
- Aprobar o rechazar solicitudes de préstamo.
- **Cerrar el mes**: el banco paga intereses del ahorro y cobra las cuotas de los préstamos. Si un estudiante no tiene saldo, la cuota queda atrasada.
- Cambiar las reglas: nombre del banco, símbolo de la moneda, depósito de apertura, tasas de interés, préstamo máximo y plazos.
- Descargar y cargar copias de seguridad.

## Reglas iniciales

| Regla | Valor |
| --- | --- |
| Depósito de apertura | ₵1,000.00 |
| Interés del ahorro | 1% mensual (compuesto) |
| Interés de préstamos | 2% mensual (cuota fija, sistema francés) |
| Préstamo máximo | ₵2,000.00 |
| Plazos | 3, 6 o 12 meses |

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
- `js/app.js`: la interfaz.
- `tests/`: pruebas de las reglas del banco. Se ejecutan con `npm test` (Node 18 o superior).
