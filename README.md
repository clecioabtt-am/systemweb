# Gestão de Polo CEEB — Cloudflare Web 2.0

Sistema web responsivo e instalável como app (PWA), criado para Cloudflare Pages + Functions + KV, sem Supabase e sem servidor Python.

## Estrutura correta no GitHub

Suba estes arquivos exatamente assim:

``` 
public/
functions/
tools/
package.json
README.md
```

No Cloudflare Pages configure:

- Framework preset: `None`
- Build command: vazio
- Build output directory: `public`

## KV obrigatório

Crie um KV Namespace chamado `CEEB_KV` e vincule no Pages com o nome de variável:

```
CEEB_KV
```

## Variáveis/segredos recomendados

Em Settings > Variables and Secrets:

```
SUPPORT_MASTER_KEY=sua-chave-secreta-do-suporte
ASAAS_API_KEY=sua-chave-asaas-opcional
```

Se `SUPPORT_MASTER_KEY` não for definido, o sistema usa `ceeb-suporte-2026` para primeiro acesso.

## Primeiro acesso

Abra `/login.html` e escolha **Suporte**.

Chave inicial padrão:

```
ceeb-suporte-2026
```

Depois, crie os coordenadores em **Suporte > Coordenadores**.

## Funcionalidades principais

- Área do Suporte
- Área do Coordenador
- Criação de coordenadores com chave e expiração
- Bloquear/liberar coordenadores
- Logs de atividades
- Cadastro manual de alunos/clientes
- Cadastro em lote via CSV
- Atualização por polo
- Consulta por polo, nome e CPF
- Emissão manual de fatura
- Emissão por polo
- Geração/listagem de links de pagamento
- Prestação de contas por polo
- Exportação CSV
- PWA instalável no Android/iPhone
- Layout verde/branco responsivo

## Observação sobre Asaas

A integração real com Asaas depende da chave `ASAAS_API_KEY`. Sem ela, o sistema gera links simulados/controlados internamente para teste.
