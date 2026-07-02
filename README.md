# Gestão de Polo CEEB — Cloudflare + Asaas

Projeto pronto para GitHub + Cloudflare Pages.

## Configuração no Cloudflare Pages

- Framework preset: **None**
- Build command: deixe vazio
- Build output directory: **public**

## Variáveis obrigatórias

Em **Settings → Variables and secrets**:

- `ASAAS_API_KEY` = sua chave do Asaas
- `ASAAS_ENV` = `production` ou `sandbox`
- `SUPPORT_MASTER_KEY` = chave de acesso do suporte

## Bindings obrigatórios

Em **Settings → Bindings**:

- KV namespace: `CEEB_KV`
- D1 database: `CEEB_DB` apontando para o banco `ceeb_db`

## Banco D1

Execute o arquivo `schema.sql` no console do D1 usando **Run all in sequence**.

Tabelas criadas:

- `users`
- `polos`
- `students`
- `invoices`
- `payment_links`
- `accountability`
- `activity_logs`
- `settings`

## Ajustes desta versão

- Cadastro manual cria cliente diretamente no Asaas.
- Atualizar por Polo consulta clientes no Asaas pelo campo `complement`.
- Permite aplicar um novo complemento em toda a coluna.
- Botão **Atualizar cadastro no Asaas** envia a alteração em lote para o Asaas.
- Cadastro em lote aceita CSV no formato: `nome,cpf,complemento`.
- API do Asaas fica protegida nas Pages Functions, sem expor a chave no navegador.
- Mantida compatibilidade com o painel antigo baseado em `/login.html` e com o app novo em `/app`.

## Login do suporte

Use o valor cadastrado em `SUPPORT_MASTER_KEY`.

