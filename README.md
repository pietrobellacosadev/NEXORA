# NEXORA

Plataforma de inteligência territorial baseada em Inteligência Artificial Agêntica, voltada à identificação e análise de oportunidades de expansão da conectividade no Estado de São Paulo.

Desenvolvida para apresentação institucional a representantes da IBM e da Fundação Telefônica.

---

## Sobre o projeto

O NEXORA permite investigar os 645 municípios paulistas a partir de dois pilares de igual importância:

- **Potencial de mercado** — características econômicas, demográficas, indicadores de conectividade e presença de operadoras.
- **Potencial social** — indicadores educacionais, de saúde, necessidades de inclusão digital e impacto social da conectividade.

Três agentes de IA especializados (Mercado, Social e Consolidador) coordenam as investigações e produzem análises fundamentadas, com fontes, períodos e limitações sempre à vista.

---

## Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Estilo | CSS próprio com design tokens |
| Gráficos | Recharts |
| Mapas | Leaflet + GeoJSON |
| Animações | Framer Motion |
| Ícones | Lucide React |
| Backend | Python 3.15, FastAPI, Pydantic v2 |
| Banco de dados | SQLite (aiosqlite) |
| IA | GroqCloud exclusivamente |
| Testes (backend) | Pytest + pytest-asyncio |
| Testes (frontend) | Vitest + Testing Library |

---

## Estrutura do repositório

```
NEXORA/
├── frontend/          # Aplicação React + TypeScript
│   ├── src/
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── styles/        # Design tokens e CSS global
│   │   ├── types/         # Tipos TypeScript
│   │   └── lib/           # Utilitários e cliente HTTP
│   └── ...
├── backend/           # API FastAPI + agentes de IA
│   ├── app/
│   │   ├── agents/        # Agentes de Mercado, Social e Consolidador
│   │   ├── api/routes/    # Endpoints da API
│   │   ├── db/            # Banco de dados, migrations e seed
│   │   ├── models/        # Modelos Pydantic
│   │   └── services/      # Cliente GroqCloud e serviços
│   ├── tests/
│   ├── .env.example   # Variáveis de ambiente (nunca commitar .env)
│   └── requirements.txt
└── README.md
```

---

## Como executar localmente

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Configurar variáveis de ambiente
copy .env.example .env
# Editar .env com sua chave GROQ_API_KEY

# Popular o banco de dados
python -m app.db.seed

# Iniciar o servidor
python run.py
# API disponível em http://127.0.0.1:8000
# Documentação em http://127.0.0.1:8000/api/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Interface disponível em http://localhost:5173
```

### Testes

```bash
# Backend
cd backend
python -m pytest tests/ -v

# Frontend
cd frontend
npm test
```

---

## Convenções de commit

Este projeto utiliza mensagens de commit em **português**, com um prefixo opcional que indica a natureza da alteração. O objetivo é manter o histórico legível e rastreável.

### Prefixos utilizados

| Prefixo | Quando usar | Exemplo |
|---|---|---|
| `feat` | Nova funcionalidade ou recurso | `feat: mapa interativo dos municípios paulistas` |
| `fix` | Correção de bug ou comportamento incorreto | `fix: busca de município não retornava resultados com acento` |
| `chore` | Configuração, setup, dependências, scaffold | `chore: configura vite com proxy para o backend` |
| `security` | Correção ou melhoria de segurança | `security: chaves GroqCloud protegidas com SecretStr` |
| `test` | Adição ou correção de testes | `test: cobertura do endpoint de validação de credenciais` |
| `docs` | Documentação, comentários, README | `docs: atualiza .env.example com novas variáveis dos agentes` |
| `style` | Ajuste visual, CSS, identidade | `style: refinamento do hero e cards do dashboard` |
| `refactor` | Melhoria de código sem alterar comportamento | `refactor: extrai lógica de normalização para utilitário` |
| `perf` | Melhoria de desempenho | `perf: cache de respostas dos agentes no banco local` |
| `db` | Mudanças no banco de dados ou dados | `db: seed com 645 municípios reais do IBGE` |
| `agent` | Implementação ou ajuste dos agentes de IA | `agent: agente consolidador integra resultados em paralelo` |
| `api` | Endpoints, rotas, contratos da API | `api: endpoint de perfil municipal com indicadores reais` |

### Boas práticas

- Mensagem no **imperativo presente**: "adiciona", "corrige", "atualiza" — não "adicionado" ou "adicionando".
- Descrição objetiva do **o quê** foi feito, não do **porquê** (o porquê vai no corpo do commit quando necessário).
- Commits **pequenos e frequentes**, cada um representando uma alteração coerente.
- Nunca commitar arquivos `.env`, chaves de API, senhas ou credenciais.
- Testar antes de commitar. Não commitar testes com falha sem justificativa.

### Exemplo de commit com corpo

```
feat: agente de mercado analisa indicadores ANATEL por município

Consulta os dados de prestadoras de telefonia móvel e internet fixa
disponíveis na API ANATEL. Trata dados ausentes como indisponíveis,
não como zero. Retorna fonte, período e limitações para cada indicador.
```

---

## Segurança

- Credenciais ficam **exclusivamente** no arquivo `backend/.env` (ignorado pelo git).
- Chaves GroqCloud são carregadas como `SecretStr` — nunca aparecem em logs, `repr()` ou respostas da API.
- O frontend nunca recebe nem armazena credenciais.
- O arquivo `.env.example` contém apenas nomes de variáveis e valores fictícios.

---

## Branches

| Branch | Finalidade |
|---|---|
| `main` | Versão estável e validada |
| `pietro` | Desenvolvimento ativo |

Toda implementação ocorre na branch `pietro`. A integração com `main` é feita gradualmente, mediante revisão e autorização explícita.
