import LegalLayout from '../components/LegalLayout';

const CONTACTO = 'albertpena070103@gmail.com';

function Terminos() {
  return (
    <LegalLayout
      titulo="Condiciones del Servicio"
      tituloPestana="Condiciones del Servicio"
      actualizado="4 de noviembre de 2026"
    >
      <p>
        Al registrarte o iniciar sesión en la Plataforma Repartidores (&quot;la
        Plataforma&quot;), operada por Aryal SpA, aceptas estas condiciones. Si no estás de
        acuerdo, no utilices el servicio.
      </p>

      <h2>1. Descripción del servicio</h2>
      <p>
        La Plataforma permite a repartidores de última milla registrar ingresos, gastos y
        actividad operativa, y a los administradores supervisar y consolidar esa información.
      </p>

      <h2>2. Cuentas y aprobación</h2>
      <ul>
        <li>Debes entregar información veraz y mantenerla actualizada.</li>
        <li>
          Las cuentas nuevas quedan pendientes hasta que un administrador las apruebe, que
          puede aceptar o rechazar solicitudes.
        </li>
        <li>Eres responsable de la actividad realizada con tu cuenta y de cuidar tus credenciales.</li>
      </ul>

      <h2>3. Uso aceptable</h2>
      <ul>
        <li>No ingreses información falsa o de terceros sin autorización.</li>
        <li>No intentes acceder a datos de otros usuarios ni vulnerar la seguridad del sistema.</li>
        <li>No uses la Plataforma para fines ilícitos.</li>
      </ul>

      <h2>4. Información financiera</h2>
      <p>
        Los cálculos y reportes son una herramienta de apoyo basada en los datos que se
        ingresan. No constituyen asesoría contable, tributaria ni legal. Es responsabilidad
        del usuario verificar su exactitud.
      </p>

      <h2>5. Disponibilidad</h2>
      <p>
        Procuramos mantener el servicio disponible, pero no garantizamos que funcione sin
        interrupciones ni errores. Podemos modificar o suspender funciones cuando sea necesario.
      </p>

      <h2>6. Suspensión</h2>
      <p>
        Podemos suspender o cerrar cuentas que incumplan estas condiciones o pongan en riesgo
        la seguridad de la Plataforma.
      </p>

      <h2>7. Limitación de responsabilidad</h2>
      <p>
        En la medida permitida por la ley, Aryal SpA no responde por pérdidas indirectas
        derivadas del uso o la imposibilidad de uso de la Plataforma.
      </p>

      <h2>8. Datos personales</h2>
      <p>
        El tratamiento de tus datos se rige por nuestra{' '}
        <a href="/privacidad">Política de Privacidad</a>.
      </p>

      <h2>9. Cambios y contacto</h2>
      <p>
        Podemos actualizar estas condiciones y publicaremos la versión vigente en esta página.
        Consultas: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>
    </LegalLayout>
  );
}

export default Terminos;
