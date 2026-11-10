from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentAccount
from app.core.db import get_session
from app.core.errors import ProblemError
from app.core.settings import get_settings
from app.modules.accounts import service
from app.modules.accounts.models import Account
from app.modules.accounts.schemas import AccountOut, LoginRequest, RegisterRequest, SessionOut

router = APIRouter(prefix="/api/v1")

REFRESH_COOKIE = "profilo_rt"
REFRESH_COOKIE_PATH = "/api/v1/auth"
CSRF_HEADER_VALUE = "profilo"

DbSession = Annotated[AsyncSession, Depends(get_session)]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _account_out(account: Account) -> AccountOut:
    return AccountOut(
        id=account.id,
        email=account.email,
        email_confirmed=account.email_confirmed_at is not None,
        created_at=account.created_at,
    )


def _session_response(response: Response, issued: service.IssuedSession) -> SessionOut:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        issued.refresh_token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )
    return SessionOut(
        access_token=issued.access_token,
        expires_in=settings.access_token_ttl_seconds,
        account=_account_out(issued.account),
    )


def _clear_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


def _require_csrf_header(x_requested_with: str | None) -> None:
    # Defence in depth on top of SameSite=Strict for cookie-authenticated endpoints.
    if x_requested_with != CSRF_HEADER_VALUE:
        raise ProblemError(401, "unauthorized")


@router.post("/accounts", status_code=201, tags=["auth"])
async def register(
    payload: RegisterRequest, request: Request, response: Response, session: DbSession
) -> SessionOut:
    issued = await service.register(
        session, payload.display_name, payload.email, payload.password, _client_ip(request)
    )
    response.headers["Location"] = "/api/v1/me"
    return _session_response(response, issued)


@router.post("/auth/login", tags=["auth"])
async def login(
    payload: LoginRequest, request: Request, response: Response, session: DbSession
) -> SessionOut:
    issued = await service.login(session, payload.email, payload.password, _client_ip(request))
    return _session_response(response, issued)


@router.post("/auth/refresh", tags=["auth"])
async def refresh(
    response: Response,
    session: DbSession,
    x_requested_with: Annotated[str | None, Header()] = None,
    profilo_rt: Annotated[str | None, Cookie()] = None,
) -> SessionOut:
    _require_csrf_header(x_requested_with)
    try:
        issued = await service.refresh(session, profilo_rt)
    except ProblemError:
        _clear_cookie(response)
        raise
    return _session_response(response, issued)


@router.post("/auth/logout", status_code=204, tags=["auth"])
async def logout(
    response: Response,
    session: DbSession,
    x_requested_with: Annotated[str | None, Header()] = None,
    profilo_rt: Annotated[str | None, Cookie()] = None,
) -> Response:
    _require_csrf_header(x_requested_with)
    await service.logout(session, profilo_rt)
    _clear_cookie(response)
    response.status_code = 204
    return response


@router.get("/me", tags=["account"])
async def me(account: CurrentAccount) -> AccountOut:
    return _account_out(account)
