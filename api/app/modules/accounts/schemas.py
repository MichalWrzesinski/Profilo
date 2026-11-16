import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, EmailStr, Field, StringConstraints

from app.core.monitoring import redact
from app.core.schemas import ApiModel

# Passwords are taken exactly as typed: no whitespace stripping (ApiModel strips strings).
# Every password in a request is marked secret for error reports (core.monitoring).
Password = Annotated[str, StringConstraints(strip_whitespace=False), AfterValidator(redact)]


class RegisterRequest(ApiModel):
    display_name: str = Field(min_length=1, max_length=60)
    email: EmailStr = Field(max_length=254)
    # Length and common-password rules are checked by the service (ACC-BR-3) to return
    # specific error codes; the upper bound here only limits abuse.
    password: Password = Field(max_length=1024)
    accept_terms: Literal[True]
    challenge: str | None = Field(default=None, max_length=2000)  # ALTCHA, TASK-018


class LoginRequest(ApiModel):
    email: EmailStr = Field(max_length=254)
    password: Password = Field(max_length=128)  # no stored password can be longer


class PasswordResetRequest(ApiModel):
    email: EmailStr = Field(max_length=254)


class PasswordResetConfirm(ApiModel):
    token: str = Field(min_length=20, max_length=200)
    # Length and common-password rules are checked by the service (ACC-BR-3).
    new_password: Password = Field(max_length=1024)


class PasswordChange(ApiModel):
    current_password: Password = Field(max_length=128)
    new_password: Password = Field(max_length=1024)


class AccountDeletion(ApiModel):
    password: Password = Field(max_length=128)


class TokenRequest(ApiModel):
    token: str = Field(min_length=20, max_length=200)


class AccountOut(ApiModel):
    id: uuid.UUID
    email: str
    email_confirmed: bool
    created_at: datetime


class SessionOut(ApiModel):
    access_token: str
    expires_in: int
    account: AccountOut
