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


## Correção aplicada — Asaas User-Agent

Esta versão inclui o cabeçalho obrigatório `User-Agent` em todas as requisições para a API do Asaas.

Após publicar no Cloudflare, teste:

```txt
/api/asaas/ping
```

Se a configuração estiver correta, a resposta será:

```json
{"ok":true,"message":"Conexão com Asaas funcionando."}
```

Configurações esperadas no Cloudflare Pages:

- `ASAAS_API_KEY` — Secret, sem aspas.
- `ASAAS_ENV` — `production` ou `sandbox`.
- `SUPPORT_MASTER_KEY`
- Binding KV: `CEEB_KV`
- Binding D1: `CEEB_DB`

## Atualização: seleção de Polo pelo Asaas

A tela `/clientes/polo/` agora carrega automaticamente os Polos existentes no Asaas a partir do campo `complement` dos clientes.

Nova rota criada:

```txt
GET /api/asaas/polos
```

Ela busca clientes no Asaas, agrupa os valores únicos do campo `complement` e mostra a quantidade de clientes por Polo. A lista usa cache no `CEEB_KV` por 10 minutos. Para atualizar manualmente a lista, use o botão **Atualizar lista de Polos** na tela.

## Atualização - Baixar lista de alunos
- Menu "Buscar clientes por Polo" alterado para "Baixar lista de alunos".
- Nova rota: `/clientes/lista/`.
- Seleciona Polo existente no Asaas, carrega apenas clientes cujo `complement` é exatamente igual ao Polo selecionado e exibe em ordem alfabética.
- Exporta lista em PDF ou XLSX pela rota `/api/reports/students-by-polo`.
