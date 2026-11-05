"""
Serviço de cache para respostas dos agentes de IA.

Persiste e recupera ResultadoConsolidado na tabela `cache_agentes` do SQLite.
Usa sha256(codigo_ibge + pergunta_normalizada) como chave de lookup.

Por que cachear o ResultadoConsolidado e não cada agente individualmente?
- A pergunta do usuário dirige toda a investigação, inclusive os sub-agentes.
- Cachear no nível do consolidador evita chamadas desnecessárias à GroqCloud
  mesmo quando apenas um dos sub-agentes já foi executado.
- Custo de cache miss: 3 chamadas Groq. Custo de hit: 1 query SQLite (~1 ms).
"""
from __future__ import annotations

import hashlib
import json
import logging
import unicodedata
from typing import Optional

from app.agents.schemas import ResultadoConsolidado
from app.db.database import get_db

logger = logging.getLogger(__name__)

# TTL em horas — respostas mais antigas são ignoradas (None = sem expiração)
CACHE_TTL_HORAS: Optional[int] = 24


def _normalizar(texto: str) -> str:
    """Remove acentos, converte para minúsculo e colapsa espaços."""
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sem_acento.lower().split())


def _hash_pergunta(codigo_ibge: str, pergunta: str) -> str:
    """Gera chave determinística para (município, pergunta)."""
    entrada = f"{codigo_ibge}::{_normalizar(pergunta)}"
    return hashlib.sha256(entrada.encode()).hexdigest()[:32]


async def get_cache(
    codigo_ibge: str,
    pergunta: str,
) -> Optional[ResultadoConsolidado]:
    """
    Tenta recuperar um ResultadoConsolidado do cache.
    Retorna None se não houver entrada válida ou se o TTL tiver expirado.
    """
    hash_key = _hash_pergunta(codigo_ibge, pergunta)
    ttl_clause = (
        f"AND criado_em >= datetime('now', '-{CACHE_TTL_HORAS} hours')"
        if CACHE_TTL_HORAS is not None
        else ""
    )

    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            f"""
            SELECT resposta_json FROM cache_agentes
            WHERE codigo_ibge = ?
              AND agente = 'consolidator'
              AND pergunta_hash = ?
              {ttl_clause}
            ORDER BY criado_em DESC
            LIMIT 1
            """,
            (codigo_ibge, hash_key),
        )
        if not rows:
            return None

        data = json.loads(rows[0]["resposta_json"])
        resultado = ResultadoConsolidado.model_validate(data)
        logger.info(
            "Cache hit — municipio=%s hash=%s", codigo_ibge, hash_key[:8]
        )
        return resultado

    except Exception as exc:  # noqa: BLE001
        # Cache nunca deve impedir a investigação — falha silenciosa
        logger.warning("Erro ao ler cache de agentes: %s", exc)
        return None
    finally:
        await db.close()


async def set_cache(
    codigo_ibge: str,
    pergunta: str,
    resultado: ResultadoConsolidado,
) -> None:
    """
    Persiste um ResultadoConsolidado no cache.
    Silencia erros — o cache é auxiliar e nunca deve interromper o fluxo.
    """
    hash_key = _hash_pergunta(codigo_ibge, pergunta)

    try:
        resposta_json = resultado.model_dump_json()
        tokens = resultado.tokens_totais

        db = await get_db()
        try:
            await db.execute(
                """
                INSERT OR REPLACE INTO cache_agentes
                    (codigo_ibge, agente, pergunta_hash, resposta_json, modelo, tokens_usados)
                VALUES (?, 'consolidator', ?, ?, ?, ?)
                """,
                (
                    codigo_ibge,
                    hash_key,
                    resposta_json,
                    resultado.modelo_consolidador,
                    tokens,
                ),
            )
            await db.commit()
            logger.info(
                "Cache set — municipio=%s hash=%s tokens=%s",
                codigo_ibge, hash_key[:8], tokens,
            )
        finally:
            await db.close()

    except Exception as exc:  # noqa: BLE001
        logger.warning("Erro ao salvar cache de agentes: %s", exc)
