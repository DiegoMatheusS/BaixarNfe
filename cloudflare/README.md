# Proteção WAF — procurandodanfe.com.br

Configuração feita com base no pacote do site **v2.74**, sem mudar páginas, layout, arquivos do Worker ou funcionalidades.

**ATENÇÃO:** Enviar arquivos ao GitHub ou publicar um ZIP no Cloudflare Pages **não ativa regras WAF**. As regras precisam ser cadastradas no painel Cloudflare ou publicadas pela API.

## Regras

### 1. Bloqueio de Scan Malicioso (ativar)

Campo **Expressão**, ação **Block**:

```txt
(lower(http.request.uri.path) contains ".env" or lower(http.request.uri.path) contains "wp-login")
```

Bloqueia tentativas com esses padrões em qualquer parte do caminho, ignorando maiúsculas/minúsculas.

### 2. Desafio para tráfego estrangeiro (opcional)

Campo **Expressão**, ação **Managed Challenge**:

```txt
(ip.src.country ne "BR" and not cf.client.bot and not starts_with(lower(http.request.uri.path), "/api/") and not starts_with(lower(http.request.uri.path), "/cdn-cgi/"))
```

**Desativada por padrão**. Exclui bots reconhecidos e caminhos de API para reduzir impacto sobre indexação, integrações e webhooks (incluindo Mercado Pago). Pode afetar usuários de VPN e clientes no exterior. Ative somente se desejar.

## Pelo painel

Cloudflare → `procurandodanfe.com.br` → **Security / Segurança → WAF → Custom Rules / Regras personalizadas**. Para cada regra use **Edit expression / Editar expressão**, a ação indicada e **Deploy / Implantar**. Verifique a ordem das regras se já houver outras regras de bloqueio/desafio.

## Por API (opcional)

Node.js 18+ e API Token com permissão `Zone WAF Write`; configure `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ZONE_ID` **somente no ambiente local**.

```bash
node cloudflare/deploy-waf.mjs
node cloudflare/deploy-waf.mjs --apply
node cloudflare/deploy-waf.mjs --apply --enable-foreign
```

O primeiro comando é só uma simulação. `--apply` ativa o bloqueio de scans. O último ativa também a regra opcional para tráfego estrangeiro. O script altera apenas suas duas regras, preservando outras regras existentes.

## Testes

- `/.env` e `/wp-login.php`: bloqueio na borda (tipicamente HTTP 403).
- `/`, `/guias/`, `/api/contact` e `/api/dashboard-store/webhooks/mercadopago`: fluxo funcional inalterado; aplique testes próprios após configuração.
- Consulte **Segurança → Eventos** na Cloudflare. A regra não impede todos os robôs nem garante normalização de todos os gráficos.

Referência oficial: https://developers.cloudflare.com/waf/custom-rules/create-api/
