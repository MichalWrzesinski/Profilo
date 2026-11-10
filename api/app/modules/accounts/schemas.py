import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from app.core.schemas import ApiModel


class RegisterRequest(ApiModel):
    display_name: str = Field(min_length=1, max_length=60)
    email: EmailStr = Field(max_length=254)
    # Length and common-password rules are checked by the service (ACC-BR-3) to return
    # specific error codes; the upper bound here only limits abuse.
    password: str = Field(max_length=1024)
    accept_terms: Literal[True]
    challenge: str | None = Field(default=None, max_length=2000)  # ALTCHA, TASK-018


class LoginRequest(ApiModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(max_length=1024)


class AccountOut(ApiModel):
    id: uuid.UUID
    email: str
    email_confirmed: bool
    created_at: datetime


class SessionOut(ApiModel):
    access_token: str
    expires_in: int
    account: AccountOut
