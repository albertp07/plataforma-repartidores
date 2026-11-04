import LegalLayout from '../components/LegalLayout';

const CONTACTO = 'albertpena070103@gmail.com';

function Privacidad() {
  return (
    <LegalLayout
      titulo="Política de Privacidad"
      tituloPestana="Política de Privacidad"
      actualizado="4 de noviembre de 2026"
    >
      <p>
        Esta política explica qué datos recopila la Plataforma Repartidores (en adelante,
        &quot;la Plataforma&quot;), operada por Aryal SpA, cómo los usamos y qué derechos
        tienes sobre ellos. La Plataforma es una herramienta de gestión financiera y control
        operativo para repartidores de última milla y sus administradores.
      </p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li>
          <strong>Datos de tu cuenta de Google</strong>, si inicias sesión con Google: tu
          nombre, tu correo electrónico verificado y un identificador único de cuenta. No
          accedemos a tus contactos, correos, archivos ni a ningún otro servicio de Google.
        </li>
        <li>
          <strong>Datos de registro manual</strong>: nombre, correo, contraseña (almacenada
          cifrada, nunca en texto plano) y, opcionalmente, teléfono y vehículo.
        </li>
        <li>
          <strong>Datos operativos y financieros</strong> que tú o tu administrador ingresan:
          rutas, entregas, retiros, ingresos, gastos y balances.
        </li>
      </ul>

      <h2>2. Para qué usamos tus datos</h2>
      <ul>
        <li>Identificarte y permitirte acceder a la Plataforma de forma segura.</li>
        <li>Asociar tu información financiera y operativa a tu cuenta.</li>
        <li>Permitir que el administrador revise y apruebe solicitudes de acceso.</li>
        <li>Generar reportes y resúmenes de tu actividad.</li>
      </ul>

      <h2>3. Con quién los compartimos</h2>
      <p>
        No vendemos ni cedemos tus datos a terceros con fines comerciales. Tu información
        solo es visible para ti y para los administradores de la Plataforma. Podemos
        divulgarla únicamente si una autoridad competente lo exige conforme a la ley.
      </p>

      <h2>4. Uso de la información de Google</h2>
      <p>
        El uso de la información obtenida desde Google se limita a autenticar tu identidad
        (nombre y correo) dentro de la Plataforma. No se usa para publicidad ni se transfiere
        a terceros.
      </p>

      <h2>5. Conservación y seguridad</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Aplicamos medidas técnicas
        razonables para protegerlos, como cifrado de contraseñas y comunicaciones seguras
        (HTTPS).
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Puedes solicitar el acceso, la rectificación o la eliminación de tus datos
        personales, o revocar el acceso de la Plataforma a tu cuenta de Google desde la
        configuración de tu cuenta de Google. Para ejercer estos derechos escríbenos a{' '}
        <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>

      <h2>7. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política. Publicaremos la versión vigente en esta misma
        página junto con su fecha de actualización.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Consultas sobre privacidad: <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
      </p>
    </LegalLayout>
  );
}

export default Privacidad;
