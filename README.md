# NexVot - Gestão Inteligente

Painel pessoal de gastos, contas e rotina. Site estático (HTML + CSS + JS puro),
sem build, sem framework, sem `node_modules`. Backend: Supabase. Deploy: Vercel.

---

## Estrutura

```
nexvot-gestao/
├── index.html      markup + todo o CSS
├── app.js          toda a lógica (módulo ES, importa supabase-js do esm.sh)
├── config.js       URL e chave anon do Supabase  ← você edita
├── manifest.json   instalação na tela de início / área de trabalho
├── schema.sql      tabelas + RLS (rodar uma vez no Supabase)
└── README.md
```

Tudo na raiz. Sem subpastas: o `index.html` referencia `./config.js` e `./app.js`
por caminho relativo, então qualquer pasta quebra o carregamento.

Não existe passo de build. O que está no repo é exatamente o que roda.

---

## Ordem de montagem

### 1. Supabase

1. Crie o projeto.
2. **SQL Editor** → cole o `schema.sql` inteiro → Run.
   Ele é idempotente: pode rodar de novo sem quebrar nada.
3. **Authentication → Sign In / Providers** → ligue **Allow anonymous sign-ins**.
   Sem isso o app abre numa tela preta com o erro explicando exatamente isso.
4. **Settings → API** → copie a **Project URL** e a chave **anon / publishable**.

### 2. config.js

```js
window.CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

A chave anon é pública por design — ela vai no JS que qualquer um baixa.
Quem protege os dados é o RLS do `schema.sql`, não o sigilo da chave.
**Nunca** coloque aqui a `service_role`: essa ignora RLS e dá acesso total.

### 3. GitHub

Pelo editor web, sem clonar nada:

1. **New repository** → nome `nexvot-gestao` → **Private** → *Add a README* desmarcado.
2. Na tela vazia do repo: **uploading an existing file** → arraste os 6 arquivos.
3. Commit direto na `main`.

Para atualizar um arquivo depois: abra o arquivo → ícone de lápis →
selecione tudo (Ctrl/Cmd+A) → cole a versão nova → **Commit changes**.
Cada arquivo é sempre substituído inteiro, nunca remendado.

### 4. Vercel

1. **Add New → Project** → importe o repo.
2. Framework Preset: **Other**.
3. Build Command: vazio. Output Directory: vazio. Install Command: vazio.
4. Deploy.

Cada `commit` na `main` redeploya sozinho.

### 5. Instalar

- **iPhone**: Safari → Compartilhar → Adicionar à Tela de Início.
- **Computador**: Chrome/Edge → ícone de instalar na barra de endereço.

Instale **antes** de lançar qualquer coisa. No iOS o armazenamento do app
instalado é separado do Safari — se você usar no navegador primeiro, o app
instalado abre zerado.

---

## Onde mexer

| Quero mudar | Arquivo | Onde |
|---|---|---|
| Cor laranja | `index.html` + `app.js` + `manifest.json` | `--laranja`, `const LARANJA`, ícones |
| Categorias de gasto | `app.js` | `CATEGORIAS` |
| Rotina pronta | `app.js` | `ROTINA_PRONTA` |
| Blocos da rotina | `app.js` + `schema.sql` | `BLOCOS` e o `check` da coluna `bloco` |
| Textos e telas | `index.html` | markup |

Ao adicionar um bloco novo de rotina, o `check (bloco in (...))` do `schema.sql`
precisa mudar junto, senão o insert é rejeitado pelo Postgres.

---

## Limites conhecidos

- **Sem offline.** Sem rede, não abre.
- **Sessão anônima presa ao navegador.** Limpar dados do Safari perde o acesso
  (os registros continuam no Postgres, mas sem o token não há como chegar neles).
  Caminho de saída sem perder nada: `supabase.auth.updateUser({ email })` converte
  o usuário anônimo em permanente mantendo o mesmo `user_id`.
- **Sem sincronia entre aparelhos** enquanto a sessão for anônima.
- **`esm.sh` é dependência em runtime.** Se o CDN cair, o app não carrega.
- **"Paguei" lança o gasto na data de hoje**, não na data do vencimento.
- **O calendário mostra a conta vencendo em todo mês**, inclusive em meses
  anteriores ao cadastro dela.
- **Sem vibração no iPhone.** `navigator.vibrate` não existe no Safari iOS.

## Backup

Aba **Números → Baixar backup** exporta tudo em JSON. Faça de vez em quando.
