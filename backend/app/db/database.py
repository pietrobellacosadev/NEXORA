"""
Gerenciador do banco de dados SQLite com aiosqlite.
Cria as tabelas na primeira execução e fornece conexão assíncrona.
"""
from __future__ import annotations

import aiosqlite
from pathlib import Path
from app.config import settings

# DDL — criado na ordem correta (sem FK circular)
SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Municípios do Estado de São Paulo
CREATE TABLE IF NOT EXISTS municipios (
    codigo_ibge         TEXT PRIMARY KEY,
    nome                TEXT NOT NULL,
    nome_normalizado    TEXT NOT NULL,          -- minúsculo, sem acento, para busca
    regiao_administrativa TEXT,
    mesorregiao         TEXT,
    microrregiao        TEXT,
    latitude            REAL,
    longitude           REAL,
    area_km2            REAL,
    populacao_estimada  INTEGER,
    populacao_ano       INTEGER,
    criado_em           TEXT DEFAULT (datetime('now'))
);

-- Indicadores municipais
CREATE TABLE IF NOT EXISTS indicadores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_ibge     TEXT NOT NULL REFERENCES municipios(codigo_ibge),
    categoria       TEXT NOT NULL CHECK(categoria IN ('mercado','social')),
    chave           TEXT NOT NULL,              -- ex: populacao, escolas, ops_movel
    nome            TEXT NOT NULL,
    valor_num       REAL,
    valor_txt       TEXT,
    unidade         TEXT,
    fonte           TEXT NOT NULL,
    periodo         TEXT NOT NULL,              -- ex: 2022, 2023-Q1
    tipo            TEXT NOT NULL CHECK(tipo IN ('oficial','calculado','estimado','indisponivel')),
    limitacoes      TEXT,
    coletado_em     TEXT DEFAULT (datetime('now')),
    UNIQUE(codigo_ibge, chave, periodo)
);

-- Cache de respostas dos agentes (evita chamadas repetidas à GroqCloud)
CREATE TABLE IF NOT EXISTS cache_agentes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_ibge     TEXT NOT NULL,
    agente          TEXT NOT NULL CHECK(agente IN ('market','social','consolidator')),
    pergunta_hash   TEXT NOT NULL,
    resposta_json   TEXT NOT NULL,
    modelo          TEXT NOT NULL,
    tokens_usados   INTEGER,
    criado_em       TEXT DEFAULT (datetime('now')),
    UNIQUE(codigo_ibge, agente, pergunta_hash)
);

CREATE INDEX IF NOT EXISTS idx_indicadores_municipio ON indicadores(codigo_ibge);
CREATE INDEX IF NOT EXISTS idx_indicadores_categoria ON indicadores(categoria);
CREATE INDEX IF NOT EXISTS idx_municipios_nome ON municipios(nome_normalizado);
CREATE INDEX IF NOT EXISTS idx_cache_lookup ON cache_agentes(codigo_ibge, agente, pergunta_hash);
"""


async def get_db() -> aiosqlite.Connection:
    """Retorna uma conexão aberta. O chamador é responsável por fechar."""
    db = await aiosqlite.connect(settings.db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db() -> None:
    """Cria as tabelas se não existirem. Chamado na inicialização da API."""
    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(settings.db_path) as db:
        await db.executescript(SCHEMA)
        await db.commit()
