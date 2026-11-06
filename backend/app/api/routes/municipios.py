from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db

router = APIRouter(prefix="/municipios", tags=["municípios"])


class MunicipioResumo(BaseModel):
    codigo_ibge: str
    nome: str
    regiao_administrativa: Optional[str] = None
    mesorregiao: Optional[str] = None
    microrregiao: Optional[str] = None
    populacao_estimada: Optional[int] = None


class MunicipioLista(BaseModel):
    total: int
    municipios: list[MunicipioResumo]


class IndicadorItem(BaseModel):
    chave: str
    nome: str
    valor_num: Optional[float] = None
    valor_txt: Optional[str] = None
    unidade: Optional[str] = None
    fonte: str
    periodo: str
    tipo: str
    limitacoes: Optional[str] = None


class PerfilMunicipio(BaseModel):
    municipio: MunicipioResumo
    mercado: list[IndicadorItem]
    social: list[IndicadorItem]


@router.get("", response_model=MunicipioLista)
async def listar_municipios(
    q: Optional[str] = Query(default=None, description="Filtro por nome (parcial, sem acento)"),
    limite: int = Query(default=20, le=700),
    offset: int = Query(default=0, ge=0),
) -> MunicipioLista:
    """Lista municípios do Estado de São Paulo com suporte a busca por nome."""
    import unicodedata

    db = await get_db()
    try:
        if q:
            termo = "".join(
                c for c in unicodedata.normalize("NFD", q.lower())
                if unicodedata.category(c) != "Mn"
            )
            rows = await db.execute_fetchall(
                """
                SELECT codigo_ibge, nome, regiao_administrativa, mesorregiao,
                       microrregiao, populacao_estimada
                FROM municipios
                WHERE nome_normalizado LIKE ?
                ORDER BY nome
                LIMIT ? OFFSET ?
                """,
                (f"%{termo}%", limite, offset),
            )
            count_row = await db.execute(
                "SELECT COUNT(*) FROM municipios WHERE nome_normalizado LIKE ?",
                (f"%{termo}%",),
            )
        else:
            rows = await db.execute_fetchall(
                """
                SELECT codigo_ibge, nome, regiao_administrativa, mesorregiao,
                       microrregiao, populacao_estimada
                FROM municipios
                ORDER BY nome
                LIMIT ? OFFSET ?
                """,
                (limite, offset),
            )
            count_row = await db.execute("SELECT COUNT(*) FROM municipios")

        total = (await count_row.fetchone())[0]
        municipios = [MunicipioResumo(**dict(r)) for r in rows]
        return MunicipioLista(total=total, municipios=municipios)
    finally:
        await db.close()


@router.get("/{codigo_ibge}", response_model=MunicipioResumo)
async def obter_municipio(codigo_ibge: str) -> MunicipioResumo:
    """Retorna os dados cadastrais de um município pelo código IBGE."""
    db = await get_db()
    try:
        row = await db.execute_fetchall(
            """
            SELECT codigo_ibge, nome, regiao_administrativa, mesorregiao,
                   microrregiao, populacao_estimada
            FROM municipios WHERE codigo_ibge = ?
            """,
            (codigo_ibge,),
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Município {codigo_ibge} não encontrado.")
        return MunicipioResumo(**dict(row[0]))
    finally:
        await db.close()


@router.get("/{codigo_ibge}/perfil", response_model=PerfilMunicipio)
async def perfil_municipio(codigo_ibge: str) -> PerfilMunicipio:
    """Retorna o perfil completo do município com indicadores dos dois pilares."""
    db = await get_db()
    try:
        row = await db.execute_fetchall(
            """
            SELECT codigo_ibge, nome, regiao_administrativa, mesorregiao,
                   microrregiao, populacao_estimada
            FROM municipios WHERE codigo_ibge = ?
            """,
            (codigo_ibge,),
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Município {codigo_ibge} não encontrado.")

        municipio = MunicipioResumo(**dict(row[0]))

        indicadores = await db.execute_fetchall(
            """
            SELECT chave, nome, valor_num, valor_txt, unidade,
                   fonte, periodo, tipo, limitacoes, categoria
            FROM indicadores WHERE codigo_ibge = ?
            ORDER BY categoria, chave
            """,
            (codigo_ibge,),
        )

        mercado = [IndicadorItem(**{k: v for k, v in dict(r).items() if k != "categoria"})
                   for r in indicadores if r["categoria"] == "mercado"]
        social  = [IndicadorItem(**{k: v for k, v in dict(r).items() if k != "categoria"})
                   for r in indicadores if r["categoria"] == "social"]

        return PerfilMunicipio(municipio=municipio, mercado=mercado, social=social)
    finally:
        await db.close()
