"""
Script de seed do banco de dados NEXORA.

Popula a tabela municipios com os 645 municípios do Estado de São Paulo
a partir dos dados oficiais do IBGE (API v1).

Fonte: https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios
Fonte: https://servicodados.ibge.gov.br/api/v3/malhas/municipios?intrarregiao=UF&geocodigo=35
"""
from __future__ import annotations

import asyncio
import json
import unicodedata
import sys
from pathlib import Path

# Garante que o módulo app é encontrado ao rodar direto
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.db.database import init_db, get_db


def normalizar(texto: str) -> str:
    """Remove acentos e converte para minúsculo para busca."""
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    ).lower()


def _mesorregiao(m: dict) -> str | None:
    try:
        return m["microrregiao"]["mesorregiao"]["nome"]
    except (KeyError, TypeError):
        return None


def _microrregiao(m: dict) -> str | None:
    try:
        return m["microrregiao"]["nome"]
    except (KeyError, TypeError):
        return None


def _regiao_imediata(m: dict) -> str | None:
    try:
        return m["regiao-imediata"]["regiao-intermediaria"]["nome"]
    except (KeyError, TypeError):
        return None


async def seed_municipios(raw_path: Path) -> int:
    data: list[dict] = json.loads(raw_path.read_text(encoding="utf-8-sig"))

    registros = [
        (
            str(m["id"]),
            m["nome"],
            normalizar(m["nome"]),
            _regiao_imediata(m),
            _mesorregiao(m),
            _microrregiao(m),
        )
        for m in data
    ]

    db = await get_db()
    try:
        await db.executemany(
            """
            INSERT OR IGNORE INTO municipios
                (codigo_ibge, nome, nome_normalizado,
                 regiao_administrativa, mesorregiao, microrregiao)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            registros,
        )
        await db.commit()
        count = len(registros)
        print(f"✓ {count} municípios inseridos/atualizados.")
        return count
    finally:
        await db.close()


async def main() -> None:
    raw = Path(__file__).parent / "municipios_ibge_raw.json"
    if not raw.exists():
        print(f"Arquivo não encontrado: {raw}")
        sys.exit(1)

    print("Inicializando banco de dados…")
    await init_db()

    print("Populando municípios…")
    total = await seed_municipios(raw)
    print(f"Seed concluído: {total} municípios do Estado de São Paulo.")


if __name__ == "__main__":
    asyncio.run(main())
