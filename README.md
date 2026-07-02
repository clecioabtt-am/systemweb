# Gestão de Polo CEEB — Cloudflare + Asaas

Projeto novo compatível com Cloudflare Pages, D1, KV e API Asaas.

## Configuração Cloudflare Pages

- Build command: deixe vazio
- Build output directory: `public`

## Bindings obrigatórios

Em **Settings > Bindings**, crie:

- KV namespace: `CEEB_KV`
- D1 database: `CEEB_DB` apontando para `ceeb_db`

## Variáveis obrigatórias

Em **Settings > Variables and secrets**, crie:

- `SUPPORT_MASTER_KEY` — chave de acesso do suporte
- `ASAAS_API_KEY` — chave da API Asaas
- `ASAAS_ENV` — `production` ou `sandbox`

## Banco D1

Execute o arquivo `schema.sql` no console do D1 usando **Run all in sequence**.

## Primeiro acesso

Acesse `/login`, escolha **Suporte** e digite o valor de `SUPPORT_MASTER_KEY`.

## Rotas principais

- `/login`
- `/dashboard`
- `/clientes/manual`
- `/clientes/polo`
- `/clientes/lote`

## Observação

Este projeto não usa Supabase e não expõe a chave do Asaas no navegador. Toda chamada ao Asaas passa pelas Cloudflare Pages Functions.

## Correção de redirecionamento
Esta versão remove o arquivo `public/_redirects` para evitar loop de redirecionamento no Cloudflare Pages.
As rotas principais agora existem como pastas com `index.html`:
- `/login/`
- `/dashboard/`
- `/clientes/manual/`
- `/clientes/polo/`
- `/clientes/lote/`
