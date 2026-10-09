# C4pital — ¡Multiplica tus ideas!

Simulador bancario educativo para 4.º A. Los estudiantes usan **dinero didáctico** (₵) para abrir cuentas, depositar, retirar, transferir, ahorrar con interés compuesto y pedir préstamos con cuota fija, mientras practican Matemática Financiera.

Es una página web que funciona en cualquier navegador, sin instalar nada y sin servidor.

## Qué puede hacer

La app imita una banca móvil real: pantalla de inicio de sesión, tarjetas de productos, menú inferior, operaciones paso a paso con confirmación por clave y comprobante con número de referencia.

**Estudiantes** (entran con su nombre o número de cuenta y una clave de 4 números)

- Inicio con saldo total, tarjetas de Cuenta Corriente, Cuenta de Ahorro y Préstamo, accesos rápidos y últimos movimientos. Los saldos se pueden ocultar.
- Transferir a un compañero o entre sus propias cuentas.
- Depositar y retirar dinero didáctico.
- Pagar servicios simulados (luz, agua, internet, cantina, transporte…).
- Ahorrar con interés compuesto y calcular cuánto tendrán con la fórmula M = C · (1 + i)ⁿ.
- Simular y solicitar préstamos con cuota fija, ver la tabla de amortización y pagar cuotas.
- Historial de movimientos por mes, cambio de clave y una sección de educación financiera.

**Docente** (entra con la clave de docente, al inicio `1234`)

- Resumen del banco: dinero en cuentas, ahorrado y por cobrar, alertas y mejores ahorradores.
- Abrir cuentas una por una o pegando toda la lista del curso (la clave se crea sola y se puede imprimir).
- Ver cada cliente, dar premios o multas, cambiar su clave, cerrar su cuenta y **ver su app como la ve el estudiante**.
- Aprobar o rechazar solicitudes de préstamo.
- **Cerrar el mes**: el banco paga intereses del ahorro y cobra las cuotas de los préstamos. Si un estudiante no tiene saldo, la cuota queda atrasada.
- Cambiar las reglas del banco y descargar o cargar copias de seguridad.

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
- `js/app.js`: la interfaz (pantallas del estudiante y panel docente).
- `js/iconos.js`: los iconos.
- `tests/`: pruebas de las reglas del banco. Se ejecutan con `npm test` (Node 18 o superior).
