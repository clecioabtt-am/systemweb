# Gestão de Polo CEEB — Cloudflare Pages

Versão web adaptada para hospedar no Cloudflare Pages, sem Supabase e sem servidor Python.

## O que mudou

- Frontend estático em `public/`.
- Backend em Cloudflare Pages Functions em `functions/api/[[path]].js`.
- Dados internos simples em Cloudflare KV: sessões, logs e links de pagamento.
- Integração Asaas protegida no backend via variável secreta `ASAAS_API_KEY`.
- Layout minimalista verde e branco com logo da escola.

## Recursos mantidos/adaptados

- Login por chave de parceiro.
- Dashboard.
- Cadastro manual de aluno/cliente no Asaas.
- Atualização/listagem por polo.
- Emissão manual de fatura.
- Emissão de faturas por polo.
- Consulta por polo.
- Consulta por nome/CPF.
- Links de pagamento.
- Prestação de contas por polo e período.
- Exportação em CSV pelo navegador.

## Configuração no Cloudflare

1. Suba este projeto para um repositório GitHub.
2. No Cloudflare, crie um projeto em **Workers & Pages > Pages > Connect to Git**.
3. Selecione o repositório.
4. Build command: deixe vazio.
5. Build output directory: `public`.
6. Em **Settings > Functions > KV namespace bindings**, crie/adicionar:
   - Variable name: `CEEB_DATA`
   - Namespace: o KV criado para o sistema.
7. Em **Settings > Environment variables**, adicione:
   - `ASAAS_API_KEY` = sua chave do Asaas.
   - `ASAAS_PRODUCTION` = `true` para produção ou `false` para sandbox.
   - `TOKEN_SECRET_KEY` = a mesma chave usada para gerar as chaves de acesso.
   - Opcional: `SESSION_TIMEOUT_SECONDS` = `300`.

## Sobre as chaves de login

O sistema aceita o mesmo formato de token do app antigo:

`base64url("PARCEIRO|YYYY-MM-DD HH:MM:SS|assinatura_hmac_sha256")`

A assinatura usa HMAC SHA-256 com `TOKEN_SECRET_KEY` sobre:

`PARCEIRO|YYYY-MM-DD HH:MM:SS`

## Observação importante

Cloudflare Pages Functions não executa Flask/Python. Por isso esta versão substitui o backend Python por JavaScript serverless compatível com Cloudflare.

## Gerar chave de acesso pelo computador

Com Node.js instalado, rode:

```bash
node tools/gerar-chave.mjs "NOME DO PARCEIRO" "2026-12-31 23:59:59" "SUA_CHAVE_SECRETA"
```

Cole o resultado na tela de login.

## Atualização responsiva + PWA

Esta versão foi ajustada para uso em desktop, tablets, Android e iPhone:

- Layout responsivo com menu lateral no desktop e menu recolhível no celular.
- Campos maiores no mobile para evitar zoom automático no iPhone.
- Tabelas com rolagem horizontal para relatórios grandes.
- Cabeçalho mobile fixo com botão de menu.
- Manifest PWA em `public/manifest.webmanifest`.
- Service Worker em `public/sw.js` para permitir instalação como aplicativo.
- Botão **Adicionar como app** dentro do sistema.

### Como adicionar na tela inicial

**Android / Chrome:** abra o site, toque em **Adicionar como app** ou no menu do navegador e escolha **Instalar app**.

**iPhone / Safari:** abra o site no Safari, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

> Observação: para a instalação funcionar corretamente, o site precisa estar publicado com HTTPS. O Cloudflare Pages já fornece HTTPS automaticamente.

## Área de Suporte e Coordenadores

Esta versão possui dois perfis de acesso:

- **Coordenador:** acessa as rotinas operacionais do polo, como alunos, faturas, consultas, links e prestação de contas.
- **Suporte:** acessa tudo que o coordenador acessa e também os menus **Acessos dos coordenadores** e **Atividades do sistema**.

### Como criar o primeiro acesso de suporte

No painel da Cloudflare, adicione uma variável de ambiente chamada:

```txt
SUPPORT_ACCESS_KEY
```

Coloque uma chave forte, por exemplo:

```txt
CEEB-SUPORTE-2026-TROQUE-ESTA-CHAVE
```

Depois faça novo deploy. Use essa chave na tela de login para entrar como suporte.

### Criar login de coordenador

Entre como suporte e acesse:

```txt
Acessos dos coordenadores
```

Lá você poderá:

- Criar login para cada coordenador.
- Definir polo/unidade do coordenador.
- Definir data de expiração da chave.
- Copiar a chave gerada e enviar ao coordenador.
- Bloquear ou liberar acesso a qualquer momento.
- Remover um acesso.

> A chave criada aparece somente uma vez por segurança. Se perder, remova o acesso e crie outro.

### Monitorar atividades

Entre como suporte e acesse:

```txt
Atividades do sistema
```

Esse menu mostra os registros de login, emissão de faturas, cadastros, bloqueios, liberações e demais ações importantes dos coordenadores.
