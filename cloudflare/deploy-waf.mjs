#!/usr/bin/env node
// Configuracao idempotente: preserva regras WAF existentes fora destas referencias.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const flags = new Set(process.argv.slice(2));
if (flags.has('--help') || flags.has('-h')) {
  console.log('Uso: node cloudflare/deploy-waf.mjs [--apply] [--enable-foreign]');
  console.log('Sem --apply: simulacao. --enable-foreign: habilita desafio geografico opcional.');
  process.exit(0);
}
for (const arg of flags) {
  if (!['--apply', '--enable-foreign'].includes(arg)) throw new Error('Argumento desconhecido: ' + arg);
}
const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'waf-rules.json'), 'utf8'));
const activeRules = config.rules.map(({ description, ref, expression, action, enabled }) => ({
  description, ref, expression, action,
  enabled: ref === 'procurandodanfe_foreign_challenge_v1' ? flags.has('--enable-foreign') : enabled
}));
if (!flags.has('--apply')) {
  console.log('SIMULACAO: nenhuma alteracao enviada a Cloudflare.');
  console.log(JSON.stringify(activeRules, null, 2));
  console.log('Para publicar: node cloudflare/deploy-waf.mjs --apply');
  process.exit(0);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (!token || !zoneId) throw new Error('Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID como variaveis de ambiente locais. Nunca grave segredos no Git.');
if (!/^[0-9a-f]{32}$/i.test(zoneId)) throw new Error('CLOUDFLARE_ZONE_ID deve ter 32 caracteres hexadecimais.');
const base = 'https://api.cloudflare.com/client/v4/zones/' + zoneId;
async function cf(method, endpoint, body, allow404 = false) {
  const response = await fetch(base + endpoint, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (allow404 && response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    const messages = (payload.errors || []).map(x => x.message || String(x)).join('; ');
    throw new Error('Cloudflare ' + method + ' ' + endpoint + ': HTTP ' + response.status + ' ' + messages);
  }
  return payload.result;
}

const endpoint = '/rulesets/phases/' + config.phase + '/entrypoint';
const entry = await cf('GET', endpoint, undefined, true);
if (!entry) {
  const created = await cf('POST', '/rulesets', {
    name: 'Procurando DANFE - WAF', kind: 'zone', phase: config.phase, rules: activeRules
  });
  console.log('Ruleset criado: ' + created.id);
} else {
  for (const rule of activeRules) {
    const existing = (entry.rules || []).find(x => x.ref === rule.ref || x.description === rule.description);
    const resource = '/rulesets/' + entry.id + '/rules';
    if (existing) {
      if (existing.expression === rule.expression && existing.action === rule.action && existing.enabled === rule.enabled) {
        console.log('Sem alteracao: ' + rule.description);
        continue;
      }
      await cf('PATCH', resource + '/' + existing.id, rule);
      console.log('Atualizada: ' + rule.description);
    } else {
      await cf('POST', resource, rule);
      console.log('Criada: ' + rule.description + (rule.enabled ? ' (ativa)' : ' (desativada)'));
    }
  }
}
console.log('Pronto. Confira Cloudflare > Seguranca > Eventos.');
