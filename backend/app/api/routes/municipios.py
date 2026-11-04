from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/municipios", tags=["municípios"])


class MunicipioResumo(BaseModel):
    codigo_ibge: str
    nome: str
    regiao_administrativa: Optional[str] = None
    populacao: Optional[int] = None


class MunicipioLista(BaseModel):
    total: int
    municipios: list[MunicipioResumo]


# Placeholder — será substituído pela integração real com o BD na Etapa 3
@router.get("", response_model=MunicipioLista)
async def listar_municipios(
    q: Optional[str] = Query(default=None, description="Filtro por nome"),
    limite: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
) -> MunicipioLista:
    """Lista municípios do Estado de São Paulo."""
    return MunicipioLista(total=0, municipios=[])


@router.get("/{codigo_ibge}", response_model=MunicipioResumo)
async def obter_municipio(codigo_ibge: str) -> MunicipioResumo:
    """Retorna os dados de um município específico pelo código IBGE."""
    raise HTTPException(status_code=404, detail="Município não encontrado")
