// Prueba la conexión con la API de Anthropic: node scripts/probar-anthropic.js
// Red: prioriza IPv4 y da más tiempo para conectar (evita ETIMEDOUT con IPv6 mal enrutado)
require('dns').setDefaultResultOrder('ipv4first');
require('net').setDefaultAutoSelectFamilyAttemptTimeout(2000);
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  console.log('Clave cargada:', key ? `sí (${key.length} caracteres)` : 'NO');

  console.log('\n1) Llamada con fetch directo...');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Di hola' }] }),
    });
    console.log('Estado:', r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.log('ERROR fetch:', e.message, '| causa:', e.cause);
  }

  console.log('\n2) Llamada con el SDK...');
  try {
    const client = new Anthropic({ apiKey: key });
    const r = await client.messages.create({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Di hola' }] });
    console.log('OK:', JSON.stringify(r.content));
  } catch (e) {
    console.log('ERROR SDK:', e.status, e.message, '| causa:', e.cause);
  }
}
main();
