# Gestão de Polo CEEB Web 3.0

Sistema web responsivo para Cloudflare Pages, com Cloudflare Functions, D1, KV, PWA e integração segura com API Asaas.

## O que está incluído

- Login de Suporte e Coordenador
- Suporte cria, bloqueia, libera e remove coordenadores
- Chave de acesso com expiração
- Logs de atividades
- Cadastro de polos
- Cadastro e atualização de alunos
- Cadastro em lote por CSV simples
- Emissão de cobranças via Asaas
- Criação de links de pagamento via Asaas
- Sincronização de status de faturas com Asaas
- Prestação de contas por polo
- Exportação CSV para Excel
- Layout verde/branco com logo CEEB
- PWA instalável no Android/iPhone

## Estrutura correta no GitHub

Envie os arquivos para o GitHub deixando esta estrutura na raiz do repositório:

```txt
public/
functions/
schema.sql
package.json
wrangler.toml
README.md
```

## Configuração no Cloudflare Pages

Em **Build settings**:

```txt
Framework preset: None
Build command: deixar vazio
Build output directory: public
Root directory: deixar vazio
```

## Bindings obrigatórios

No projeto Pages, vá em **Settings > Bindings** e crie:

### KV Namespace

```txt
Variable name: CEEB_KV
KV namespace: CEEB_KV
```

### D1 Database

O banco no Cloudflare deve ter nome minúsculo, por exemplo:

```txt
ceeb_db
```

No binding do Pages use:

```txt
Variable name: CEEB_DB
Database: ceeb_db
```

## Variáveis obrigatórias

Em **Settings > Variables and secrets**, crie:

```txt
SUPPORT_MASTER_KEY = sua chave mestra do suporte
ASAAS_API_KEY = sua chave de API do Asaas
ASAAS_ENV = production
```

Para testes do Asaas:

```txt
ASAAS_ENV = sandbox
```

## Primeiro acesso

Depois do deploy, acesse:

```txt
https://seu-projeto.pages.dev/login
```

Na tela de login, clique em **Inicializar banco**.

Depois entre como:

```txt
Perfil: Suporte
Chave: valor definido em SUPPORT_MASTER_KEY
```

## Criar coordenadores

No painel do Suporte:

1. Vá em **Coordenadores**
2. Clique em **Novo coordenador**
3. Informe nome, polo, chave e data de expiração
4. O coordenador entra pelo perfil **Coordenador** usando a chave criada

## Asaas

A chave da API Asaas fica apenas no backend do Cloudflare Functions. Ela não aparece no navegador.

Endpoints internos usados pelo frontend:

```txt
/api/asaas/customers
/api/asaas/invoices
/api/asaas/links
/api/asaas/sync
```

## Observação técnica

O banco D1 é inicializado automaticamente pelo endpoint:

```txt
/api/system/init
```

Também há um arquivo `schema.sql` para criar as tabelas manualmente pelo painel D1, se preferir.

## Instalar no celular

### Android / Chrome
Abra o site, toque nos três pontinhos e escolha **Adicionar à tela inicial**.

### iPhone / Safari
Abra o site, toque em compartilhar e escolha **Adicionar à Tela de Início**.

## Atualização Asaas — cadastro e atualização por Polo

Esta versão ajusta os módulos pedidos:

- **Cadastro manual** cria cliente diretamente no Asaas usando `POST /customers` com `name`, `cpfCnpj` e `complement`.
- **Atualizar por Polo** consulta clientes no Asaas cujo campo `complement` corresponde ao nome do polo informado, exibe nome/CPF/complemento e permite aplicar um novo complemento em lote.
- **Cadastro em lote** aceita CSV no formato `nome,cpf,complemento` ou `nome;cpf;complemento`, cadastrando os clientes diretamente no Asaas.
- A chave `ASAAS_API_KEY` continua protegida nas variáveis do Cloudflare Pages; ela nunca é exposta no navegador.

Observação: a API do Asaas não possui um filtro direto universal por `complement`; por isso a Function busca clientes paginados e filtra o campo `complement` no backend. Para contas com muitos clientes, use nomes de polos padronizados para facilitar a busca.


## Correção importante para Cloudflare Pages

Este projeto usa os bindings `CEEB_KV` e `CEEB_DB` configurados no painel do Cloudflare Pages:

- Settings > Bindings > KV namespace: `CEEB_KV`
- Settings > Bindings > D1 database: `CEEB_DB`

O arquivo `wrangler.toml` **não contém IDs de KV/D1**, porque IDs fictícios fazem o deploy falhar com erro `Invalid KV namespace ID`.
